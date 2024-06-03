import {Router} from "express";
import {dbc} from "../index.js";
import {ObjectId} from "mongodb";
import axios from "axios";
import {authMiddleware} from "../helper/authMiddleware.js";

export const tournamentProviderRouter = Router();


tournamentProviderRouter.post("/createThLobby", authMiddleware, async (req, res) => {
    const {tournamentApiId, tournamentId, team1Id, team2Id} = req.body;
    const userCollection = dbc.collection("users");
    const tournamentCollection = dbc.collection("tournaments");
    const teamCollection = dbc.collection("teams");

    try {
        const adminUser = await userCollection.findOne({_id: new ObjectId(req.userId)});
        if (!(adminUser.isAdmin)) {
            return res.sendStatus(401);
        }
        const teams = [];
        let allowedParticipants = [];
        const tournament = await tournamentCollection.findOne({tournamentId: tournamentId});
        const teamA = await teamCollection.findOne({_id: new ObjectId(team1Id)});
        const teamB = await teamCollection.findOne({_id: new ObjectId(team2Id)});
        teams.push(teamA);
        teams.push(teamB);
        teams[0].players = [];
        teams[1].players = [];
        for await (const user of userCollection.find({team: teamA._id.toString()})) {
            allowedParticipants.push(user.puuid);
            teams[0].players.push({
                name: user.gameName,
                tagLine: user.tagLine,
                avatar: user.avatar,
            })
        }
        for await (const user of userCollection.find({team: teamB._id.toString()})) {
            allowedParticipants.push(user.puuid);
            teams[1].players.push({
                name: user.gameName,
                tagLine: user.tagLine,
                avatar: user.avatar,
            })
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
                tournamentImage: tournament.tournamentImage,
                tour: "3.Lük Maçı",
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

            return res.status(200).json({
                status: true,
                tournamentApiId: tournamentApiId,
            })
        }).catch(e => {
            console.log("Hata", e);
            return res.sendStatus(500)
        })

    } catch (e) {
        console.log(e);
        res.sendStatus(500);
    }

})

tournamentProviderRouter.post("/v2/createLobby/", authMiddleware, async (req, res) => {
    const {tournamentApiId, tourName, tournamentId, roundId} = req.body;
    const userCollection = dbc.collection("users");
    const tournamentCollection = dbc.collection("tournaments");
    const teamCollection = dbc.collection("teams");
    try {
        const adminUser = await userCollection.findOne({_id: new ObjectId(req.userId)});
        if (!(adminUser.isAdmin)) {
            return res.sendStatus(401);
        }
        const tournament = await tournamentCollection.findOne({tournamentId: tournamentId});
        const matches = [];
        for (let i = 0; i < tournament.demoBracket.match.length; i++) {
            if (tournament.demoBracket.match[i].round_id === roundId) {
                let allowedParticipants = [];
                const matchId = tournament.demoBracket.match[i].id;
                if (!(tournament.demoBracket.match[i].opponent2))
                    continue;
                const participant1 = tournament.demoBracket.participant.find(({id}) => id === tournament.demoBracket.match[i].opponent1.id)
                const participant2 = tournament.demoBracket.participant.find(({id}) => id === tournament.demoBracket.match[i].opponent2.id)
                let team1 = await teamCollection.findOne({teamName: participant1.name})
                let team2 = await teamCollection.findOne({teamName: participant2.name})
                if (!(team1 || team2)) {
                    continue;
                }
                team1.players = []
                team2.players = []
                for await (const user of userCollection.find({team: team1._id.toString()})) {
                    allowedParticipants.push(user.puuid);
                    team1.players.push({
                        name: user.gameName,
                        tagLine: user.tagLine,
                        avatar: user.avatar,
                    })
                }
                for await (const user of userCollection.find({team: team2._id.toString()})) {
                    allowedParticipants.push(user.puuid);
                    team2.players.push({
                        name: user.gameName,
                        tagLine: user.tagLine,
                        avatar: user.avatar,
                    })
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
                    const activeLobbyTeam1 = {
                        tournamentCode: response.data[0],
                        tournamentName: tournament.name,
                        matchId: matchId,
                        placement: "opponent1",
                        tournamentImage: tournament.tournamentImage,
                        teamId: participant1.id,
                        tour: tourName,
                        team1: {
                            name: team1.teamName,
                            players: team1.players
                        },
                        team2: {
                            name: team2.teamName,
                            players: team2.players
                        },
                    }
                    const activeLobbyTeam2 = {
                        tournamentCode: response.data[0],
                        tournamentName: tournament.name,
                        matchId: matchId,
                        placement: "opponent2",
                        tournamentImage: tournament.tournamentImage,
                        tour: tourName,
                        teamId: participant2.id,
                        team1: {
                            name: team1.teamName,
                            players: team1.players
                        },
                        team2: {
                            name: team2.teamName,
                            players: team2.players
                        },
                    }
                    await teamCollection.updateOne({teamName: team1.teamName}, {$set: {activeLobby: activeLobbyTeam1}})
                    await teamCollection.updateOne({teamName: team2.teamName}, {$set: {activeLobby: activeLobbyTeam2}})
                }).catch(e => {
                    console.log("Hata", e);
                    return res.sendStatus(500)
                })
                console.log(team1, team2, allowedParticipants)
            }
        }
        return res.sendStatus(200);
    } catch (e) {
        console.log(e)
        res.sendStatus(500);
    }
})

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
            if (tournament.bracket[tourIndex].seeds[i].teams.length < 2) {
                continue;
            }
            await tournamentCollection.findOneAndUpdate({tournamentId: tournamentId}, {
                $set: {
                    [`bracket.${tourIndex}.seeds.${i}.status`]: "Oynanıyor"
                },
            })
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
        const tournamentName = wonTeam.activeLobby.tournamentName;
        const tourIndex = wonTeam.activeLobby.tourIndex;
        const nextTourIndex = tourIndex + 1;
        tournamentCollection.findOne({name: wonTeam.activeLobby.tournamentName}).then(async tournament => {
            const seedIndex = tournament.bracket[tourIndex].seeds.findIndex(({id}) => id === wonTeam.activeLobby.matchId);
            const wonTeamIndex = tournament.bracket[tourIndex].seeds[seedIndex].teams.findIndex(({name}) => name === wonTeam.teamName);
            const lostTeamIndex = tournament.bracket[tourIndex].seeds[seedIndex].teams.findIndex(({name}) => name === lostTeam.teamName);

            await tournamentCollection.findOneAndUpdate({name: tournamentName}, {
                $set: {
                    [`bracket.${tourIndex}.seeds.${seedIndex}.teams.${wonTeamIndex}.wonMatch`]: 1,
                    [`bracket.${tourIndex}.seeds.${seedIndex}.teams.${lostTeamIndex}.wonMatch`]: 0,
                    [`bracket.${tourIndex}.seeds.${seedIndex}.status`]: "Biti"
                },
            })
            if (wonTeam.activeLobby.nextMatchId) {
                const nextSeedIndex = tournament.bracket[nextTourIndex].seeds.findIndex(({id}) => id === wonTeam.activeLobby.nextMatchId);
                await tournamentCollection.findOneAndUpdate({name: wonTeam.activeLobby.tournamentName}, {
                    $push: {
                        [`bracket.${nextTourIndex}.seeds.${nextSeedIndex}.teams`]: {
                            name: wonTeam.teamName,
                            id: wonTeam._id.toString()
                        }
                    }
                })
            }
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
