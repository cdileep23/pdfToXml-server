import express from "express"
import dotenv from "dotenv"
import connectDB from "./db.js";
import cookieParser from "cookie-parser";
import userRouter from "./routes/user.route.js"
import conversionRouter from "./routes/conversion.route.js"
import  cors from "cors"
import fileUpload from 'express-fileupload'; 

import http from "http"
import { Server } from "socket.io";
dotenv.config({})


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  
  socket.on('join-room', (userId) => {
  
    socket.join(userId);
    console.log(`Socket ${socket.id} joined room ${userId}`);
   
  });

 
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});


app.set('io', io)

app.use(fileUpload()); 
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
server.listen(process.env.PORT,()=>{
    connectDB();
    console.log(`Server started At ${process.env.PORT}`)
})



