import jwt from "jsonwebtoken";

export async function authMiddleware(req, res, next) {
    const authorizationHeader = req.header("Authorization")

    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
        return res
            .status(401)
            .json({ success: false, message: "Invalid authorization header" });
    }
    const token = await req.headers.authorization.split(" ")[1];
    if (!token) {
        return res
            .status(401)
            .json({ success: false, message: "Authorization token not found" });
    }
    try {
        const decodedToken = jwt.verify(token, process.env.TOKEN_SECRET);
        req.userId = decodedToken.id;
        next();
    } catch (error) {
        console.error(error);
        return res.status(401).clearCookie("token").json({ success: false, message: "Invalid token" });
    }
}