import {Router} from "express";
import {dbc} from "../index.js";
import {authMiddleware} from "../helper/authMiddleware.js";
import {ObjectId} from "mongodb";

export const tournamentRouter = Router();

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
            const registeredTeam = tournament.registeredTeams.find(({name}) => name === team.teamName);
            if (registeredTeam) {
                if (registeredTeam.name === team.teamName) {
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
        //             name: team.teamName,
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

tournamentRouter.post("/adminChoose", authMiddleware, async (req, res) => {
    const {teamId, choose, failMessage} = req.body;
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
            await tournamentCollection.updateOne({tournamentId: team.registeredTournament.tournamentId}, {
                $push: {
                    registeredTeams: {
                        name: team.teamName,
                        id: team._id,
                    }
                }
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
            for (let j = 0; j < 2; j++) {
                if (registeredTeams.length > 0) {
                    const randomTeam = Math.floor(Math.random() * registeredTeams.length);
                    bracketTour1.seeds[i].teams[j] = {
                        name: registeredTeams[randomTeam].name,
                        id: registeredTeams[randomTeam].id.toString()
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