import https from "https";
import express from "express";
import otpGenerator from "otp-generator";
import jwt from "jsonwebtoken";
import AppUser from "../models/AppUser.js";
import User from "../models/User.js";
import Otp from "../models/Otp.js";
import { normalizePhoneNumber } from "../utils/phoneUtils.js";

const router = express.Router();

// Test phone numbers that bypass real SMS (used for App Store / Play Store review)
const TEST_PHONES = [
    normalizePhoneNumber("1234512345"),
    normalizePhoneNumber("1002003004"),
];
const TEST_OTP = "123456";

const sendOtpViaMSG91 = (phoneNumber, otp) => {
    return new Promise((resolve, reject) => {
        const mobile = phoneNumber.replace("+", "");

        const options = {
            method: "POST",
            hostname: "control.msg91.com",
            port: null,
            path: "/api/v5/flow",
            headers: {
                accept: "application/json",
                authkey: process.env.MSG91_AUTH_KEY,
                "content-type": "application/json",
            },
        };

        const req = https.request(options, (res) => {
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => {
                try {
                    resolve(JSON.parse(Buffer.concat(chunks).toString()));
                } catch {
                    reject(new Error("Invalid JSON response from MSG91"));
                }
            });
        });

        req.on("error", reject);

        req.write(JSON.stringify({
            template_id: process.env.MSG91_TEMPLATE_ID,
            short_url: "0",
            realTimeResponse: "1",
            recipients: [{ mobiles: mobile, numeric: otp }],
        }));

        req.end();
    });
};

// send otp
router.post("/send", async (req, res) => {
    try {
        let { phoneNumber } = req.body;
        if (!phoneNumber) return res.status(400).json({ success: false, message: "Phone number is required" });

        phoneNumber = normalizePhoneNumber(phoneNumber);

        // Generate 6 digit OTP
        const otpCode = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            specialChars: false,
            lowerCaseAlphabets: false
        });

        // Expiry 10 minutes (matches DLT template text)
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Save/Update OTP in DB
        await Otp.findOneAndUpdate(
            { phoneNumber },
            { otp: otpCode, expiresAt },
            { upsert: true, new: true }
        );

        // Skip MSG91 for App Store / Play Store review bypass numbers
        if (!TEST_PHONES.includes(phoneNumber)) {
            const result = await sendOtpViaMSG91(phoneNumber, otpCode);
            if (result.type !== "success") {
                console.error("[MSG91] OTP send failed:", result);
                return res.status(500).json({ success: false, message: "Failed to send OTP. Please try again." });
            }
        }

        console.log(`[OTP] Sent to ${phoneNumber}`);

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
        });
    } catch (error) {
        console.error("otp send error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

// verify otp
router.post("/verify", async (req, res) => {
    try {
        let { phoneNumber, otp } = req.body;

        if (!phoneNumber || !otp) {
            return res.status(400).json({ success: false, message: "Phone number and OTP are required" });
        }

        phoneNumber = normalizePhoneNumber(phoneNumber);

        // --- APP STORE / PLAY STORE REVIEW BYPASS ---
        const isBypass = TEST_PHONES.includes(phoneNumber) && otp === TEST_OTP;

        if (isBypass) {
            console.log("🍏 Review bypass activated for:", phoneNumber);
        } else {
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
        }

        // --- TIERED ROLE CHECK ---
        let user = null;
        let role = "customer";

        // 1. Check if it's a Rider
        user = await User.findOne({ phone: phoneNumber, role: "rider" });
        if (user) {
            role = "rider";
        } else {
            // 2. Check if it's an existing Customer
            user = await AppUser.findOne({ phoneNumber });
            if (!user) {
                // 3. Auto-register as new Customer
                user = await AppUser.create({
                    fullName: "Shrimpbite User",
                    phoneNumber: phoneNumber,
                    isVerified: true
                });
            }
        }

        // Mark user as verified
        if (user) {
            user.isVerified = true;
            await user.save();
        }

        // Delete OTP after successful verification
        await Otp.deleteOne({ phoneNumber });

        // Generate token
        const token = jwt.sign({ id: user._id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully.",
            isVerified: true,
            role,
            token,
            data: {
                id: user._id,
                fullName: user.fullName || user.name,
                email: user.email,
                phoneNumber: user.phoneNumber || user.phone,
                role
            }
        });
    } catch (error) {
        console.error("otp verify error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});


export default router;
