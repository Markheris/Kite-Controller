import { MongoClient } from "mongodb";
import "dotenv/config.js"

export async function dbClient() {
    return (await MongoClient.connect(process.env.MONGODB_URL)).db("kitedb")
}