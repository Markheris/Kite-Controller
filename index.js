import express from "express";
import https from "https";
import http from "http";
import cors from "cors";
import {Server} from "socket.io"
import {userRouter} from "./routes/user.js"
import {teamRouter} from "./routes/team.js"
import {notificationRouter} from "./routes/notification.js"
import cookieParser from "cookie-parser";
import fs from "fs";
import {dbClient} from "./config/db.js";
import {tournamentRouter} from "./routes/tournament.js";
import {rsoRouter} from "./routes/rso.js";
import {tournamentProviderRouter} from "./routes/tournamentProvider.js";

const app = express();


let server;
let origin


if (process.env.NODE_ENV === 'production') {
    const options = {
        key: fs.readFileSync("/etc/letsencrypt/live/api.kitetournaments.com/privkey.pem"),
        cert: fs.readFileSync("/etc/letsencrypt/live/api.kitetournaments.com/cert.pem"),
        ca: fs.readFileSync("/etc/letsencrypt/live/api.kitetournaments.com/chain.pem"),
    }
    server = https.createServer(options, app);
    origin = "*"
    console.log("production")
} else {
    server = http.createServer(app)
    origin = "http://localhost:3000"
    console.log("dev");
}


const io = new Server(server, {
    cors: {origin: origin}
})

app.use(express.json())
app.use(cors({
    credentials: true,
    origin: origin
}))
app.use(cookieParser());
app.use(express.urlencoded({extended: false}));

app.get("/", (req, res) => {
    res.json({message: "Merhaba Dünya"}).status(200)
})

app.get("/.well-known/acme-challenge/JI50X1Qfpss_1CubOPZ_O6h7xDQDaXpguJOYxUThdQM", (req, res) => {
    res.send('JI50X1Qfpss_1CubOPZ_O6h7xDQDaXpguJOYxUThdQM.usEDMBAU7Dg7lFnM6uYI8E3GnVM5_B9NoUbkBYZ8SwI')
})


const usersMap = {};


const monitoringConnectedUsers = (connectedUsers) => {
    const date = new Date();
    const hour = date.getHours();
    const min = date.getMinutes();
    console.log(connectedUsers);
    console.log(hour + ":" + min, "Kite OAL™ Connected Users:", connectedUsers.length);
}


io.on("connection", socket => {
    console.log("Connected a user")
    let oldTeamId;
    socket.on("userId", (clientUserId, clientTeamId) => {
        const socketId = socket.id
        if (usersMap[socketId]) {
            usersMap[socketId].clientTeamId = clientTeamId
            usersMap[socketId].clientUserId = clientUserId
        } else {
            usersMap[socketId] = {clientUserId, clientTeamId}
        }
        socket.join(clientUserId);
        if (clientTeamId) {
            socket.join(clientTeamId);
            oldTeamId = clientTeamId;
        } else {
            socket.leave(oldTeamId);
        }
        console.log(usersMap);
        console.log(Object.keys(usersMap).length);

        // console.log(users[clientUserId].clientTeamId);
    })
    socket.on("disconnect", () => {
        console.log("dc user")
        delete usersMap[socket.id]
        console.log(Object.keys(usersMap).length);
    })
})
export var dbc;

dbClient().then(client => {
    dbc = client;
    app.use('/api/user', userRouter);
    app.use('/api/team', teamRouter);
    app.use("/api/tournament", tournamentRouter)
    app.use("/api/tournament-provider", tournamentProviderRouter)
    app.use('/api/notification', notificationRouter)
    app.use('/api/rso', rsoRouter)

    const userCollection = client.collection("users");
    const teamCollection = client.collection("teams");
    const tournamentCollection = client.collection("tournaments");
    const userChangeStream = userCollection.watch([], {
        fullDocument: "updateLookup"
    })
    const teamChangeStream = teamCollection.watch([], {
        fullDocument: "updateLookup"
    })
    var filter = [{
        $match: {"updateDescription.updatedFields.bracket": {$exists: true}}
    }];
    const tournamentStream = tournamentCollection.watch([], {
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
            io.to(changedTeamId).emit("teamChange", updatedTeamData)
        }
    })

    tournamentStream.on("change", (updatedTournamentData) => {
        if (updatedTournamentData.fullDocument) {
            io.emit("tournamentChange", updatedTournamentData);
        }
    })

    process.on("exit", () => {
        client.client.close();
    })
})

if (process.env.NODE_ENV === 'production') {
    server.listen(443, () => {
        console.log("Listening on *:443");
    })
} else {
    server.listen(443, () => {
        console.log("Listening on *:80");
    })
}

