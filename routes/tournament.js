import { Router } from "express";
import { dbClient } from "../config/db.js";

export const tournamentRouter = Router();

tournamentRouter.get("/getAll", (req, res) => {
    dbClient().then(async (client) => {
        const tournamentCollection = client.collection("tournaments");
        const tournamentData = []
        for await (const doc of tournamentCollection.find()) {
            tournamentData.push(doc);
        }
        return res.status(200).json({ status: true, data: tournamentData })

    })

})

tournamentRouter.post("/get", (req, res) => {
    const { tournamentId } = req.body;
    dbClient().then(async client => {
        const tournamentCollection = client.collection("tournaments");
        tournamentCollection.findOne({ tournamentId: tournamentId }).then(tournament => {
            if (tournament) {
                return res.status(200).json({ status: true, data: tournament })
            } else {
                return res.status(200).json({ status: false, error: "Turnuva bulunamadı" })
            }
        }).catch(e => {
            console.log(e);
            return res.statusCode(500)
        })
    })


})