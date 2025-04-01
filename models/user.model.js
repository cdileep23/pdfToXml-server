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
    PhotoUrl:{
      type:String,
      default:"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQz68b1g8MSxSUqvFtuo44MvagkdFGoG7Z7DQ&s",
     
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });
  



  const UserModel=mongoose.model("User",userSchema)
  export default UserModel