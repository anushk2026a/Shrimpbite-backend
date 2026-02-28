import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import AppUser from "../models/AppUser.js";

const router = express.Router();

router.post("/register", async (req, res) => {
    try {
        const { fullName, username, email, phoneNumber, password, confirmPassword } = req.body;

        if (!fullName || !phoneNumber || !password || !confirmPassword) {
            return res.status(400).json({ success: false, message: "All required fields must be filled" });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }

        const existingUser = await AppUser.findOne({
            $or: [{ email }, { username }, { phoneNumber }],
        });

        if (existingUser) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await AppUser.create({
            fullName,
            username,
            email,
            phoneNumber,
            password: hashedPassword,
        });

        const token = jwt.sign(
            { id: newUser._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            token,
            data: {
                id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                username: newUser.username,
                phoneNumber: newUser.phoneNumber,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { identifier, password } = req.body;
        // identifier = email OR username

        if (!identifier || !password) {
            return res.status(400).json({ success: false, message: "All fields required" });
        }

        const user = await AppUser.findOne({
            $or: [{ email: identifier }, { username: identifier }],
        });

        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            data: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                username: user.username,
                phoneNumber: user.phoneNumber,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

export default router;

