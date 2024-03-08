import { Router } from "express";
import { dbc } from "../index.js";

export const tournamentRouter = Router();

tournamentRouter.get("/getAll", async (req, res) => {
    const tournamentCollection = dbc.collection("tournaments");
    const tournamentData = []
    for await (const doc of tournamentCollection.find()) {
        tournamentData.push(doc);
    }
    return res.status(200).json({ status: true, data: tournamentData })

})

tournamentRouter.post("/get", async (req, res) => {
    const { tournamentId } = req.body;
    const tournamentCollection = dbc.collection("tournaments");
    tournamentCollection.findOne({ tournamentId: tournamentId }).then(tournament => {
        if (tournament) {
            return res.status(200).json({ status: true, data: tournament })
        } else {
            return res.status(200).json({ status: false, error: "Turnuva bulunamadı" })
        }
    })
})