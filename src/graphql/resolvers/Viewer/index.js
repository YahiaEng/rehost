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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.viewerResolvers = void 0;
const api_1 = require("../../../lib/api");
const crypto_1 = __importDefault(require("crypto"));
const utils_1 = require("../../../lib/utils");
// Cookie options object that is passed to "cookie parser"
// https://github.com/expressjs/cookie-parser
const cookieOptions = {
    // Counter XSS attacks
    httpOnly: true,
    // Counter cross-site request attacks
    sameSite: true,
    // Enusre cookies are not tampered with by creating an HMAC of the value and base64 encoding it.    
    signed: true,
    // In case of development: allow requests from non-https websites otherwise only accept request from httpSecured sites
    // Update the enviroment variable to indicate the project status (in develompent or in production) 
    secure: process.env.PROJECT_STATUS == "development" ? false : true
};
const googleLogIn = (code, token, db, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Get user data from Goofle's Poeple API
    const { user } = yield api_1.GoogleAuthenticate.logIn(code);
    if (!user) {
        throw new Error("[Google Error]: Failed Google Login!");
    }
    /*
        Next is extracting the fields I need from the user data object
        Unforunately,
        The structure of the user data object recieved from Google is a nested mess with many optional fields
    */
    // Name,Photo, and Email Lists
    const userNamesList = user.names && user.names.length ? user.names : null;
    const userPhotosList = user.photos && user.photos.length ? user.photos : null;
    const userEmailsList = user.emailAddresses && user.emailAddresses.length ? user.emailAddresses : null;
    // User Display Name
    const userName = userNamesList ? userNamesList[0].displayName : null;
    // User Id
    const userId = userNamesList && userNamesList[0].metadata && userNamesList[0].metadata.source ? userNamesList[0].metadata.source.id : null;
    // User Avatar
    const userAvatar = userPhotosList && userPhotosList[0].url ? userPhotosList[0].url : null;
    // User Email
    const userEmail = userEmailsList && userEmailsList[0].value ? userEmailsList[0].value : null;
    if (!userId || !userName || !userAvatar || !userEmail) {
        throw new Error("[Google Error]: Failed Google Login!");
    }
    // If the user exists, update it
    const updateRes = yield db.users.findOneAndUpdate({ _id: userId }, {
        $set: {
            name: userName,
            avatar: userAvatar,
            contact: userEmail,
            token
        }
    }, { returnDocument: 'after' } // Return the updated User document instead of the older version
    );
    let viewer = updateRes.value;
    // In case of a new user:: register their data to the database under the "User" Collection
    if (!viewer) {
        const newUser = {
            _id: userId,
            token,
            name: userName,
            avatar: userAvatar,
            contact: userEmail,
            income: 0,
            bookings: [],
            listings: []
        };
        const insertResult = yield db.users.insertOne(newUser);
        if (!insertResult.acknowledged) {
            throw new Error("[Error_GoogleLogIn]: Failed to add the new user to the database");
        }
        viewer = newUser;
    }
    // Create a cookie with the userID and name it "sid(session id)"
    // Can encode the userID and decode for extra security but it is uneeded because of the "signed" cookie option
    res.cookie("sid", userId, Object.assign(Object.assign({}, cookieOptions), { maxAge: 182 * 24 * 60 * 60 * 1000 // Set cookie expiration date to 6 months in milliseconds
     }));
    return viewer;
});
// Second way of logging in is by using cookies
// This method will be used as the default logging in method AFTER the user first logs in with the "googleLogIn" method above
const cookieLogIn = (token, db, req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // search the "user" collection in the database for an _id that matches the _id stored in the cookie
    const updateResponse = yield db.users.findOneAndUpdate({ _id: req.signedCookies.sid }, { $set: { token } }, { returnDocument: 'after' });
    // If the user doesn't exist in the database, then the cookie has an outaded user_id
    // In this case, the cookie is cleared
    if (!updateResponse.value) {
        res.clearCookie("sid", cookieOptions);
        return undefined;
    }
    return updateResponse.value;
});
/*
    Note: Trivial resolvers(resolvers that simply return the requested value OF CHILD NODES and don't take in any input) don't need to be coded
*/
exports.viewerResolvers = {
    Query: {
        authUrl: () => {
            try {
                return api_1.GoogleAuthenticate.authUrl;
            }
            catch (error) {
                throw new Error(`Failed to query Google auth url: ${error}`);
            }
        }
    },
    Mutation: {
        logIn: (_root, { input }, { db, req, res }) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const code = input ? input.code : null;
                const token = crypto_1.default.randomBytes(16).toString("hex");
                // If the code exists, log in with goole, else log in with cookies
                const viewer = code ? yield googleLogIn(code, token, db, res) : yield cookieLogIn(token, db, req, res);
                // In case of an unsuccesful login
                if (!viewer) {
                    return {
                        didRequest: true
                    };
                }
                return {
                    _id: viewer._id,
                    token: viewer.token,
                    avatar: viewer.avatar,
                    walletId: viewer.walletId,
                    didRequest: true
                };
            }
            catch (error) {
                throw new Error(`Failed to log in: ${error}`);
            }
        }),
        logOut: (_root, _args, { res }) => {
            try {
                // Clear the "sid" cookie when logging out
                // Most web browser only clear a cookie if is the "cookieOptions" paramater is equal to when that cookie was created
                res.clearCookie("sid", cookieOptions);
                return { didRequest: true };
            }
            catch (error) {
                throw new Error(`[Log Out]: Faile to log out! : ${error}`);
            }
        },
        connectStripe: (_root, { input }, { db, req }) => __awaiter(void 0, void 0, void 0, function* () {
            /*
                This resolver will
                >> establish a connection with Stripe using an input "token" code
                >> Get user's Stripe account info (in particular I am only interested in the "stripe_user_id" field)
                >> Update the user's data (the "walletId" field) inside the database wtih the "stripe_user_id"
                >> Set "viewer.didRequest: true"
            */
            try {
                const { code } = input;
                // Make sure the request is coming from the user currentley signed in and not from a malicious source
                let viewer = yield (0, utils_1.authorize)(db, req);
                if (!viewer) {
                    throw new Error("[Error_connectStripe] Viewer could not be found");
                }
                /*
                    Establish a connection with Stripe with the token "code"
                    This function returns an object with info on the user's Stripe account
                    I am only interested in the "stripe_user_id"
                */
                const stripeWallet = yield (0, api_1.connectToStripe)(code);
                if (!stripeWallet) {
                    throw new Error("[Error_connectStripe] Could not connect to Stripe API");
                }
                // Find the user in our database and update their Stripe wallet ID
                const updateResponse = yield db.users.findOneAndUpdate({ _id: viewer._id }, { $set: { walletId: stripeWallet.stripe_user_id } }, { returnDocument: 'after' });
                if (!updateResponse.value) {
                    throw new Error("[Error_connectStripe] Failed to update user's Stripe info");
                }
                viewer = updateResponse.value;
                return {
                    _id: viewer._id,
                    token: viewer.token,
                    avatar: viewer.avatar,
                    walletId: viewer.walletId,
                    didRequest: true
                };
            }
            catch (error) {
                throw new Error(`[Error_connectStripe] Failed to connect with Stripe!. Details: ${error}`);
            }
        }),
        disconnectStripe: (_root, _args, { db, req }) => __awaiter(void 0, void 0, void 0, function* () {
            /*
                This resolver will
                >> Set the user's "walletId" field inside the database to null
                >> Set "viewer.didRequest: true"
            */
            try {
                // Make sure the request is coming from the user currentley signed in and not from a malicious source
                let viewer = yield (0, utils_1.authorize)(db, req);
                if (!viewer) {
                    throw new Error("[Error_disconnectStripe] Viewer could not be found");
                }
                // Find the user in our database and set their Stripe wallet ID to null
                const updateResponse = yield db.users.findOneAndUpdate({ _id: viewer._id }, { $unset: { walletId: "" } }, { returnDocument: 'after' });
                if (!updateResponse.value) {
                    throw new Error("[Error_diconnectStripe] Failed to disconnect with Stripe");
                }
                viewer = updateResponse.value;
                return {
                    _id: viewer._id,
                    token: viewer.token,
                    avatar: viewer.avatar,
                    walletId: viewer.walletId,
                    didRequest: true
                };
            }
            catch (error) {
                throw new Error(`[Error_disconnectStripe] Failed to connect with Stripe! Details: ${error}`);
            }
        })
    },
    Viewer: {
        id: (viewer) => {
            return viewer._id;
        },
        hasWallet: (viewer) => {
            return viewer.walletId ? true : undefined;
        }
    }
};
