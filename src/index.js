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
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const apollo_server_express_1 = require("apollo-server-express");
const apollo_server_core_1 = require("apollo-server-core");
const database_1 = require("./database");
const graphql_1 = require("./graphql");
const compression_1 = __importDefault(require("compression"));
const mount = (app) => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield (0, database_1.connectDatabase)();
    // Increase the limit of requests from 1mb(default value) to 2mb
    app.use(body_parser_1.default.json({ limit: "2mb" }));
    // cookie-parser middleware
    app.use((0, cookie_parser_1.default)(process.env.COOKIE_SECRET));
    // Compression Middleware
    app.use((0, compression_1.default)());
    // Client Middleware
    app.use(express_1.default.static(`${__dirname}/client`));
    // Handle all get request from the single-page client application
    app.get("/*", (_req, res) => res.sendFile(`${__dirname}/client/index.html`)); 
    const server = new apollo_server_express_1.ApolloServer({
        typeDefs: graphql_1.typeDefs,
        resolvers: graphql_1.resolvers,
        context: ({ req, res }) => ({ db, req, res }),
        //In recent updates the default viewing/landing page is the Appollo server explorer instead of the GraphQL Playground
        //This line is needed to turn back the default viewing page to be the GraphQL Playground
        plugins: [apollo_server_core_1.ApolloServerPluginLandingPageGraphQLPlayground]
    });
    server.start().then(() => {
        server.applyMiddleware({ app, path: '/api' });
    });
    app.listen(process.env.PORT);
    console.log(`[app] : http://localhost:${process.env.PORT}`);
});
mount((0, express_1.default)());
