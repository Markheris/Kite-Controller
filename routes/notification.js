import {Router} from "express";
import {authMiddleware} from "../helper/authMiddleware.js";
import {dbc} from "../index.js";
import {ObjectId} from "mongodb";

export const notificationRouter = Router();

export async function sendTeamInviteNotification(teamId, teamName, sender, gameName, tagLine) {
    const notificationData = {
        notificationType: "teamInvite",
        title: "Takım Daveti",
        message: "Haydi gel",
        teamId: teamId,
        teamName: teamName,
        sender: sender,
    }

    const userCollection = dbc.collection("users");
    const user = await userCollection.findOne({$and: [{gameName: gameName}, {tagLine: tagLine}]});
    if (user) {
        if (user.team) {
            return {
                code: 200,
                json: {
                    status: false,
                    error: "Oyuncunun takımı var"
                }
            }
        } else {
            for (let i = 0; i < user.notifications.length; i++) {
                if (sender === user.notifications[i].sender) {
                    return {
                        code: 200,
                        json: {
                            status: false,
                            error: "Bu oyuncuyu davet etmişsin"
                        }
                    }
                }
            }
            return await userCollection.findOneAndUpdate({$and: [{gameName: gameName}, {tagLine: tagLine}]}, {$push: {notifications: notificationData}}).then(() => {
                return {
                    code: 200,
                    json: {
                        status: true,
                        message: "Davet gönderildi!"
                    }
                }
            }).catch(e => {
                console.log(e);
                return 500
            })

        }
    } else {
        return {
            code: 200,
            json: {
                status: false,
                error: "Oyuncu bulunamadı"
            }
        }
    }
}

notificationRouter.post("/send", authMiddleware, async (req, res) => {
    const {notificationType} = req.body
    if (notificationType === "teamInvite") {
        const {gameName, tagLine, teamName, teamId, sender} = req.body
        sendTeamInviteNotification(teamId, teamName, sender, gameName, tagLine).then(response => {
            return res.status(response.code).json(response.json)
        }).catch(e => {
            return res.sendStatus(e);
        })
    }
    if (notificationType === "joinTournament") {
        const {tournamentId, teamId} = req.body;
        const tournamentCollection = dbc.collection("tournaments")
        const tournament = await tournamentCollection.findOne({tournamentId: tournamentId})
        const notificationData = {
            id: new ObjectId(),
            notificationType: "joinTournament",
            title: "Turnuva Kayıt",
            message: "Haydi gel",
            teamId: teamId,
            tournamentName: tournament.name,
            tournamentId: tournamentId,
        }

        const userCollection = dbc.collection("users");
        return userCollection.updateMany({team: teamId}, {
            $push: {
                notifications: notificationData
            }
        }).then(async () => {
            await userCollection.updateOne({_id: new ObjectId(req.userId)}, {$pull: {notifications: {tournamentId: tournamentId}}})
            return res.status(200).json({
                status: true,
                message: "Takımındaki oyunculara bildirim gönderildi"
            })
        }).catch(e => {
            console.log(e);
            return res.sendStatus(500);
        })
    }

})

notificationRouter.post("/delete", authMiddleware, async (req, res) => {
    const {notificationId} = req.body;
    const userCollection = dbc.collection("users")
    console.log(notificationId);
    try {
        await userCollection.updateOne({_id: new ObjectId(req.userId)}, {$pull: {notifications: {id: new ObjectId(notificationId)}}})
        return res.sendStatus(200);
    } catch (e) {
        return res.sendStatus(500)
    }

})