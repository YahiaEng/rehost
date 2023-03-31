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
exports.connectDatabase = void 0;
const mongodb_1 = require("mongodb");
// MongoDB Credentials
const url = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_USER_PASSWORD}@${process.env.DB_CLUSTER}.mongodb.net/?retryWrites=true&w=majority`;
const connectDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    // Establish an async conenction with the MongoDB database with the above credentials
    const client = yield mongodb_1.MongoClient.connect(url);
    // Specify which database to access
    const db = client.db("main");
    // Return a map of the collections form the database
    return {
        bookings: db.collection("bookings"),
        listings: db.collection("listings"),
        users: db.collection("users")
    };
});
exports.connectDatabase = connectDatabase;
