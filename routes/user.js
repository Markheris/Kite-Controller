import express from "express"
import "dotenv/config.js"
import { dbClient } from "../config/db.js";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { authMiddleware } from "../helper/authMiddleware.js";
import { ObjectId } from "mongodb";

export const userRouter = express.Router();

userRouter.post("/signup", async (req, res) => {

    const { username, email, password } = req.body;
    dbClient().then(async (client) => {
        const userCollection = client.collection("users");
        const foundedUser = await userCollection.findOne({ $or: [{ email: email }, { username: username }] });
        if (foundedUser) {
            return res.status(200).send({ status: false, error: "Kullanıcı zaten mevcut" })
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
            riotId: null,
            avatar: null,
            level: null,
            tier: null,
            division: null,
            isVerified: false,
            isAdmin: false,
            notifications: [],
            analytics: [],
        }
        userCollection.insertOne(userData).then(user => {
            userCollection.findOne({ _id: new ObjectId(user.insertedId) }).then(savedUser => {
                const tokenData = {
                    id: savedUser._id,
                    username: savedUser.username,
                    email: savedUser.email
                }
                const token = jwt.sign(tokenData, process.env.TOKEN_SECRET, { expiresIn: "1d" })
                res.status(200).cookie("token", token).json({ status: true, message: "Başarıyla oluşturuldu" })
            })
        }).catch(e => {
            return res.statusCode(500)
        })
    }).catch(e => {
        console.log(e);
        return res.statusCode(500)
    })
})

userRouter.post("/signin", async (req, res, next) => {
    const { email, password } = req.body;
    dbClient().then(async (client) => {
        const userCollection = client.collection("users");
        const user = await userCollection.findOne({ email })

        if (!user)
            return res.status(200).json({ status: false, error: "Kullanıcı adı veya şifre yanlış" })
        const validPassword = bcrypt.compare(password, user.password)

        if (!validPassword)
            return res.status(200).json({ status: false, error: "Kullanıcı adı veya şifre yanlış" });

        const tokenData = {
            id: user._id,
            username: user.username,
            email: user.email
        }
        const token = jwt.sign(tokenData, process.env.TOKEN_SECRET, { expiresIn: "1d" })
        res.cookie("token", token)
        res.status(200);
        return res.json({ message: "Giriş başarılı", status: true });
    }).catch(e => {
        return res.sendStatus(500)
    })
})

userRouter.get("/me", authMiddleware, async (req, res) => {
    try {
        dbClient().then(async client => {
            const userId = req.userId;
            const userCollection = client.collection("users");
            const user = await userCollection.findOne({ _id: new ObjectId(userId) }, { projection: { password: 0 } })
            if (!user) {
                return res.status(200).json({ data: null })
            }
            return res.status(200).json({ data: user });
        })
    } catch (error) {
        res.status(500).json({ error: error });
    }
})

userRouter.get("/signout", (req, res) => {
    try {
        return res.status(200).clearCookie("token").json({ status: true, message: "Çıkış başarılı" })
    } catch (error) {
        return res.status(500).json({ error: error })
    }
})