import {Router} from "express";
import {dbc} from "../index.js";
import {authMiddleware} from "../helper/authMiddleware.js";
import {ObjectId} from "mongodb";

import {InMemoryDatabase} from "brackets-memory-db";
import {BracketsManager} from "brackets-manager";
import axios from "axios";
import {tournamentProviderRouter} from "./tournamentProvider.js";

const storage = new InMemoryDatabase();
const manager = new BracketsManager(storage);

export const tournamentRouter = Router();


tournamentRouter.get("/v2/createBracket", async (req, res) => {
    const {tournamentId} = req.query
    const tournamentCollection = dbc.collection("tournaments");
    try {
        await manager.delete.tournament(tournamentId)
        const tournament = await tournamentCollection.findOne({tournamentId: tournamentId});
        const registeredTeams = tournament.registeredTeams
        await manager.create({
            name: `${tournament.name} Fikstür`,
            tournamentId: tournamentId, //
            type: 'single_elimination',
            settings: {
                consolationFinal: true,
                matchesChildCount: 1
            },
            seeding: registeredTeams,
        });
        const demoBracket = await manager.get.tournamentData(tournamentId)
        await tournamentCollection.updateOne({tournamentId: tournamentId}, {
            $set: {demoBracket: demoBracket}
        })
        res.json(await manager.get.tournamentData(tournamentId))
    } catch (e) {
        console.log(e);
        res.sendStatus(500);
    }
})

tournamentRouter.post("/v2/manualUpdateBracket", async (req, res) => {
    const {tournamentId, matchId, wonTeamPlacement} = req.body
    const tournamentCollection = dbc.collection("tournaments");
    try {
        const tournament = await tournamentCollection.findOne({tournamentId: tournamentId});
        await manager.import(tournament.demoBracket);
        if (wonTeamPlacement === "opponent1") {
            await manager.update.match({
                id: matchId, // First match of winner bracket (round 1)
                opponent1: {score: 1, result: "win"},
                opponent2: {score: 0},
            });
        } else {
            await manager.update.match({
                id: matchId, // First match of winner bracket (round 1)
                opponent1: {score: 0},
                opponent2: {score: 1, result: 'win'},
            });
        }
        const demoBracket = await manager.get.tournamentData(tournamentId)
        await tournamentCollection.updateOne({tournamentId: tournamentId}, {
            $set: {demoBracket: demoBracket}
        })
        return res.status(200).json({
            status: true,
            message: "Başarıyla Güncellendi"
        })
    } catch (e) {
        console.log(e);
        return res.sendStatus(500);
    }
})
tournamentRouter.post("/v2/gameResult", async (req, res) => {
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
        const matchId = wonTeam.activeLobby.matchId;
        const tournamentId = wonTeam.activeLobby.tournamentId;
        const tournament = await tournamentCollection.findOne({tournamentId: tournamentId});
        // const matchIndex = tournament.demoBracket.match.findIndex(({id}) => id === matchId);
        // const match = tournament.demoBracket.match[matchIndex];
        await manager.import(tournament.demoBracket);
        console.log(await manager.get.tournamentData(tournamentId));
        if (wonTeam.activeLobby.placement === "opponent1") {
            await manager.update.match({
                id: matchId,
                opponent1: {score: 1, result: "win"},
                opponent2: {score: 0}
            })
        } else {
            await manager.update.match({
                id: matchId,
                opponent1: {score: 0},
                opponent2: {score: 1, result: "win"}
            })
        }
        const demoBracket = await manager.get.tournamentData(tournamentId)
        await tournamentCollection.updateOne({tournamentId: tournamentId}, {
            $set: {demoBracket: demoBracket}
        })
        await teamCollection.findOneAndUpdate({_id: new ObjectId(lostTeam._id)}, {
            $unset: {activeLobby: ""}
        })
        await teamCollection.findOneAndUpdate({_id: new ObjectId(wonTeam._id)}, {
            $unset: {activeLobby: ""}
        })
        return res.status(200).json({status: true, message: "Başarıyla Güncellendi"})
    } catch (e) {
        console.log(e);
        return res.sendStatus(500);
    }
})

tournamentRouter.post("/getWin", (req, res) => {
    console.log(req);
    res.status(200).json({message: req.body})
})

tournamentRouter.get("/getAll", async (req, res) => {
    const tournamentCollection = dbc.collection("tournaments");
    const tournamentData = []
    try {
        for await (const doc of tournamentCollection.find({active: true})) {
            tournamentData.push(doc);
        }
        return res.status(200).json({status: true, data: tournamentData})
    } catch (e) {
        console.log(e);
        return res.sendStatus(500);
    }

})

tournamentRouter.post("/get", async (req, res) => {
    const {tournamentId} = req.body;
    const tournamentCollection = dbc.collection("tournaments");
    try {
        tournamentCollection.findOne({tournamentId: tournamentId}).then(tournament => {
            if (tournament) {
                return res.status(200).json({status: true, data: tournament})
            } else {
                return res.status(200).json({status: false, error: "Turnuva bulunamadı"})
            }
        })
    } catch (e) {
        console.log(e);
        return res.sendStatus(500);
    }
})

tournamentRouter.post("/join", authMiddleware, async (req, res) => {
    const {teamId, tournamentId} = req.body;
    const teamCollection = dbc.collection("teams");
    const tournamentCollection = dbc.collection("tournaments");
    try {
        const team = await teamCollection.findOne({_id: new ObjectId(teamId)})
        if (team.players.length !== 5) {
            return res.status(200).json({
                status: false,
                error: "Bu turnuvaya katılmak için takımında 5 oyuncu olması gerek"
            })
        }
        const captain = team.players.find(({captain}) => captain === true);
        if (req.userId !== captain.playerId) {
            return res.status(200).json({status: false, error: "Yalnızca takım kaptanları kayıt isteği gönderebilir."})
        }
        const tournament = await tournamentCollection.findOne({tournamentId: tournamentId})
        if (tournament.registeredTeams) {
            const registeredTeam = tournament.registeredTeams.find(({name}) => name === team.name);
            if (registeredTeam) {
                if (registeredTeam.name === team.name) {
                    return res.status(200).json({status: false, error: "Bu turnuvaya katılma isteği göndermişsin"})
                }
            }
        } else {
            return res.status(200).json({status: false, error: "Turnuvaya kayıtları kapalı"})
        }
        await teamCollection.updateOne({_id: new ObjectId(teamId)}, {
            $set: {
                registeredTournament: {
                    tournamentId: tournament.tournamentId,
                    image: tournament.tournamentImage,
                    status: "waiting",
                    name: tournament.name,
                    approvedPlayers: {
                        [req.userId]: true,
                    },
                }
            }
        })
        // await tournamentCollection.updateOne({tournamentId: tournamentId}, {
        //     $push: {
        //         registeredTeams: {
        //             name: team.name,
        //             id: team._id,
        //         }
        //     }
        // })
        return res.status(200).json({status: true, message: "Kayıt isteği gönderildi"})
    } catch (e) {
        console.log(e);
        return res.sendStatus(500);
    }
})

tournamentRouter.post("/playerJoin", authMiddleware, async (req, res) => {
    const {teamId, tournamentId, choose} = req.body;
    const teamCollection = dbc.collection("teams");
    const tournamentCollection = dbc.collection("tournaments");
    try {
        const team = await teamCollection.findOne({_id: new ObjectId(teamId)})
        if (team.registeredTournament) {
            if (team.registeredTournament.tournamentId === tournamentId) {
                await teamCollection.findOneAndUpdate({_id: new ObjectId(teamId)}, {
                    $set: {
                        [`registeredTournament.approvedPlayers.${req.userId}`]: choose
                    }
                }, {returnDocument: "after"}).then(async (updatedTeam) => {
                    console.log(Object.keys(updatedTeam.registeredTournament.approvedPlayers).length);
                    if (Object.keys(updatedTeam.registeredTournament.approvedPlayers).length === 5)
                        if (Object.values(updatedTeam.registeredTournament.approvedPlayers).every(Boolean)) {
                            await teamCollection.updateOne({_id: new ObjectId(teamId)}, {
                                $set: {
                                    "registeredTournament.status": "teamApproved",
                                    "registeredTournament.statusMessage": "Katılım talebin gönderildi! Tarafımızca inceleniyor."
                                }
                            })
                        }
                    if (!Object.values(updatedTeam.registeredTournament.approvedPlayers).every(Boolean))
                        await teamCollection.updateOne({_id: new ObjectId(teamId)}, {
                            $set: {
                                "registeredTournament.status": "teamFailed",
                                "registeredTournament.statusMessage": "Katılım talebin, takımındaki oyuncu(lar) reddettiği için onaylanmadı"
                            }
                        })
                })
                return res.status(200).json({status: true, message: "Seçimin gönderildi"})
            } else {
                return res.status(200).json({status: false, error: "Takım turnuvaya kayıtlı değil"})
            }
        } else {
            return res.status(200).json({status: false, error: "Takım turnuvaya kayıtlı değil"})
        }
    } catch (e) {
        console.log(e);
        return res.sendStatus(500);
    }
})


tournamentRouter.get("/matches", authMiddleware, async (req, res) => {
    const {tournamentId} = req.query;
    const tournamentCollection = dbc.collection("tournaments")
    const tournament = await tournamentCollection.findOne({tournamentId: tournamentId});

    if (!tournament) {
        return res.sendStatus(404);
    }
    let matches = [];

    for (let i = 0; i < tournament.bracket.length; i++) {
        for (let j = 0; j < tournament.bracket[i].seeds.length; j++) {
            if (tournament.bracket[i].seeds[j].teams.length > 1) {
                console.log(tournament.bracket[i].seeds[j].teams)
                let matchObject = {
                    team1: tournament.bracket[i].seeds[j].teams[0].name,
                    team2: tournament.bracket[i].seeds[j].teams[1].name,
                    tour: tournament.bracket[i].title,
                    status: "Bekleniyor",
                }
                matches.push(matchObject);
            }
        }
    }
    return res.status(200).json({status: true, matches: matches});
})

tournamentRouter.post("/adminChoose", authMiddleware, async (req, res) => {
    const {teamId, choose, failMessage, tournamentId} = req.body;
    const teamCollection = dbc.collection("teams")
    const tournamentCollection = dbc.collection("tournaments")
    const userCollection = dbc.collection("users")
    try {
        const user = await userCollection.findOne({_id: new ObjectId(req.userId)})
        if (!user.isAdmin) {
            return res.sendStatus(403);
        }
        if (choose) {
            const team = await teamCollection.findOneAndUpdate({_id: new ObjectId(teamId)}, {
                $set: {
                    "registeredTournament.status": "fullyApproved",
                    "registeredTournament.statusMessage": "Onaylandı"
                }
            })
            await tournamentCollection.updateOne({tournamentId: tournamentId}, {
                $push: {registeredTeams: team.name}
            })
            return res.status(200).json({status: true, message: "Takım Onaylandı"})
        } else {
            const team = await teamCollection.findOneAndUpdate({_id: new ObjectId(teamId)}, {
                $set: {
                    "registeredTournament.status": "fullyFailed",
                    "registeredTournament.statusMessage": failMessage
                }
            })
            return res.status(200).json({status: true, message: "Takım Reddedildi"})
        }

    } catch (e) {
        console.log(e);
        return res.sendStatus(500);
    }
})

tournamentRouter.post("/adminCreateBracket", authMiddleware, async (req, res) => {
    const {tournamentId} = req.body
    const tournamentCollection = dbc.collection("tournaments");
    const userCollection = dbc.collection("users");
    try {
        const tournament = await tournamentCollection.findOne({tournamentId: tournamentId})
        const user = await userCollection.findOne({_id: new ObjectId(req.userId)});
        if (!user.isAdmin) {
            return res.sendStatus(403);
        }
        const registeredTeams = tournament.registeredTeams;
        const bracketTour1 = tournament.bracket[0];
        for (let i = 0; i < bracketTour1.seeds.length; i++) {
            bracketTour1.seeds[i].status = "Bekleniyor"
            for (let j = 0; j < 2; j++) {
                if (registeredTeams.length > 0) {
                    const randomTeam = Math.floor(Math.random() * registeredTeams.length);
                    bracketTour1.seeds[i].teams[j] = {
                        name: registeredTeams[randomTeam].name,
                        id: registeredTeams[randomTeam].id.toString(),
                        wonMatch: 0,
                    }
                    registeredTeams.splice(randomTeam, 1);
                    console.log(registeredTeams, randomTeam);
                }
            }
        }
        await tournamentCollection.updateOne({tournamentId: tournamentId}, {
            $set: {"bracket.0": bracketTour1}
        })
        return res.status(200).json({bracketTour: bracketTour1});
    } catch (e) {
        console.log(e);
        return res.status(500).json({error: e})
    }

})