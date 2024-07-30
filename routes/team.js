import {Router} from "express";
import {authMiddleware} from "../helper/authMiddleware.js";
import {ObjectId} from "mongodb";
import {dbc} from "../index.js";

export const teamRouter = Router();


teamRouter.post("/create", authMiddleware, async (req, res) => {
    try {
        const teamCollection = dbc.collection("teams");
        const userCollection = dbc.collection("users");
        const {name} = req.body
        const playerId = req.userId;
        const team = await teamCollection.findOne({name: name});
        const user = await userCollection.findOne({_id: new ObjectId(playerId)})
        if (!user.puuid) {
            return res.status(200).json({status: false, message: "Hesaplarını bağlamadan takım oluşturamazsın"})
        }
        if (user.team) {
            return res.status(200).json({status: false, message: "Zaten takımın var"})
        }
        if (team) {
            return res.status(200).json({status: false, message: "Bu takım ismi kullanılıyor"})
        }
        const teamData = {
            name: name,
            players: [{
                playerId: playerId,
                captain: true
            }],
        }
        await teamCollection.insertOne(teamData).then(async team => {
            await userCollection.findOneAndUpdate({_id: new ObjectId(playerId)}, {
                $set: {team: team.insertedId.toString()}
            }, {
                returnOriginal: false
            });
            res.status(200).json({message: "Başarıyla oluşturuldu", status: true, team});
        })
    } catch (error) {
        console.log(error);
        return res.sendStatus(500);
    }
})
teamRouter.get("/get", authMiddleware, async (req, res) => {
    try {
        let teamPlayersData = [];
        const teamCollection = dbc.collection("teams");
        const userCollection = dbc.collection("users");
        const userId = req.userId;
        const user = await userCollection.findOne({_id: new ObjectId(userId)})
        const team = await teamCollection.findOne({_id: new ObjectId(user.team)});
        if (!team) {
            return res.status(404).json({status: false, error: "Takım bulunamadı"})
        }
        for (let i = 0; i < team.players.length; i++) {
            const userData = await userCollection.findOne({_id: new ObjectId(team.players[i].playerId)}, {
                projection: {
                    _id: 1,
                    password: 0,
                    notifications: 0,
                    kiteBalance: 0,
                    fateBalance: 0,
                    analytics: 0,
                    isVerified: 0,
                    isAdmin: 0,
                }
            })
            const teamPlayerData = {...userData, captain: team.players[i].captain}
            teamPlayersData.push(teamPlayerData);
        }
        const teamData = {...team, players: teamPlayersData}
        return res.status(200).json({status: true, data: teamData})
    } catch (e) {
        return res.sendStatus(500);
    }
})
teamRouter.post("/join", authMiddleware, async (req, res) => {
    try {
        const playerData = {
            playerId: req.userId,
            captain: false
        }

        const teamCollection = dbc.collection("teams");
        const userCollection = dbc.collection("users");

        const user = await userCollection.findOne({_id: new ObjectId(req.userId)})
        if (user.team) {
            await userCollection.findOneAndUpdate({_id: new ObjectId(req.userId)}, {$pull: {notifications: {teamId: req.body.teamId}}})
            return res.status(200).json({status: false, error: "Zaten takımın var"})
        }
        teamCollection.findOne({_id: new ObjectId(req.body.teamId)}).then(async team => {
            if (team.players.length >= 5) {
                await userCollection.findOneAndUpdate({_id: new ObjectId(req.userId)}, {$pull: {notifications: {teamId: req.body.teamId}}})
                return res.status(200).json({status: false, error: "Katılmak istediğin takım dolu"})
            }
            await userCollection.findOneAndUpdate({_id: new ObjectId(req.userId)}, {$set: {team: new ObjectId(req.body.teamId).toString()}}).then(async () => {
                await teamCollection.findOneAndUpdate({_id: new ObjectId(req.body.teamId)}, {$push: {players: playerData}}).then(async (team) => {
                    team.update
                    await userCollection.findOneAndUpdate({_id: new ObjectId(req.userId)}, {$pull: {notifications: {teamId: req.body.teamId}}})
                    return res.status(200).json({status: true, message: "Takıma katıldın!"})
                }).catch((e) => {
                    console.log(e)
                    return res.sendStatus(500);
                })
            }).catch((e) => {
                console.log(e);
                res.sendStatus(500);
            })
        })
    } catch (error) {
        console.log(error);
        res.sendStatus(500)
    }
})
teamRouter.post("/delete", authMiddleware, async (req, res) => {
    const teamCollection = dbc.collection("teams");
    const userCollection = dbc.collection("users")
    const tournamentCollection = dbc.collection("tournaments");

    try {
        const {teamId} = req.body;
        const team = await teamCollection.findOne({_id: new ObjectId(teamId)})
        const captain = team.players.find(({captain}) => captain === true);
        console.log(captain);
        if (req.userId !== captain.playerId) {
            return res.sendStatus(401);
        }
        console.log(team)
        if (!team) {
            return res.status(200).json({status: false, error: "Takım bulunamadı"})
        }
        userCollection.updateMany({team: teamId}, {$set: {team: null}}).then(async () => {
            setTimeout(async () => {
                await teamCollection.deleteOne({_id: new ObjectId(teamId)})
                if (team.registeredTournament)
                    await tournamentCollection.findOneAndUpdate({tournamentId: team.registeredTournament.tournamentId}, {$pull: {registeredTeams: {id: new ObjectId(team._id)}}})
            }, 500)
            return res.status(200).json({status: true, message: "Takım silindi"})
        })
    } catch (e) {
        return res.sendStatus(500)
    }
})
teamRouter.post("/adminDelete", authMiddleware, async (req, res) => {
    const teamCollection = dbc.collection("teams");
    const userCollection = dbc.collection("users")
    const tournamentCollection = dbc.collection("tournaments");
    try {
        const {teamId} = req.body;
        const adminUser = await userCollection.findOne({_id: new ObjectId(req.userId)});
        if (!(adminUser.isAdmin)) {
            return res.sendStatus(403);
        }
        const team = await teamCollection.findOne({_id: new ObjectId(teamId)})
        if (!team) {
            return res.status(200).json({status: false, error: "Takım bulunamadı"})
        }
        userCollection.updateMany({team: teamId}, {$set: {team: null}}).then(async () => {
            setTimeout(async () => {
                await teamCollection.deleteOne({_id: new ObjectId(teamId)})
                if (team.registeredTournament) {
                    await tournamentCollection.findOneAndUpdate({tournamentId: team.registeredTournament.tournamentId}, {$pull: {registeredTeams: {id: new ObjectId(team._id)}}})
                }
            }, 500)
            return res.status(200).json({status: true, message: "Takım silindi"})
        })
    } catch (e) {
        return res.sendStatus(500)
    }
})
teamRouter.post("/leave", authMiddleware, async (req, res) => {
    const teamCollection = dbc.collection("teams");
    const userCollection = dbc.collection("users");
    const tournamentCollection = dbc.collection("tournaments");
    try {
        const {userId, teamId} = req.body;
        const team = await teamCollection.findOne({_id: new ObjectId(teamId)});

        userCollection.findOneAndUpdate({_id: new ObjectId(userId)}, {$set: {team: null}}).then(user => {
            setTimeout(() => {
                teamCollection.findOneAndUpdate({_id: new ObjectId(teamId)}, {$pull: {players: {playerId: userId}}}).then(async team => {
                    if (team.registeredTournament) {
                        await tournamentCollection.findOneAndUpdate({tournamentId: team.registeredTournament.tournamentId}, {$pull: {registeredTeams: {id: new ObjectId(team._id)}}}).then(async () => {
                            await teamCollection.findOneAndUpdate({_id: new ObjectId(teamId)}, {$set: {registeredTournament: {}}})
                        })
                    }
                    console.log(userId, teamId)
                    return res.status(200).json({status: true, message: "Başarılı"})
                }).catch((e) => {
                    console.log(e);
                    return res.status(200).json({status: false, error: "Takım Bulunamadı"})
                })
            }, 500)
        }).catch(e => {
            console.log(e);
            return res.status(200).json({status: false, error: "Oyuncu Bulunamadı"})
        })
    } catch (error) {
        console.log(error)
        return res.sendStatus(500);
    }
})