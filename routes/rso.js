import {Router} from "express";
import request from "request"
import {authMiddleware} from "../helper/authMiddleware.js";
import {dbc} from "../index.js";

var clientID = "client_id",
    clientSecret = "client_secret";

var appBaseUrl = "http://local.example.com:3000",
    appCallbackUrl = appBaseUrl + "/oauth";

var provider = "https://auth.riotgames.com",
    authorizeUrl = provider + "/authorize",
    tokenUrl = provider + "/token";

export const rsoRouter = Router();

rsoRouter.get("/oauth", (req, res) => {
    var accessCode = req.query.code;

    // make server-to-server request to token endpoint
    // exchange authorization code for tokens
    request.post({
        url: tokenUrl,
        auth: { // sets "Authorization: Basic ..." header
            user: clientID,
            pass: clientSecret
        },
        form: { // post information as form-data
            grant_type: "authorization_code",
            code: accessCode,
            redirect_uri: appCallbackUrl
        }
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // parse the response to JSON
            var payload = JSON.parse(body);

            // separate the tokens from the entire response body
            var tokens = {
                refresh_token: payload.refresh_token,
                id_token: payload.id_token,
                access_token: payload.access_token
            };

            // legibly print out our tokens
            res.send("<pre>" + JSON.stringify(tokens, false, 4) + "</pre>");
        } else {
            res.send("/token request failed");
        }
    });
})