import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import validator from "validator";
import UserModel from "../models/user.model.js";

export const Register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if all fields are provided
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "All Fields Are Required" });
    }
    
    // Validate email format
    if (!validator.isEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide a valid email address" });
    }
    
    // Validate password strength
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
    
    // Check if user already exists
    const userExists = await UserModel.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this Email ID",
      });
    }
    
    // Hash password and create user
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