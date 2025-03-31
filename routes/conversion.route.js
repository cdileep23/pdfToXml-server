import express from "express"
import MiddlewareAuth from "../MiddleWare/auth.js";
import { createConversion, getAllConversions, getConversionById, removeConversionById } from "../controllers/conversion.controller.js";
const router=express.Router();

router.route('/create-conversion').post(MiddlewareAuth,createConversion);

router.route('/all-conversions').get(MiddlewareAuth,getAllConversions)
router.route('/get-conversion/:conversionId').get(MiddlewareAuth,getConversionById)
router.route('/delete-conversion/:conversionId').delete(MiddlewareAuth,removeConversionById)
export default router