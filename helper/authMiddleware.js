import jwt from "jsonwebtoken";

export async function authMiddleware(req, res, next) {
    const token = await req.cookies.token;
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