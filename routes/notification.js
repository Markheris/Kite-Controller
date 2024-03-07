import { Router } from "express";
import { authMiddleware } from "../helper/authMiddleware.js";
import { dbClient } from "../config/db.js";

export const notificationRouter = Router();

notificationRouter.post("/send", authMiddleware, async (req, res) => {
    const { userName, teamName, teamId, sender } = req.body

    const notificationData = {
        title: "Takım Daveti",
        message: "Haydi gel",
        teamId: teamId,
        teamName: teamName,
        sender: sender,
    }

    dbClient().then(async client => {
        const userCollection = client.collection("users");
        const user = await userCollection.findOne({ username: userName });
        if (user) {
            if (user.team) {
                return res.status(200).json({ stauts: false, error: "Oyuncunun takımı var" })
            } else {
                for (let i = 0; i < user.notifications.length; i++) {
                    if (sender == user.notifications[i].sender) {
                        return res.status(200).json({ stauts: false, error: "Bu oyuncuyu davet etmişsin" })
                    }
                }
                return await userCollection.findOneAndUpdate({ username: userName }, { $push: { notifications: notificationData } }).then(() => {
                    return res.status(200).json({ stauts: true, message: "Davet gönderildi!" })
                }).catch(e => {
                    console.log(e);
                    return res.statusCode(500)
                })

            }
        } else {
            return res.status(200).json({ stauts: false, error: "Oyuncu bulunamadı" })
        }
    })
})