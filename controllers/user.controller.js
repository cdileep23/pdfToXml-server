import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import validator from "validator";
import UserModel from "../models/user.model.js";


import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

export const Register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
   
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "All Fields Are Required" });
    }
    
  
    if (!validator.isEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide a valid email address" });
    }
    
    
    if (!validator.isStrongPassword(password, {
      minLength: 8, 
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1
    })) {
      return res
        .status(400)
        .json({ 
          success: false, 
          message: "Password must be at least 8 characters long and contain lowercase, uppercase, number and symbol" 
        });
    }
    
   
    const userExists = await UserModel.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this Email ID",
      });
    }
    
  
    const hashPass = await bcrypt.hash(password, 10);
    
    await UserModel.create({
      name,
      email,
      password: hashPass,
    });
    
    return res
      .status(201)
      .json({ success: true, message: "Account Created Successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Failed to Register User",
    });
  }
};

export const Login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "All Fields Are Required" });
    }
    
    const userExists = await UserModel.findOne({ email });
    if (!userExists) {
      return res
        .status(400)
        .json({ success: false, message: "Incorrect Email Or Password" });
    }
    
    const isPass = await bcrypt.compare(password, userExists.password);
    
    if (!isPass) {
      return res
        .status(400)
        .json({ success: false, message: "Incorrect Email Or Password" });
    }
    
    const token = jwt.sign(
      { userId: userExists._id },
      process.env.JWT_SECRET_KEY,
      {
        expiresIn: "1d",
      }
    );
    return res
      .status(200)
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000,
      })
      .json({
        success: true,
        message: `Welcome Back to PDF TO XML ${userExists.name}`,
        user: userExists
      });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Failed to Login User",
    });
  }
};

export const logout = async(req, res) => {
  try {
    return res.status(200).cookie("token", "", {maxAge: 0}).json({
      success: true,
      message: "Logged Out Successfully"
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Failed to Logout User",
    });
  }
};

export const getUserProfile = async(req, res) => {
  try {
    const userId = req.id;
    const userExists = await UserModel.findById(userId);
    if(!userExists) {
      return res.status(400).json({
        success: false,
        message: "User Not Found"
      });
    }
    
    return res.status(200).json({
      success: true,
      message: "Fetched User Profile",
      user: userExists
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.id;
    const { name } = req.body;
    
    // Find the user
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Update name if provided
    if (name) {
      user.name = name;
    }
    
    // Handle photo upload
    if (req.files && req.files.photo) {
      // Delete old photo if it exists and isn't default
      if (user.PhotoUrl && !user.PhotoUrl.includes('encrypted-tbn0.gstatic.com')) {
        try {
          const oldPhotoKey = user.PhotoUrl.split('.com/')[1];
          await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: oldPhotoKey
          }));
        } catch (error) {
          console.error("Error deleting old photo:", error);
        }
      }
      
      const uploadedPhoto = req.files.photo;
      const sanitizedName = uploadedPhoto.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const fileName = `user-photos/${uuidv4()}-${sanitizedName}`;
      
      // Upload to S3
      await s3Client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileName,
        Body: uploadedPhoto.data, // Use .data for the buffer when not using multer
        ContentType: uploadedPhoto.mimetype,
        ACL: 'public-read'
      }));
      
      user.PhotoUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    }
    
    // Save the updated user
    await user.save();
    console.log(user)
    
    // Return the updated user (excluding password)
    const updatedUser = await UserModel.findById(userId).select('-password');
    
    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update profile"
    });
  }
};

