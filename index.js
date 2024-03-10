import express from "express";

const app = express();
import https from "https";
import http from "http";

let server;
let origin


if (process.env.NODE_ENV === 'production') {
    const options = {
        key: fs.readFileSync("/etc/letsencrypt/live/api.kitetournaments.com/privkey.pem"),
        cert: fs.readFileSync("/etc/letsencrypt/live/api.kitetournaments.com/cert.pem"),
        ca: fs.readFileSync("/etc/letsencrypt/live/api.kitetournaments.com/chain.pem"),
    }
    server = https.createServer(options, app);
    origin = "https://kitetournaments.com"
    console.log("production")
} else {
    server = http.createServer(app)
    origin = "http://localhost:3000"
    console.log("dev");
}


import cors from "cors";
import { Server } from "socket.io"
import { userRouter } from "./routes/user.js"
import { teamRouter } from "./routes/team.js"
import { notificationRouter } from "./routes/notification.js"
import cookieParser from "cookie-parser";
import fs from "fs";
import { dbClient } from "./config/db.js";
import { tournamentRouter } from "./routes/tournament.js";

const io = new Server(server, {
    cors: { origin: origin }
})

app.use(express.json())
app.use(cors({
    credentials: true,
    origin: origin
}))
app.use(cookieParser());

app.get("/", (req, res) => {
    res.json({ message: "Merhaba Dünya" }).status(200)
})


const connectedUsers = [];

const monitoringConnectedUsers = (connectedUsers) => {
    const date = new Date();
    const hour = date.getHours();
    const min = date.getMinutes();
    console.log(connectedUsers);
    console.log(hour + ":" + min, "Kite OAL™ Connected Users:", connectedUsers.length);
}
io.on("connection", socket => {
    console.log("Connected a user")
    socket.on("userData", (clientUserId, clientTeamId) => {
        socket.join([clientUserId, clientTeamId]);
        connectedUsers.push({ clientUserId: clientUserId, clientTeamId: clientTeamId, socketId: socket.id });
        for (let i = 0; i < connectedUsers.length; i++) {
            if (clientUserId === connectedUsers[i].clientUserId) {
                connectedUsers[i].clientTeamId = clientTeamId;
            }
        }
        monitoringConnectedUsers(connectedUsers)
    })
    socket.on("disconnect", () => {
        console.log("disconnected", socket.id);
        for (let i = 0; i < connectedUsers.length; i++)
            if (connectedUsers[i].socketId === socket.id) {
                connectedUsers.splice(i, 1);
            }
        monitoringConnectedUsers(connectedUsers)
    })
})

export var dbc;

dbClient().then(client => {
    dbc = client;
    app.use('/api/user', userRouter);
    app.use('/api/team', teamRouter);
    app.use("/api/tournament", tournamentRouter)
    app.use('/api/notification', notificationRouter)
    const userCollection = client.collection("users");
    const teamCollection = client.collection("teams");
    const userChangeStream = userCollection.watch([], {
        fullDocument: "updateLookup"
    })
    const teamChangeStream = teamCollection.watch([], {
        fullDocument: "updateLookup"
    })

    userChangeStream.on("change", (updatedUserData) => {
        if (updatedUserData.fullDocument) {
            const changedUserId = updatedUserData.fullDocument._id.toString();
            io.to(changedUserId).emit("userChange", updatedUserData)
        }
    })

    teamChangeStream.on("change", (updatedTeamData) => {
        if (updatedTeamData.fullDocument) {
            const changedTeamId = updatedTeamData.fullDocument._id.toString();
            for (let i = 0; i < connectedUsers.length; i++) {
                if (changedTeamId === connectedUsers[i].clientTeamId) {
                    io.to(connectedUsers[i].socketId).emit(connectedUsers[i].clientTeamId, updatedTeamData)
                }
            }
        }
    })

    process.on("exit", () => {
        client.client.close();
    })
})


server.listen(443, () => {
    console.log("Listening on *:443");
})
