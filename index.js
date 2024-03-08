import express from "express";
const app = express();
import https from "https";
import http from "http";

let server;
let origin


if (process.env.NODE_ENV == 'production') {
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
app.use('/api/user', userRouter);
app.use('/api/team', teamRouter);
app.use("/api/tournament", tournamentRouter)
app.use('/api/notification', notificationRouter)
app.get("/", (req, res) => {
    res.json({ message: "Merhaba Dünya" }).status(200)
})



let connectedUsers = [];

const monitoringConnectedUsers = (connectedUsers) => {
    console.log("Kite OAL™ Connected Users:", connectedUsers.length);
    console.log(connectedUsers);
}
io.on("connection", socket => {
    socket.on("userData", (clientUserId, clientTeamId) => {
        socket.join(clientUserId);
        connectedUsers.push({ clientUserId: clientUserId, clientTeamId: clientTeamId, socketId: socket.id });
        monitoringConnectedUsers(connectedUsers)
    })
    socket.on("disconnect", () => {
        console.log("disconnected", socket.id);
        const disconnectUserIndex = connectedUsers.findIndex(object => {
            return object.socketId === socket.id;
        })
        connectedUsers.splice(disconnectUserIndex, 1);
        monitoringConnectedUsers(connectedUsers)

    })
})

export var dbc;

dbClient().then(client => {
    dbc = client;
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
            for (let i = 0; i < connectedUsers.length; i++) {
                if (changedUserId === connectedUsers[i].clientUserId) {
                    io.to(connectedUsers[i].socketId).emit(connectedUsers[i].clientUserId, updatedUserData)
                }
            }
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
})






server.listen(443, () => {
    console.log("Listening on *:443");
})




//
//
// import "dotenv/config.js"
// import {MongoClient} from "mongodb"
//
// // Replace the uri string with your connection string.
// const uri = "mongodb+srv://master:Mentol123menh@heaven-community.7ku6epc.mongodb.net";
//
// const client = new MongoClient(process.env.MONGODB_URI);
//
// async function run() {
//     try {
//         const database = client.db('kitedb');
//         const movies = database.collection('users');
//
//         // Query for a movie that has the title 'Back to the Future'
//         const query = { email: 'efe@gmail.com' };
//         const movie = await movies.findOne(query);
//
//         console.log(movie);
//     } finally {
//         // Ensures that the client will close when you finish/error
//         await client.close();
//     }
// }
// run().catch(console.dir);