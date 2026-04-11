import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import otpGenerator from "otp-generator";
import AppUser from "../models/AppUser.js";
import User from "../models/User.js";
import Otp from "../models/Otp.js";
import { sendWelcomeEmail } from "../services/emailService.js";
import admin from "firebase-admin";
import { normalizePhoneNumber } from "../utils/phoneUtils.js";

// Check User Role/Action
export const checkUser = async (req, res) => {
    try {
        let { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ success: false, message: "Phone number is required" });
        }

        phoneNumber = normalizePhoneNumber(phoneNumber);

        // 1. Check if it's a Rider (from User collection)
        const rider = await User.findOne({
            $or: [{ phone: phoneNumber }, { email: phoneNumber }],
            role: "rider"
        });

        if (rider) {
            return res.status(200).json({
                success: true,
                action: "otp",
                role: "rider",
                message: "Rider found. Proceed with OTP login."
            });
        }

        // 2. Otherwise, treat as Customer or New User (Proceed with OTP)
        const customer = await AppUser.findOne({ phoneNumber });

        return res.status(200).json({
            success: true,
            action: "otp",
            role: "customer",
            isNewUser: !customer,
            message: customer ? "Customer found. Proceed with OTP." : "New user. Proceed with OTP registration."
        });

    } catch (error) {
        console.error("checkUser error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
// Register
export const registerUser = async (req, res) => {
    try {
        let { fullName, email, phoneNumber, password, confirmPassword } = req.body;

        if (!fullName || !phoneNumber) {
            return res.status(400).json({ success: false, message: "Full name and phone number are required" });
        }

        phoneNumber = normalizePhoneNumber(phoneNumber);

        const existingUser = await AppUser.findOne({
            $or: [{ email: email || "NULL_EMAIL" }, { phoneNumber }],
        });

        if (existingUser) {
            return res.status(400).json({ success: false, message: "User with this email or phone number already exists" });
        }

        let hashedPassword = null;
        if (password) {
            if (password !== confirmPassword) {
                return res.status(400).json({ success: false, message: "Passwords do not match" });
            }
            hashedPassword = await bcrypt.hash(password, 10);
        }

        const newUser = await AppUser.create({
            fullName,
            email,
            phoneNumber,
            password: hashedPassword,
        });

        // send welcome email (non-blocking)
        if (newUser.email) {
            try {
                await sendWelcomeEmail(newUser.email, newUser.fullName);
            } catch (error) {
                console.log("Welcome email failed:", error.message);
            }
        }

        // 6.1 fcmToken assignment
        const { fcmToken } = req.body;
        if (fcmToken) newUser.fcmToken = fcmToken;
        await newUser.save();

        return res.status(201).json({
            success: true,
            message: "User registered successfully. Please verify your phone number using Firebase.",
            data: {
                id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                phoneNumber: newUser.phoneNumber,
                isVerified: newUser.isVerified
            },
        });
    } catch (error) {
        console.error("registerUser error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// Login
export const loginUser = async (req, res) => {
    try {
        let { phoneNumber, password, fcmToken } = req.body;

        if (!phoneNumber || !password) {
            return res.status(400).json({ success: false, message: "Phone number and password required" });
        }

        phoneNumber = normalizePhoneNumber(phoneNumber);

        let user = await AppUser.findOne({ phoneNumber });
        let role = "customer";

        if (!user) {
            // Check if it's a Rider (from User collection)
            user = await User.findOne({
                $or: [{ phone: phoneNumber }, { email: phoneNumber }] // Try both for riders
            });
            if (!user || user.role !== "rider") {
                return res.status(400).json({ success: false, message: "Invalid credentials" });
            }
            role = "rider";
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        if (role === "customer" && !user.isVerified) {
            return res.status(403).json({
                success: false,
                message: "Account not verified. Please verify your phone number.",
                phoneNumber: user.phoneNumber
            });
        }

        // Always update FCM token if provided during login
        if (fcmToken) {
            user.fcmToken = fcmToken;
            await user.save();
        }

        const token = jwt.sign({ id: user._id, role }, process.env.JWT_SECRET, { expiresIn: "7d" });

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            data: {
                id: user._id,
                fullName: user.fullName || user.name,
                email: user.email,
                phoneNumber: user.phoneNumber || user.phone,
                role: role
            },
        });
    } catch (error) {
        console.error("loginUser error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getProfile = async (req, res) => {
    try {
        // req.user already has the 'role' added by the middleware
        return res.status(200).json({
            success: true,
            data: req.user,
            message: "Profile fetched successfully"
        });
    } catch (error) {
        console.error("getProfile error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// Update profile
export const updateProfile = async (req, res) => {
    try {
        const { fullName, email, phoneNumber } = req.body;

        if (!fullName && !email && !phoneNumber) {
            return res.status(400).json({ success: false, message: "At least one field is required to update" });
        }

        const user = await AppUser.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const updates = [];
        let hasChanges = false;

        // fullName
        if (fullName && fullName.trim() !== user.fullName) {
            user.fullName = fullName.trim();
            updates.push("fullName");
            hasChanges = true;
        }

        // email
        if (email) {
            const normalizedEmail = email.toLowerCase().trim();
            if (normalizedEmail !== (user.email || "")) {
                const emailExists = await AppUser.findOne({ email: normalizedEmail });
                if (emailExists) return res.status(400).json({ success: false, message: "This email is already registered with another account" });
                user.email = normalizedEmail;
                updates.push("email");
                hasChanges = true;
            }
        }

        // phone
        if (phoneNumber) {
            const normalizedPhone = normalizePhoneNumber(phoneNumber);
            if (normalizedPhone !== user.phoneNumber) {
                const phoneExists = await AppUser.findOne({ phoneNumber: normalizedPhone });
                if (phoneExists) return res.status(400).json({ success: false, message: "Phone number already in use" });
                user.phoneNumber = normalizedPhone;
                updates.push("phoneNumber");
                hasChanges = true;
            }
        }

        if (hasChanges) {
            await user.save();
        }

        return res.status(200).json({ 
            success: true, 
            message: hasChanges ? "Profile updated successfully" : "No changes detected", 
            updatedFields: updates, 
            data: user 
        });
    } catch (error) {
        console.error("updateProfile error:", error);
        return res.status(500).json({ success: false, message: "Something went wrong while updating profile" });
    }
};

// Update only Name (Used by Flutter App)
export const updateName = async (req, res) => {
    try {
        const { fullName } = req.body;

        if (!fullName) {
            return res.status(400).json({ success: false, message: "Full name is required" });
        }

        const user = await AppUser.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        if (fullName === user.fullName) {
            return res.status(400).json({ success: false, message: "New name cannot be the same as the current name" });
        }

        user.fullName = fullName;
        await user.save();

        return res.status(200).json({ 
            success: true, 
            message: "Name updated successfully", 
            data: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phoneNumber: user.phoneNumber
            }
        });
    } catch (error) {
        console.error("updateName error:", error);
        return res.status(500).json({ success: false, message: "Something went wrong while updating name" });
    }
};

// Update Email (Used by Flutter App)
export const updateEmail = async (req, res) => {
    try {
        let { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        email = email.toLowerCase().trim();

        const user = await AppUser.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        if (email === user.email) {
            return res.status(400).json({ success: false, message: "New email cannot be the same as the current email" });
        }

        // Check if email is already taken by another account
        const emailExists = await AppUser.findOne({ email });
        if (emailExists) {
            return res.status(400).json({ success: false, message: "This email is already registered with another account" });
        }

        user.email = email;
        await user.save();

        // Send Welcome Email (The perfect time to send it since they just provided it!)
        try {
            await sendWelcomeEmail(user.email, user.fullName);
        } catch (error) {
            console.log("Welcome email failed during email update:", error.message);
        }

        return res.status(200).json({
            success: true,
            message: "Email updated successfully",
            data: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phoneNumber: user.phoneNumber
            }
        });
    } catch (error) {
        console.error("updateEmail error:", error);
        return res.status(500).json({ success: false, message: "Something went wrong while updating email" });
    }
};

// Change password
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: "Both currentPassword and newPassword are required" });
        }

        const user = await AppUser.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ success: false, message: "Current password incorrect" });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        return res.status(200).json({ success: true, message: "Password changed successfully" });
    } catch (error) {
        console.error("changePassword error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// Forgot password
export const forgotPassword = async (req, res) => {
    try {
        const { email, phoneNumber } = req.body;
        
        // For Customers, they should just use OTP
        if (phoneNumber) {
             return res.status(200).json({ 
                success: true, 
                message: "Customers log in via OTP. No password reset needed. Just request an OTP on the login screen." 
            });
        }

        if (!email) return res.status(400).json({ success: false, message: "Email is required" });

        const user = await User.findOne({ email }); // Riders/Retailers/Admins
        if (!user) return res.status(404).json({ success: false, message: "User with this email not found" });

        // TODO: generate reset token, save, and send email (for non-customer roles)
        return res.status(200).json({ success: true, message: "Password reset instructions sent to your email." });
    } catch (error) {
        console.error("forgotPassword error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// Add address
export const addAddress = async (req, res) => {
    try {
        const userId = req.userId || req.user.id || req.user._id;
        const user = await AppUser.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const address = req.body;

        // If isDefault is true, unset previous defaults
        if (address.isDefault) {
            user.addresses = user.addresses.map(a => ({ ...a.toObject(), isDefault: false }));
        }

        user.addresses.push(address);
        await user.save();

        return res.status(201).json({ success: true, message: "Address added", data: user.addresses });
    } catch (error) {
        console.error("addAddress error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Get addresses
export const getAddresses = async (req, res) => {
    try {
        const userId = req.userId || req.user.id || req.user._id;
        const user = await AppUser.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        return res.status(200).json({ success: true, data: user.addresses });
    } catch (error) {
        console.error("getAddresses error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Delete address
export const deleteAddress = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId || req.user.id || req.user._id;
        const user = await AppUser.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const prevLen = user.addresses.length;
        user.addresses = user.addresses.filter(addr => addr._id.toString() !== id);

        if (user.addresses.length === prevLen) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        await user.save();

        return res.status(200).json({ success: true, message: "Address removed", data: user.addresses });
    } catch (error) {
        console.error("deleteAddress error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
// Google Auth (Firebase)
export const googleAuth = async (req, res) => {
    try {
        const { idToken, phoneNumber, fcmToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ success: false, message: "ID Token is required" });
        }

        // Verify Firebase Token
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch (error) {
            console.error("Firebase token verification failed:", error.message);
            return res.status(401).json({ success: false, message: "Invalid or expired Firebase token" });
        }

        const { email, name, uid, picture } = decodedToken;

        // 1. Try to find user by Firebase UID
        let user = await AppUser.findOne({ firebaseUid: uid });

        // 2. If not found by UID, try by Email
        if (!user && email) {
            user = await AppUser.findOne({ email });
        }

        // 3. Handle New User / Missing Phone Number
        if (!user) {
            // New User flow
            if (!phoneNumber) {
                // Return verified info so the app can show a screen to get the phone number
                return res.status(200).json({
                    success: true,
                    new_user: true,
                    message: "User not found. Please provide a phone number to complete registration.",
                    temp_data: { email, name, uid }
                });
            }

            // Check if phone number already belongs to another user
            const phoneExists = await AppUser.findOne({ phoneNumber });
            if (phoneExists) {
                return res.status(400).json({ success: false, message: "Phone number already in use by another account" });
            }

            // Create new Google User
            user = await AppUser.create({
                fullName: name,
                email,
                phoneNumber,
                firebaseUid: uid,
                isGoogleUser: true,
                isVerified: true // Google email is verified
            });

            // Send welcome email
            try {
                await sendWelcomeEmail(user.email, user.fullName);
            } catch (error) {
                console.log("Welcome email failed:", error.message);
            }
        } else {
            // Existing user flow - Ensure fields are updated if needed
            let updated = false;
            if (!user.firebaseUid) {
                user.firebaseUid = uid;
                updated = true;
            }
            if (!user.isGoogleUser) {
                user.isGoogleUser = true;
                updated = true;
            }
            if (updated) await user.save();
        }

        // Always update FCM token if provided during login
        if (fcmToken) {
            user.fcmToken = fcmToken;
            await user.save();
        }

        // Finalize Login
        const token = jwt.sign({ id: user._id, role: "customer" }, process.env.JWT_SECRET, { expiresIn: "7d" });

        return res.status(200).json({
            success: true,
            message: "Google login successful",
            token,
            data: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: "customer"
            },
        });

    } catch (error) {
        console.error("googleAuth error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};
