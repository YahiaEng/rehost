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
exports.GoogleAuthenticate = exports.GoogleGeocode = void 0;
const googleapis_1 = require("googleapis"); // OAuth API
const google_maps_services_js_1 = require("@googlemaps/google-maps-services-js"); // Geocoding API
/*
    --------------------------------------------------------------------------------
    Google Geocode API set up: https://developers.google.com/maps/documentation/geocoding
                               https://github.com/googlemaps/google-maps-services-js
    --------------------------------------------------------------------------------
*/
const client = new google_maps_services_js_1.Client({});
// Parses the first object that the geocode API returns.
// This first object contains all the data I need (Country, State/admin(administrative_area_level_1), City)
const parseAddress = (addressComponents) => {
    let country = null;
    let admin = null;
    let city = null;
    for (const component of addressComponents) {
        if (component.types.includes(google_maps_services_js_1.PlaceType2.country)) {
            country = component.long_name;
        }
        if (component.types.includes(google_maps_services_js_1.PlaceType2.administrative_area_level_1)) {
            admin = component.long_name;
        }
        if (component.types.includes(google_maps_services_js_1.PlaceType2.locality) || component.types.includes(google_maps_services_js_1.PlaceType2.postal_town)) {
            city = component.long_name;
        }
    }
    return { country, admin, city };
};
const GoogleGeocode = (address) => __awaiter(void 0, void 0, void 0, function* () {
    const req = {
        params: {
            address: address,
            key: process.env.GOOGLE_GEOCODE_KEY
        }
    };
    const res = yield client.geocode(req); // Get geocode data with the input address
    // In case of an error, the response status will have a value of "< 200"  or ">299"
    if (res.status < 200 || res.status > 299) {
        throw new Error("[Error] Couldn't geocode this address");
    }
    return parseAddress(res.data.results[0].address_components);
});
exports.GoogleGeocode = GoogleGeocode;
/*
    -------------------------------------------------------------------------------------------------
    Google OAuth 2.0 API set up: https://github.com/googleapis/google-api-nodejs-client#oauth2-client
    -------------------------------------------------------------------------------------------------
*/
const auth = new googleapis_1.google.auth.OAuth2(process.env.G_CLIENT_ID, process.env.G_CLIENT_SECRET, `${process.env.PUBLIC_URL}/login`);
exports.GoogleAuthenticate = {
    // Generate Authentication url 
    authUrl: auth.generateAuthUrl({
        access_type: "online",
        scope: [
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile"
        ]
    }),
    // Login function to get user data from Google's People API
    logIn: (code) => __awaiter(void 0, void 0, void 0, function* () {
        const { tokens } = yield auth.getToken(code);
        auth.setCredentials(tokens);
        // The syntax of this function is very specific
        const { data } = yield googleapis_1.google.people({ version: "v1", auth }).people.get({
            resourceName: "people/me",
            personFields: "emailAddresses,names,photos"
        });
        return { user: data };
    })
};
