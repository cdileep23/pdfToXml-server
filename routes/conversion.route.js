import express from "express"
import MiddlewareAuth from "../MiddleWare/auth.js";
import { createConversion } from "../controllers/conversion.controller.js";
const router=express.Router();

router.route('/create-conversion').post(MiddlewareAuth,createConversion);


export default router