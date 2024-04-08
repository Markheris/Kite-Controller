import {Router} from "express";
import request from "request"
import {authMiddleware} from "../helper/authMiddleware.js";
import {dbc} from "../index.js";
import https from "https";
import {ObjectId} from "mongodb";

var clientID = "ce5aecf2-a4e8-4ae3-8f07-00168f91a105",
    clientSecret = "rQrXBno5HzAGypcYvnat10dQZjsAlGrbwvVF7qH9AMu";

var appBaseUrl = "https://kitetournaments.com",
    appCallbackUrl = appBaseUrl + "/rso/signin";

var provider = "https://auth.riotgames.com",
    tokenUrl = provider + "/token";

export const rsoRouter = Router();

rsoRouter.get("/oauth", authMiddleware, (req, res) => {
    let riotApiToken = "RGAPI-7e367c50-3b59-4103-b841-2ed3fee1063a"
    var accessCode = req.query.code;
    //make server-to-server request to token endpoint
    //exchange authorization code for tokens
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
        if (!error && response.statusCode === 200) {
            // parse the response to JSON
            var payload = JSON.parse(body);

            // separate the tokens from the entire response body
            var tokens = {
                refresh_token: payload.refresh_token,
                id_token: payload.id_token,
                access_token: payload.access_token
            };
            let getRiotAccReq = https.request({
                host: "europe.api.riotgames.com",
                port: 443,
                path: encodeURI(`/riot/account/v1/accounts/me`),
                method: 'GET',
                headers: {
                    "Authorization": `Bearer ${tokens.access_token}`,
                }
            }, (accountRes) => {
                accountRes.on("error", error => {
                    console.log(error)
                    return res.status(200).json({status: false, error:error});
                })
                accountRes.on("data", account => {
                    const parsedAccountData = JSON.parse(account)
                    console.log(parsedAccountData)
                    let getSummoner = https.request({
                        host: 'tr1.api.riotgames.com',
                        port: 443,
                        path: encodeURI(`/lol/summoner/v4/summoners/by-puuid/${parsedAccountData.puuid}`),
                        method: 'GET',
                        headers: {
                            "X-Riot-Token": riotApiToken
                        }
                    }, (summonerRes) => {
                        summonerRes.on("data", (summoner) => {
                            const userCollection = dbc.collection("users")
                            const parsedSummonerData = JSON.parse(summoner);
                            if (parsedSummonerData.status) {
                                return res.status(200).json({status: false, error: "Yalnızca League Of Legends hesabını bağlayabilirsin."});
                            }
                            if (parsedSummonerData.id) {
                                userCollection.findOneAndUpdate({_id: new ObjectId(req.userId)}, {
                                    $set: {
                                        avatar: parsedSummonerData.profileIconId,
                                        summonerId: parsedSummonerData.id,
                                        puuid: parsedAccountData.puuid,
                                        tagLine: parsedAccountData.tagLine.toUpperCase(),
                                        gameName: parsedAccountData.gameName,
                                    }
                                }).then(() => {
                                    return res.status(200).json({status: true, message: "Hesabın başarıyla bağlandı"});
                                })
                            }
                        })
                    })
                    getSummoner.end();
                })
            });
            getRiotAccReq.end();
            // legibly print out our tokens
        } else {
           return res.send("/token request failed");
        }
    });
})

rsoRouter.post("/getUser", authMiddleware, (req, res) => {
    const {gameName, tagLine} = req.body;
    let getAccount = https.request({
        host: 'europe.api.riotgames.com',
        port: 443,
        path: encodeURI(`/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`),
        method: 'GET',
        headers: {
            "X-Riot-Token": riotApiToken
        }
    }, (accountRes) => {
        accountRes.on('data', function (account) {
            const parsedAccountData = JSON.parse(account)
            console.log(parsedAccountData)
            if (parsedAccountData.puuid) {
                let getSummoner = https.request({
                    host: 'tr1.api.riotgames.com',
                    port: 443,
                    path: encodeURI(`/lol/summoner/v4/summoners/by-puuid/${parsedAccountData.puuid}`),
                    method: 'GET',
                    headers: {
                        "X-Riot-Token": riotApiToken
                    }
                }, (summonerRes) => {
                    summonerRes.on("data", (summoner) => {
                        const userCollection = dbc.collection("users")
                        const parsedSummonerData = JSON.parse(summoner);
                        if (parsedSummonerData.id) {
                            userCollection.findOneAndUpdate({_id: new ObjectId(req.userId)}, {
                                $set: {
                                    avatar: parsedSummonerData.profileIconId,
                                    summonerId: parsedSummonerData.id,
                                    tagLine: parsedAccountData.tagLine.toUpperCase(),
                                    gameName: parsedAccountData.gameName,
                                }
                            }).then(() => {
                                return res.status(200).json({
                                    status: true,
                                    message: "Hesabın Bağlandı",
                                })
                            })
                        }
                    })
                })
                getSummoner.end();
            } else {
                return res.status(200).json({status: false, error: "Oyuncu Bulunamadı"})
            }

        });
    });
    getAccount.end();
})