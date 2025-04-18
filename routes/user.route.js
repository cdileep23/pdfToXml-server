import express from "express"
import { getUserProfile, Login, logout, Register, updateProfile } from "../controllers/user.controller.js"
import MiddlewareAuth from "../MiddleWare/auth.js"

const router=express.Router()

router.route('/register').post(Register)
router.route('/login').post(Login)
router.route('/logout').get(MiddlewareAuth,logout)
router.route('/profile').get(MiddlewareAuth,getUserProfile)
router.route('/profile').put(MiddlewareAuth,updateProfile)


export default router
