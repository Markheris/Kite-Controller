import {Router} from "express";
import {authMiddleware} from "../helper/authMiddleware.js";
import {ObjectId} from "mongodb";
import {dbc} from "../index.js";

export const teamRouter = Router();


teamRouter.post("/create", authMiddleware, async (req, res) => {
    try {
        const teamCollection = dbc.collection("teams");
        const userCollection = dbc.collection("users");
        const {teamName} = req.body
        const playerId = req.userId;
        const team = await teamCollection.findOne({teamName: teamName});
        const user = await userCollection.findOne({_id: new ObjectId(playerId)})
        if (user.team) {
            return res.status(200).json({status: false, error: "Zaten takımın var"})
        }
        if (team) {
            return res.status(200).json({status: false, error: "Bu takım ismi kullanılıyor"})
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
            await userCollection.findOneAndUpdate({_id: new ObjectId(playerId)}, {$set: {team: team.insertedId.toString()}}, {
                returnOriginal: false
            });
            res.status(200).json({message: "Başarıyla oluşturuldu", status: true, team});
        })
    } catch (error) {
        console.log(error);
        return res.sendStatus(500);
    }
})

teamRouter.post("/get", authMiddleware, async (req, res) => {
    try {
        let teamPlayersData = [];
        const teamCollection = dbc.collection("teams");
        const userCollection = dbc.collection("users");
        const {teamId} = req.body
        const team = await teamCollection.findOne({_id: new ObjectId(teamId)});
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
        return NextResponse.json({error: e.message}, {status: 500})
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

            return res.status(200).json({status: false, error: "Zaten takımın var"})

        }
        await userCollection.findOneAndUpdate({_id: new ObjectId(req.userId)}, {$set: {team: new ObjectId(req.body.teamId).toString()}}).then(async () => {

            await teamCollection.findOneAndUpdate({_id: new ObjectId(req.body.teamId)}, {$push: {players: playerData}}).then(async () => {

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
    } catch (error) {
        console.log(error);
        res.statusCode(500)
    }
})

teamRouter.post("/leave", authMiddleware, async (req, res) => {
    const teamCollection = dbc.collection("teams");
    const userCollection = dbc.collection("users");
    try {
        const {userId, teamId} = req.body;
        userCollection.findOneAndUpdate({_id: new ObjectId(userId)}, {$set: {team: null}}).then(user => {
            setTimeout(() => {
                teamCollection.findOneAndUpdate({_id: new ObjectId(teamId)}, {$pull: {players: {playerId: userId}}}).then(team => {
                    console.log(userId, teamId)
                    res.status(200).json({status: true, message: "Başarılı"})
                }).catch((e) => {
                    console.log(e);
                    res.status(200).json({status: false, error: "Takım Bulunamadı"})
                })
            }, 500)
        }).catch(e => {
            console.log(e);
            res.status(200).json({status: false, error: "Oyuncu Bulunamadı"})
        })
    } catch (error) {
        console.log(error)
        res.statusCode(500);
    }
})