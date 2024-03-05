import express, {response} from "express"

export const userRouter = express.Router();


userRouter.get("/get", (req, res) => {
    res.json({message: "allah"}).status(200)
})