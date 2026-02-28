import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import AppUser from "../models/AppUser.js";
import protectAppUser from "../middleware/appAuthMiddleware.js";
const router = express.Router();

//register

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

//login
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

//get profile
router.get("/profile", protectAppUser, async (req, res) => {
    res.status(200).json({
        success: true,
        data: req.user
    });
});

//update profile
router.put("/profile", protectAppUser, async (req, res) => {
    try {
        const { fullName, username, email, phoneNumber } = req.body;

        const user = await AppUser.findById(req.user._id);

        if (!user) return res.status(404).json({ message: "User not found" });

        user.fullName = fullName || user.fullName;
        user.username = username || user.username;
        user.email = email || user.email;
        user.phoneNumber = phoneNumber || user.phoneNumber;

        await user.save();

        res.status(200).json({
            message: "Profile updated",
            user,
        });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});
//change password
router.put("/change-password", protectAppUser, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await AppUser.findById(req.user._id);

        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: "Current password incorrect" });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.status(200).json({ message: "Password changed successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});
//forgot password
router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;

    const user = await AppUser.findOne({ email });

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    // Later: generate reset token + send email

    res.status(200).json({
        message: "Password reset flow to be implemented",
    });
});

// Add Address
router.post("/address", protectAppUser, async (req, res) => {
    const user = await AppUser.findById(req.user._id);

    user.addresses.push(req.body);

    await user.save();

    res.status(201).json({
        message: "Address added",
        addresses: user.addresses,
    });
});
// get address
router.get("/address", protectAppUser, async (req, res) => {
    const user = await AppUser.findById(req.user._id);

    res.status(200).json(user.addresses);
});
// delete address
router.delete("/address/:id", protectAppUser, async (req, res) => {
    const user = await AppUser.findById(req.user._id);

    user.addresses = user.addresses.filter(
        (addr) => addr._id.toString() !== req.params.id
    );

    await user.save();

    res.status(200).json({
        message: "Address removed",
        addresses: user.addresses,
    });
});
export default router;