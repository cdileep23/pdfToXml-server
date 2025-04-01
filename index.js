import express from "express"
import dotenv from "dotenv"
import connectDB from "./db.js";
import cookieParser from "cookie-parser";
import userRouter from "./routes/user.route.js"
import conversionRouter from "./routes/conversion.route.js"
import  cors from "cors"
import fileUpload from 'express-fileupload'; 


dotenv.config({})


const app=express();
app.use(fileUpload()); // This enables file handling
app.use(express.urlencoded({ extended: true }));

app.use(express.json())
app.use(cookieParser())


const allowedOrigin =
    process.env.NODE_ENV === "production"
        ? "https://pafto-xml-client.vercel.app"
        : "http://localhost:5173"; 

app.use(cors({
    origin: allowedOrigin,
    credentials: true
}));

app.get("/",(req,res)=>{
    res.send("hello from campusReady")
})
app.use('/user',userRouter)

app.use('/conversion',conversionRouter)
app.listen(process.env.PORT,()=>{
    connectDB();
    console.log(`Server started At ${process.env.PORT}`)
})



