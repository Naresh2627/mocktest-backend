import jwt from "jsonwebtoken"; 
import dotenv from "dotenv";
dotenv.config();


export function authenticationtoken(req, res, next){
    const authheader = req.headers['authorization'];
    const token = authheader && authheader.split(" ")[1];

    if(!token) return res.status(401).json({message: "token not found"});

    jwt.verify(token, process.env.JWT_SECRET_KEY, (error,user)=>{
        if(error) return res.status(401).json({message:"invalid or expired token"});
        req.user = user;
        next();
    });
};