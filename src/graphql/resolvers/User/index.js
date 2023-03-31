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
exports.userResolvers = void 0;
const utils_1 = require("../../../lib/utils");
exports.userResolvers = {
    Query: {
        user: (_root, { id }, { db, req }) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const user = yield db.users.findOne({ _id: id });
                if (!user) {
                    throw new Error("[Error] User doesn't exist in database");
                }
                // Use authorization function to check if the incoming request(query) is coming from the logged in user and not a malicious attack
                const viewer = yield (0, utils_1.authorize)(db, req);
                if (viewer && (viewer._id === user._id)) {
                    //viewer.authorized = true;
                    user.authorized = true;
                }
                return user;
            }
            catch (error) {
                throw new Error(`[Error] Failed to query user from database: ${error}`);
            }
        })
    },
    User: {
        id: (user) => {
            return user._id;
        },
        hasWallet: (user) => {
            return Boolean(user.walletId);
        },
        income: (user) => {
            return user.authorized ? user.income : null;
        },
        bookings: (user, { limit, page }, { db }) => __awaiter(void 0, void 0, void 0, function* () {
            /*
                Implemented with offset-based Paginiation
            */
            try {
                if (!user.authorized) {
                    return null;
                }
                const data = {
                    total: 0,
                    result: []
                };
                // "user.bookings" is an array of object id. Each "object id" corresponds to an "object id" in the "bookings" collection
                // So, I search the "bookings" collection and return all the matching results
                let cursor = db.bookings.find({
                    _id: { $in: user.bookings }
                });
                // Same as above excpet this function returns the total number of matching documents
                data.total = yield db.bookings.countDocuments({
                    _id: { $in: user.bookings }
                });
                // Offset-based Pagination:
                cursor = cursor.skip(page > 0 ? (page - 1) * limit : 0);
                cursor = cursor.limit(limit);
                data.result = yield cursor.toArray();
                return data;
            }
            catch (error) {
                throw new Error(`[Error] Failed to query user bookings: ${error}`);
            }
        }),
        listings: (user, { limit, page }, { db }) => __awaiter(void 0, void 0, void 0, function* () {
            /*
                Implemented with offset-based Paginiation
            */
            try {
                const data = {
                    total: 0,
                    result: []
                };
                // "user.listings" is an array of object id. Each "object id" corresponds to an "object id" in the "listings" collection
                // So, I search the "listings" collection and return all the matching results
                let cursor = db.listings.find({
                    _id: { $in: user.listings }
                });
                // Same as above excpet this function returns the total number of matching documents
                data.total = yield db.listings.countDocuments({
                    _id: { $in: user.listings }
                });
                // Offset-based Pagination:
                cursor = cursor.skip(page > 0 ? (page - 1) * limit : 0);
                cursor = cursor.limit(limit);
                data.result = yield cursor.toArray();
                return data;
            }
            catch (error) {
                throw new Error(`[Error] Failed to query user listings: ${error}`);
            }
        })
    }
};
