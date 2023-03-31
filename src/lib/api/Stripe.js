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
exports.chargeStripe = exports.connectToStripe = void 0;
const stripe_1 = __importDefault(require("stripe"));
/*
    Establish a connection with Stripe: https://www.npmjs.com/package/stripe
*/
const client = new stripe_1.default(`${process.env.STRIPE_SECRET_KEY}`, { apiVersion: '2022-11-15' });
// Function that connects a users stripe account with my app
const connectToStripe = (code) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield client.oauth.token({
        grant_type: "authorization_code",
        code: code
    });
    return response;
});
exports.connectToStripe = connectToStripe;
/*
    Function that makes the transaction between the list host/owner and the person renting
    And charges the host my platform fee of 5%
        Documentation: https://stripe.com/docs/connect/direct-charges
        Doucmentation: https://stripe.com/docs/api/charges/create
*/
const chargeStripe = (amount, source, stripeAccount) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield client.charges.create({
        amount,
        currency: "usd",
        source,
        application_fee_amount: Math.round(amount * 0.05)
    }, {
        stripeAccount: stripeAccount
    });
    if (response.status !== "succeeded") {
        throw new Error("[Error_Stripe] Failed to charge with Stripe!");
    }
});
exports.chargeStripe = chargeStripe;
