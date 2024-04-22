import {Router} from "express";
import {dbc} from "../index.js";
import {ObjectId} from "mongodb";
import axios from "axios";
import {authMiddleware} from "../helper/authMiddleware.js";
import fs from "node:fs";

export const tournamentProviderRouter = Router();


tournamentProviderRouter.post("/createLobby", authMiddleware, async (req, res) => {
    const {tournamentApiId, tournamentId, tourIndex} = req.query;
    const userCollection = dbc.collection("users");
    const tournamentCollection = dbc.collection("tournaments");
    const teamCollection = dbc.collection("teams");
    try {
        const adminUser = await userCollection.findOne({_id: new ObjectId(req.userId)});
        if (!(adminUser.isAdmin)) {
            return res.sendStatus(401);
        }
        const tournament = await tournamentCollection.findOne({tournamentId: tournamentId});
        for (let i = 0; i < tournament.bracket[tourIndex].seeds.length; i++) {
            let allowedParticipants = [];
            const matchId = tournament.bracket[tourIndex].seeds[i].id;
            const nextMatchId = tournament.bracket[tourIndex].seeds[i].nextId;
            const teams = [];
            console.log(tournament.bracket[tourIndex].seeds[i].teams.length)
            if (tournament.bracket[tourIndex].seeds[i].teams.length === 0) {
                continue;
            }
            for (let j = 0; j < tournament.bracket[tourIndex].seeds[i].teams.length; j++) {
                const team = await teamCollection.findOne({_id: new ObjectId(tournament.bracket[tourIndex].seeds[i].teams[j].id)});
                teams.push(team);
                teams[j].players = [];
                for await (const user of userCollection.find({team: team._id.toString()})) {
                    allowedParticipants.push(user.puuid);
                    teams[j].players.push({
                        name: user.gameName,
                        tagLine: user.tagLine,
                        avatar: user.avatar,
                    })
                }
            }
            await axios.post(`https://americas.api.riotgames.com/lol/tournament/v5/codes?tournamentId=${tournamentApiId}&count=1`, {
                    "allowedParticipants": allowedParticipants,
                    "enoughPlayers": true,
                    "mapType": "SUMMONERS_RIFT",
                    "metadata": "Kite Tournaments",
                    "pickType": "TOURNAMENT_DRAFT",
                    "spectatorType": "ALL",
                    "teamSize": 5
                }
                , {
                    headers: {
                        "X-Riot-Token": "RGAPI-7e367c50-3b59-4103-b841-2ed3fee1063a"
                    }
                }).then(async response => {
                const activeLobby = {
                    tournamentCode: response.data[0],
                    tournamentName: tournament.name,
                    matchId: matchId,
                    nextMatchId: nextMatchId,
                    tournamentImage: tournament.tournamentImage,
                    tour: tournament.bracket[tourIndex].title,
                    team1: {
                        name: teams[0].teamName,
                        players: teams[0].players
                    },
                    team2: {
                        name: teams[1].teamName,
                        players: teams[1].players
                    },
                }
                await teamCollection.updateOne({_id: new ObjectId(teams[0]._id)}, {$set: {activeLobby: activeLobby}})
                await teamCollection.updateOne({_id: new ObjectId(teams[1]._id)}, {$set: {activeLobby: activeLobby}})
            }).catch(e => {
                console.log("Hata", e);
                return res.sendStatus(500)
            })
        }
        return res.json({tournamentApiId: tournamentApiId});
    } catch (e) {
        console.log(e);
        return res.sendStatus(500)
    }
})

tournamentProviderRouter.post("/gameResult", async (req, res) => {
    const content = req.body;
    fs.writeFile('./output/gameResult.json', JSON.stringify(content, null, 2), err => {
        if (err) {
            console.log(err);
            res.sendStatus(500)
        } else {
            res.sendStatus(200);
        }
    });
})
