"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listingResolvers = void 0;
const mongodb_1 = require("mongodb");
const api_1 = require("../../../lib/api");
const types_1 = require("../../../lib/types");
const listingTypes_1 = require("./listingTypes");
const utils_1 = require("../../../lib/utils");
// Used inside "hostListing" mutation to validate input
const verifyHostListingInput = ({ title, description, type, price }) => {
    if (title.length > 100) {
        throw new Error("[Error_VerifyHostListing]: Listing title must be less than 100 characters");
    }
    if (description.length > 5000) {
        throw new Error("[Error_VerifyHostListing]: Listing description must be less than 500 characters");
    }
    if (price < 0) {
        throw new Error("[Error_VerifyHostListing]: Price must be greater than zero");
    }
    if ((type != types_1.ListingType.Apartment) && (type != types_1.ListingType.House)) {
        throw new Error("[Error_VerifyHostListing]: Listing type muste either be House or Apartment");
    }
};
exports.listingResolvers = {
    Query: {
        listing: (_root, { id }, { db, req }) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const listing = yield db.listings.findOne({ _id: new mongodb_1.ObjectId(id) });
                if (!listing) {
                    throw new Error("[Error] Could not find the queried listing inside the database");
                }
                // Use authorization function to check if the incoming request(query) is coming from the logged in user and not a malicious attack
                const viewer = yield (0, utils_1.authorize)(db, req);
                if (viewer && viewer._id == listing.host) {
                    listing.authorized = true;
                }
                return listing;
            }
            catch (error) {
                throw new Error("[Error] Failed to query the listing from database");
            }
        }),
        listings: (_root, { location, filter, limit, page }, { db }) => __awaiter(void 0, void 0, void 0, function* () {
            /*
                Implemented with offset-based Paginiation
            */
            try {
                const data = {
                    region: null,
                    total: 0,
                    result: []
                };
                const query = {};
                // If a location input is given, use "GoogleGeocode" function
                // In this case, "query" will have the parsed geocoded info
                if (location) {
                    const { country, admin, city } = yield (0, api_1.GoogleGeocode)(location);
                    if (city)
                        query.city = city;
                    if (admin)
                        query.admin = admin;
                    if (country) {
                        query.country = country;
                    }
                    else {
                        throw new Error("[Error: listings query] No country could be found that match the given geolocation");
                    }
                    const cityText = city ? `${city}, ` : "";
                    const adminText = admin ? `${admin}, ` : "";
                    data.region = `${cityText}${adminText}${country}`;
                }
                // If query is still and empty object: then ALL the listing documents from "listings collection" will be retireved
                // Otherwise, only documents that match the input "location" address will be retrieved
                let cursor = db.listings.find(query);
                // Count the number of returned documents
                data.total = yield db.listings.countDocuments(query);
                if ((filter) && (filter == listingTypes_1.ListingsFilter.PRICE_LOW_TO_HIGH)) {
                    // "1" means sort "price" in ascending order
                    cursor = cursor.sort({ price: 1 });
                }
                if ((filter) && (filter == listingTypes_1.ListingsFilter.PRICE_HIGH_TO_LOW)) {
                    // "-1" means sort "price" in descending order
                    cursor = cursor.sort({ price: -1 });
                }
                // Offset-based Pagination:
                cursor = cursor.skip(page > 0 ? (page - 1) * limit : 0);
                cursor = cursor.limit(limit);
                data.result = yield cursor.toArray();
                return data;
            }
            catch (error) {
                throw new Error(`[Error] Failed to query listing from the listings collection: ${error}`);
            }
        })
    },
    Mutation: {
        hostListing: (_root, { input }, { db, req }) => __awaiter(void 0, void 0, void 0, function* () {
            verifyHostListingInput(input);
            // Verify that the mutation request is coming from the logged in user and not a malicious source
            const viewer = yield (0, utils_1.authorize)(db, req);
            if (!viewer) {
                throw new Error("[Error_hostListing]: Can not verify viewer!");
            }
            // Use Google's Geocode to verify the address and get (city, admin and country) info from it
            const { country, admin, city } = yield (0, api_1.GoogleGeocode)(input.address);
            if (!country || !admin || !city) {
                throw new Error("[Error_hostListing]: Invalid address!");
            }
            // Upload the image to Cloudinary under the "Listings" folder and get it's URL
            const imageUrl = yield (0, api_1.UploadToCloudinary)(input.image, "Listings");
            // Create a new listing with the input info and add it to the "Listings" collection
            const newListing = Object.assign(Object.assign({ _id: new mongodb_1.ObjectId() }, input), { image: imageUrl, bookings: [], bookingsIndex: {}, country: country, admin: admin, city: city, host: viewer._id });
            // Verify the insert operation was successful
            const insertResult = yield db.listings.insertOne(newListing);
            if (!insertResult.acknowledged) {
                throw new Error("[Error_HostListing]: Failed to add the new listing to the database!");
            }
            // Update the host's data to include their newly created listing
            yield db.users.updateOne({ _id: viewer._id }, { $push: { listings: newListing._id } });
            // Return the newly created listing
            return newListing;
        })
    },
    Listing: {
        id: (listing) => {
            return listing._id.toString();
        },
        host: (listing, _args, { db }) => __awaiter(void 0, void 0, void 0, function* () {
            const host = yield db.users.findOne({ _id: listing.host });
            if (!host) {
                throw new Error("[Error] Could not find the queried host field inside the database");
            }
            return host;
        }),
        bookingsIndex: (listing) => {
            return JSON.stringify(listing.bookingsIndex);
        },
        bookings: (listing, { limit, page }, { db }) => __awaiter(void 0, void 0, void 0, function* () {
            /*
                Implemented with offset-based Paginiation
            */
            try {
                if (!listing.authorized) {
                    return null;
                }
                const data = {
                    total: 0,
                    result: []
                };
                // "user.bookings" is an array of object id. Each "object id" corresponds to an "object id" in the "bookings" collection
                // So, I search the "bookings" collection and return all the matching results
                let cursor = db.bookings.find({
                    _id: { $in: listing.bookings }
                });
                // Same as above excpet this function returns the total number of matching documents
                data.total = yield db.bookings.countDocuments({
                    _id: { $in: listing.bookings }
                });
                cursor = cursor.skip(page > 0 ? (page - 1) * limit : 0);
                cursor = cursor.limit(limit);
                data.result = yield cursor.toArray();
                return data;
            }
            catch (error) {
                throw new Error(`[Error] Failed to query for the bookings element inside the listing element: ${error}`);
            }
        })
    }
};
