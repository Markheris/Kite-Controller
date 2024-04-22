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
                    "mapType": "HOWLING_ABYSS",
                    "metadata": "Kite Tournaments",
                    "pickType": "ALL_RANDOM",
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
                    tourIndex: parseInt(tourIndex),
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
    const {shortCode} = req.body;
    const userCollection = dbc.collection("users");
    const teamCollection = dbc.collection("teams");
    const tournamentCollection = dbc.collection("tournaments");
    try {
        const gameResult = await axios.get(`https://americas.api.riotgames.com/lol/tournament/v5/games/by-code/${shortCode}`, {
            headers: {
                "X-Riot-Token": "RGAPI-7e367c50-3b59-4103-b841-2ed3fee1063a"
            }
        })
        const wonUser = await userCollection.findOne({puuid: gameResult.data[0].winningTeam[0].puuid});
        const lostUser = await userCollection.findOne({puuid: gameResult.data[0].losingTeam[0].puuid});
        const wonTeam = await teamCollection.findOne({_id: new ObjectId(wonUser.team)})
        const lostTeam = await teamCollection.findOne({_id: new ObjectId(lostUser.team)})
        const nextTourIndex = wonTeam.activeLobby.tourIndex + 1;
        tournamentCollection.findOne({name: wonTeam.activeLobby.tournamentName}).then(async tournament => {
            const seedIndex = tournament.bracket[nextTourIndex].seeds.findIndex(({id}) => id === wonTeam.activeLobby.nextMatchId);
            await tournamentCollection.findOneAndUpdate({name: wonTeam.activeLobby.tournamentName}, {
                $push: {
                    [`bracket.${nextTourIndex}.seeds.${seedIndex}.teams`]: {
                        name: wonTeam.teamName,
                        id: wonTeam._id.toString()
                    }
                }
            })
            await teamCollection.findOneAndUpdate({_id: new ObjectId(lostTeam._id)}, {
                $unset: {activeLobby: ""}
            })
            await teamCollection.findOneAndUpdate({_id: new ObjectId(wonTeam._id)}, {
                $unset: {activeLobby: ""}
            })
        })
        return res.status(200).json({
            wonTeam: {name: wonTeam.teamName, id: wonTeam._id},
            matchId: wonTeam.activeLobby.matchId,
        });
    } catch (e) {
        console.log(e);
        return res.sendStatus(500)
    }
    // fs.writeFile('./output/gameResult.json', JSON.stringify(content, null, 2), err => {
    //     if (err) {
    //         console.log(err);
    //         res.sendStatus(500)
    //     } else {
    //         res.sendStatus(200);
    //     }
    // });
})
