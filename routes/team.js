import { Router } from "express";
import { authMiddleware } from "../helper/authMiddleware.js";
import { dbClient } from "../config/db.js";
import { ObjectId } from "mongodb";

export const teamRouter = Router();

teamRouter.post("/create", authMiddleware, async (req, res) => {
    try {
        dbClient().then(async client => {
            const teamCollection = client.collection("teams");
            const userCollection = client.collection("users");
            const { teamName, playerId } = req.body
            const team = await teamCollection.findOne({ teamName: teamName });
            const user = await userCollection.findOne({ _id: new ObjectId(playerId) })
            if (user.team) {
                return res.status(400).json({ status: false, error: "Zaten takımın var" })
            }
            if (team) {
                return res.status(400).json({ status: false, error: "Bu takım ismi kullanılıyor" })
            }

            const teamData = {
                teamName: teamName,
                players: [{
                    playerId: playerId,
                    captain: true
                }],
                registeredTournaments: [],
            }
            await teamCollection.insertOne(teamData).then(async team => {
                await userCollection.findOneAndUpdate({ _id: new ObjectId(playerId) }, { $set: { team: team.insertedId.toString() } }, {
                    returnOriginal: false
                });
                res.status(200).json({ message: "Başarıyla oluşturuldu", status: true, team });
            })

        })
    } catch (error) {
        console.log(error);
        return res.sendStatus(500);
    }
})

