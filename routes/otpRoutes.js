import express from "express";
import otpGenerator from "otp-generator";
import jwt from "jsonwebtoken";
import AppUser from "../models/AppUser.js";
import Otp from "../models/Otp.js";

const router = express.Router();

// send otp
router.post("/send", async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) return res.status(400).json({ success: false, message: "Phone number is required" });

        // Generate 6 digit OTP
        const otpCode = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            specialChars: false,
            lowerCaseAlphabets: false
        });

        // Expiry 5 minutes
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // Save/Update OTP in DB
        await Otp.findOneAndUpdate(
            { phoneNumber },
            { otp: otpCode, expiresAt },
            { upsert: true, new: true }
        );

        console.log(`[OTP] for ${phoneNumber}: ${otpCode}`);

        console.log(`[OTP Skip Push] Send via SMS using Firebase Phone Auth on client side.`);

        return res.status(200).json({
            success: true,
            message: "OTP generation requested. Please use Firebase Phone Auth on the client to send SMS.",
            otp: otpCode // Still returning for dev testing if needed
        });
    } catch (error) {
        console.error("otp send error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

// verify otp
router.post("/verify", async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;

        if (!phoneNumber || !otp) {
            return res.status(400).json({ success: false, message: "Phone number and OTP are required" });
        }

        const otpRecord = await Otp.findOne({ phoneNumber });

        if (!otpRecord) {
            return res.status(400).json({ success: false, message: "No OTP found for this number" });
        }

        if (otpRecord.otp !== otp) {
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }

        if (otpRecord.expiresAt < new Date()) {
            return res.status(400).json({ success: false, message: "OTP expired" });
        }

        // OTP is valid!
        // Mark user as verified
        const user = await AppUser.findOneAndUpdate(
            { phoneNumber },
            { isVerified: true },
            { new: true }
        );

        // Delete OTP after successful verification
        await Otp.deleteOne({ phoneNumber });

        // Generate token for auto-login
        let token = null;
        if (user) {
            token = jwt.sign({ id: user._id, role: "customer" }, process.env.JWT_SECRET, { expiresIn: "7d" });
        }

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully. User is now verified.",
            isVerified: user ? user.isVerified : false,
            token,
            data: user ? {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: "customer"
            } : null
        });
    } catch (error) {
        console.error("otp verify error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

// Verify Firebase ID Token (Phone Auth)
router.post("/verify-firebase", async (req, res) => {
    try {
        const { idToken, phoneNumber } = req.body;

        if (!idToken) {
            return res.status(400).json({ success: false, message: "ID Token is required" });
        }

        const admin = (await import("../config/firebase.js")).default;
        
        // Verify Firebase Token
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch (error) {
            console.error("Firebase token verification failed:", error.message);
            return res.status(401).json({ success: false, message: "Invalid or expired Firebase token" });
        }

        // The phone_number in the token should match or we use it directly
        const verifiedPhone = decodedToken.phone_number;
        
        if (!verifiedPhone) {
            return res.status(400).json({ success: false, message: "Phone number not found in Firebase token" });
        }

        // Phone numbers from Firebase usually include +xx, ensure consistency
        // In this project, phone numbers are stored as typed by user, usually including country code in some cases.
        // We find by exact match or normalized. For now, exact match with verified phone.
        let user = await AppUser.findOne({ 
            $or: [{ phoneNumber: verifiedPhone }, { phoneNumber: phoneNumber }] 
        });

        if (user) {
            user.isVerified = true;
            await user.save();
        }

        // Generate Shrimpbite JWT
        let token = null;
        if (user) {
            token = jwt.sign({ id: user._id, role: "customer" }, process.env.JWT_SECRET, { expiresIn: "7d" });
        }

        return res.status(200).json({
            success: true,
            message: "Firebase Phone verified successfully.",
            isVerified: true,
            token,
            data: user ? {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: "customer"
            } : null
        });

    } catch (error) {
        console.error("verify-firebase error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});

export default router;