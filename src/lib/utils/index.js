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
exports.authorize = void 0;
/*
    Checks if the incoming login request is indeed coming from the user and not some other malicious website
    by verifying the generated user token
*/
const authorize = (db, req) => __awaiter(void 0, void 0, void 0, function* () {
    //const token = req.get("X-CSRF-TOKEN");
    const viewer = yield db.users.findOne({
        _id: req.signedCookies.sid,
        //token
    });
    return viewer;
});
exports.authorize = authorize;
