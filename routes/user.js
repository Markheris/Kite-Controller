import express, {response} from "express"
import "dotenv/config.js"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import {authMiddleware} from "../helper/authMiddleware.js";
import {ObjectId} from "mongodb";
import {dbc} from "../index.js";
import axios from "axios";


export const userRouter = express.Router();

userRouter.post("/signup", async (req, res) => {

    const {username, email, password} = req.body;
    const userCollection = dbc.collection("users");
    const foundedUser = await userCollection.findOne({$or: [{email: email}, {username: username}]});
    if (foundedUser) {
        return res.status(200).send({status: false, error: "Kullanıcı zaten mevcut"})
    }
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)
    const userData = {
        username: username,
        email: email,
        password: hashedPassword,
        team: null,
        kiteBalance: 0,
        fateBalance: 0,
        avatar: null,
        summonerId: null,
        puuid: null,
        tagLine: null,
        gameName: null,
        analytics: [],
        notifications: [],
        isVerified: false,
        isAdmin: false,
    }
    userCollection.insertOne(userData).then(user => {
        userCollection.findOne({_id: new ObjectId(user.insertedId)}).then(savedUser => {
            const tokenData = {
                id: savedUser._id,
                username: savedUser.username,
                email: savedUser.email
            }
            const token = jwt.sign(tokenData, process.env.TOKEN_SECRET, {expiresIn: "1d"})
            res.status(200).cookie("token", token).json({status: true, message: "Başarıyla oluşturuldu"})
        })
    }).catch(e => {
        return res.sendStatus(500)
    })
})

userRouter.post("/signin", async (req, res, next) => {
    const {email, password} = req.body;
    const userCollection = dbc.collection("users");
    const user = await userCollection.findOne({email: email})

    if (!user)
        return res.status(200).json({status: false, error: "Kullanıcı adı veya şifre yanlış"})

    console.log(user.password);


    const validPassword = await bcrypt.compare(password, user.password)

    if (!validPassword)
        return res.status(200).json({status: false, error: "Kullanıcı adı veya şifre yanlış"});

    const tokenData = {
        id: user._id,
        username: user.username,
        email: user.email
    }
    const token = jwt.sign(tokenData, process.env.TOKEN_SECRET, {expiresIn: "1d"})
    res.cookie("token", token)
    res.status(200);
    return res.json({message: "Giriş başarılı", status: true});
})

userRouter.get("/userUpdate", authMiddleware, async (req, res) => {
    const userCollection = dbc.collection("users");
    try {
        const adminUser = await userCollection.findOne({_id: new ObjectId(req.userId)});
        if (!(adminUser.isAdmin)) {
            return res.sendStatus(401);
        }
        for await (const user of userCollection.find({})) {
            if (user.summonerId) {
                axios.get(`https://tr1.api.riotgames.com/lol/summoner/v4/summoners/${user.summonerId}?api_key=RGAPI-7e367c50-3b59-4103-b841-2ed3fee1063a`).then(response => {
                    userCollection.updateOne({_id: new ObjectId(user._id)}, {$set: {avatar: response.data.profileIconId}})
                })
            }
            if (user.puuid) {
                axios.get(`https://europe.api.riotgames.com/riot/account/v1/accounts/by-puuid/${user.puuid}?api_key=RGAPI-7e367c50-3b59-4103-b841-2ed3fee1063a`).then(response => {
                    userCollection.updateOne({_id: new ObjectId(user._id)}, {
                        $set: {
                            gameName: response.data.gameName,
                            tagLine: response.data.tagLine
                        }
                    })

                })
            }
        }
        return res.sendStatus(200);
    } catch (e) {
        console.log(e);
        return res.sendStatus(500);
    }
})

userRouter.post("/delete", authMiddleware, async (req, res) => {
    const {userId} = req.body;
    const userCollection = dbc.collection("users");
    const tournamentCollection = dbc.collection("teams");
    try {
        const adminUser = await userCollection.findOne({_id: new ObjectId(req.userId)});
        if (!(adminUser.isAdmin)) {
            return res.sendStatus(401);
        }


    } catch (e) {
        console.log(e);
        return res.sendStatus(500);
    }
})

userRouter.get("/me", authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const userCollection = dbc.collection("users");
        const user = await userCollection.findOne({_id: new ObjectId(userId)}, {projection: {password: 0}})
        if (!user) {
            return res.status(200).json({status: false, data: null})
        }
        return res.status(200).json({status: true, data: user});
    } catch (error) {
        res.status(500).json({status: false, error: error});
    }
})

userRouter.post("/discordConnect", authMiddleware, async (req, res) => {
    const {discordUserName} = req.body;
    const userCollection = dbc.collection("users");

    try {
        const user = await userCollection.findOne({discordUsername: discordUserName})
        if (user) {
            return res.status(200).json({status: false, error: "Bu kullanıcı mevcut"})
        }
        await userCollection.findOneAndUpdate({_id: new ObjectId(req.userId)}, {$set: {discordUsername: discordUserName}})
        res.status(200).json({status: true, message: "Discord hesabın başarıyla bağlandı!"})
    } catch (e) {
        console.log(e);
        res.sendStatus(500)
    }
})
userRouter.post("/deleteDiscordConnect", authMiddleware, async (req, res) => {
    const userCollection = dbc.collection("users");
    const teamCollection = dbc.collection("teams");
    try {
        const user = await userCollection.findOne({_id: new ObjectId(req.userId)})
        if (user.team) {
            return res.status(200).json({status: false, error: "Bir takımın varken bağlantını kopartamazsın"})
        }
        await userCollection.findOneAndUpdate({_id: new ObjectId(req.userId)}, {$set: {discordUsername: null}})
        res.status(200).json({status: true, message: "Discord hesabının bağlantısı kaldırıldı!"})
    } catch (e) {
        console.log(e);
        res.sendStatus(500)
    }
})

userRouter.post("/deleteRiotConnect", authMiddleware, async (req, res) => {
    const userCollection = dbc.collection("users");
    const teamCollection = dbc.collection("teams");
    try {
        const user = await userCollection.findOne({_id: new ObjectId(req.userId)})
        if (user.team) {
            return res.status(200).json({status: false, error: "Bir takımın varken bağlantını kopartamazsın"})
        }
        await userCollection.findOneAndUpdate({_id: new ObjectId(req.userId)}, {
            $set: {
                avatar: null,
                summonerId: null,
                tagLine: null,
                gameName: null,
                puuid: null,
            }
        })

        res.status(200).json({status: true, message: "Riot hesabının bağlantısı kaldırıldı!"})
    } catch (e) {
        console.log(e);
        res.sendStatus(500)
    }
})


userRouter.get("/signout", (req, res) => {
    try {
        return res.status(200).clearCookie("token").json({status: true, message: "Çıkış başarılı"})
    } catch (error) {
        return res.status(500).json({error: error})
    }
})