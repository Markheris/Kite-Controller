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
            return res.status(400).send({ error: "Kullanıcı zaten mevcut" })
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
            return res.status(200).send(user);
        }).catch(e => {
            return res.status(500).send({ error: e });
        })
    }).catch(e => {
        console.log(e);
        return res.status(500).send({ error: e })
    })
})

userRouter.post("/signin", async (req, res) => {
    const { email, password } = req.body;
    dbClient().then(async (client) => {
        const userCollection = client.collection("users");
        const user = await userCollection.findOne({ email })

        if (!user)
            return res.status(403).json({ error: "Kullanıcı adı veya şifre yanlış" })
        const validPassword = bcrypt.compare(password, user.password)

        if (!validPassword)
            return res.status(403).json({ error: "Kullanıcı adı veya şifre yanlış" });

        const tokenData = {
            id: user._id,
            username: user.username,
            email: user.email
        }
        const token = jwt.sign(tokenData, process.env.TOKEN_SECRET, { expiresIn: "1d" })

        return res.status(200).cookie("token", token).json({ message: "Giriş başarılı", status: true })
    }).catch(e => {
        return res.sendStatus(500)
    })
})

userRouter.post("/me", authMiddleware, async (req, res) => {
    try {
        dbClient().then(async client => {
            const userId = req.userId;
            const userCollection = client.collection("users");
            const user = await userCollection.findOne({ _id: new ObjectId(userId) }, { projection: { password: 0 } })
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