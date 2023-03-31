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
exports.bookingResolvers = void 0;
const mongodb_1 = require("mongodb");
const utils_1 = require("../../../lib/utils");
const api_1 = require("../../../lib/api");
const handleBookingIndex = (bookingsIndex, checkIn, checkOut) => {
    let datePointer = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const newBookingsIndex = Object.assign({}, bookingsIndex);
    while (datePointer <= checkOutDate) {
        const year = datePointer.getUTCFullYear();
        const month = datePointer.getUTCMonth(); // Note: this function returns 0 for Januray and 11 for december
        const day = datePointer.getUTCDate();
        if (!newBookingsIndex[year]) {
            newBookingsIndex[year] = {};
        }
        if (!newBookingsIndex[year][month]) {
            newBookingsIndex[year][month] = {};
        }
        if (!newBookingsIndex[year][month][day]) {
            newBookingsIndex[year][month][day] = true;
        }
        else {
            throw new Error("[Error_handleBookingIndex] The selected date contains days that are already booked by other users!");
        }
        datePointer = new Date(datePointer.getTime() + 86400000); // Increment the pointer by 1 day(86400000 milli seconds)
    }
    return newBookingsIndex;
};
exports.bookingResolvers = {
    Mutation: {
        createBooking: (_root, { input }, { db, req }) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const { id, source, checkIn, checkOut } = input;
                // 1- Verify a logged in user is making the request
                const viewer = yield (0, utils_1.authorize)(db, req);
                if (!viewer) {
                    throw new Error("[Error_CreateBooking] Could not verify logged in user.");
                }
                // 2- Find the listing document that will be booked
                const listing = yield db.listings.findOne({ _id: new mongodb_1.ObjectId(id) });
                if (!listing) {
                    throw new Error("[Error_CreateBooking] Could not find the listing being booked.");
                }
                // 3- Make sure the tenant is not booking their own listing
                if (listing.host === viewer._id) {
                    throw new Error("[Error_CreateBooking] User is not allowed to book their own listing.");
                }
                // 4- Make sure "checkOut" date is NOT before "checkIn" date
                const checkInDate = new Date(checkIn);
                const checkOutDate = new Date(checkOut);
                if (checkOutDate < checkInDate) {
                    throw new Error("[Error_CreateBooking] Check out date can NOT be before check in date.");
                }
                // 5- Create a new booking index for the listing being booked
                const bookingsIndex = handleBookingIndex(listing.bookingsIndex, checkIn, checkOut);
                // 6- Get the total price(in cents) to be charged: subtract both times in ms >> convert to days >> add one day since the booking date is inclusive
                const totalPrice = listing.price * (((checkOutDate.getTime() - checkInDate.getTime()) / 86400000) + 1);
                // 7- Get the user document of the host(owner of the listing)
                const host = yield db.users.findOne({ _id: listing.host });
                if (!host) {
                    throw new Error("[Error_CreateBooking] Could not find the host(owner) of the listing.");
                }
                if (!host.walletId) {
                    throw new Error("[Error_CreateBooking] The host(owner) of the listing has NO connected Stripe account.");
                }
                // 8- Make the Stripe charge
                yield (0, api_1.chargeStripe)(totalPrice, source, host.walletId);
                // 9- Insert the newly created booking into the "bookings" collection in the database
                const newBooking = {
                    _id: new mongodb_1.ObjectId(),
                    listing: listing._id,
                    tenant: viewer._id,
                    checkIn: checkIn,
                    checkOut: checkOut
                };
                const bookingResponse = yield db.bookings.insertOne(newBooking);
                if (!bookingResponse.acknowledged) {
                    throw new Error("[Error_CreateBooking] Failed to update the database with the new booking.");
                }
                // 10- Update the "income" field of the user document of the host
                yield db.users.updateOne({
                    _id: host._id
                }, {
                    $inc: { income: totalPrice }
                });
                // 11- Update the "bookings" field of the user document of the tenant
                yield db.users.updateOne({
                    _id: viewer._id
                }, {
                    $push: { bookings: newBooking._id }
                });
                // 12- Update the "bookings" field of the listing that just got booked
                yield db.listings.updateOne({
                    _id: listing._id
                }, {
                    $set: { bookingsIndex: bookingsIndex },
                    $push: { bookings: newBooking._id }
                });
                // 13- Return the newly created booking
                return newBooking;
            }
            catch (error) {
                throw new Error(`[Error_CreateBooking] Failed to execute the mutation. Details: ${error}`);
            }
        })
    },
    Booking: {
        id: (booking) => {
            return booking._id.toString();
        },
        listing: (booking, _args, { db }) => {
            return db.listings.findOne({ _id: booking.listing });
        },
        tenant: (booking, _args, { db }) => {
            return db.users.findOne({ _id: booking.tenant });
        }
    }
};
