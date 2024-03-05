import express from "express";
const app = express();

const options = {
    key: fs.readFileSync("/etc/letsencrypt/live/api.kitetournaments.com/privkey.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/api.kitetournaments.com/cert.pem"),
    ca: fs.readFileSync("/etc/letsencrypt/live/api.kitetournaments.com/chain.pem"),
}

import cors from "cors";
import https from "https";
const server = https.createServer(options, app)
import {Server} from "socket.io"
import {userRouter} from "./routes/user.js"
import fs from "fs";


const io = new Server(server, {
    cors: {origin: "*"}
})

app.use(express.json())
app.use(cors({
    origin: "*"
}))

app.use('/api/user', userRouter);

app.get("/", (req,res) => {
    res.json({message: "Merhaba Dünya"}).status(200)
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