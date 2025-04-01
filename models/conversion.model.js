import mongoose from "mongoose";

const conversionSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    pdfLink: {
      type: String,
      required: true
    },
    xmlContent: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    originalFilename: {
      type: String,
      required: true
    },pdfPages:{
      type:Number,
    
    }
  });
  

  conversionSchema.index({ userId: 1 });  
  conversionSchema.index({ createdAt: -1 });  

  export const conversionModel=mongoose.model('Conversion',conversionSchema)


