import mongoose from "mongoose";
const userSchema = new mongoose.Schema({
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
   
    },
    name: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });
  

  userSchema.index({ email: 1 });

  const UserModel=mongoose.model("User",userSchema)
  export default UserModel