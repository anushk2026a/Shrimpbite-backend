import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import User from "../models/User.js"
import { createNotification } from "../services/notificationService.js";

// Register
export const registerUser = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body

        const existingUser = await User.findOne({ email })
        if (existingUser) return res.status(400).json({ message: "User already exists" })

        const hashedPassword = await bcrypt.hash(password, 12)

        const newUser = new User({
            name,
            email,
            phone,
            password: hashedPassword,
            status: "draft",
            role: "retailer"
        })

        await newUser.save()

        createNotification(newUser._id.toString(), {
            title: "Welcome to Shrimpbite! 🦐",
            message: "Your retailer account has been created. Please complete your onboarding to start selling.",
            type: "System"
        });

        const token = jwt.sign({ id: newUser._id, role: "retailer" }, process.env.JWT_SECRET, { expiresIn: "1d" })

        res.status(201).json({ token, user: { _id: newUser._id, name, email, status: newUser.status, role: "retailer", isShopActive: newUser.isShopActive } })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message || "Something went wrong" })
    }
}

// Login
export const loginUser = async (req, res) => {
    try {
        const { email, password, fcmToken } = req.body

        const user = await User.findOne({ email }).populate("adminRole", "name modules")
        if (!user) return res.status(404).json({ message: "User doesn't exist" })

        const isPasswordCorrect = await bcrypt.compare(password, user.password)
        if (!isPasswordCorrect) return res.status(400).json({ message: "Invalid credentials" })
        
        // Always update FCM token if provided during login
        if (fcmToken) {
            user.fcmToken = fcmToken;
            await user.save();
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" })

        res.status(200).json({
            token,
            user: {
                _id: user._id,
                name: user.name,
                email,
                status: user.status,
                role: user.role,
                isShopActive: user.isShopActive,
                adminRole: user.adminRole,
                isPasswordResetRequired: user.isPasswordResetRequired || false
            }
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: error.message || "Something went wrong" })
    }
}

// Onboarding
export const onboardUser = async (req, res) => {
    try {
        const { userId, alternateContact, whatsappNumber, businessDetails } = req.body

        const user = await User.findById(userId)
        if (!user) return res.status(404).json({ message: "User not found" })

        user.alternateContact = alternateContact
        user.whatsappNumber = whatsappNumber
        user.businessDetails = businessDetails
        user.status = "under_review"

        await user.save()

        // Notify Admins about new onboarding submission (only those with Retailers permission)
        try {
            const { notifyAdminsByModule } = await import("../services/notificationService.js");
            await notifyAdminsByModule("Retailers", {
                title: "New Retailer Onboarding! 🏪",
                message: `Retailer "${user.businessDetails?.businessName || user.name}" has submitted their details for review.`,
                type: "System",
                referenceId: user._id.toString()
            });
        } catch (err) {
            console.error("Admin Notification failed:", err.message);
        }

        res.status(200).json({ message: "Onboarding details submitted", status: user.status })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Something went wrong" })
    }
}

// Get Me (Current User)
export const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).populate("adminRole", "name modules")
        if (!user) return res.status(404).json({ message: "User not found" })

        res.status(200).json(user)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Something went wrong" })
    }
}

// Update Retailer Profile (Shop Settings)
export const updateRetailerProfile = async (req, res) => {
    try {
        const { businessDetails, whatsappNumber, alternateContact } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) return res.status(404).json({ message: "Retailer not found" });

        if (businessDetails) {
            user.businessDetails = {
                ...user.businessDetails,
                ...businessDetails,
                // Ensure we don't accidentally wipe location or legal if not provided
                location: {
                    ...(user.businessDetails?.location || {}),
                    ...(businessDetails.location || {})
                },
                legal: {
                    ...(user.businessDetails?.legal || {}),
                    ...(businessDetails.legal || {})
                }
            };
        }

        if (whatsappNumber) user.whatsappNumber = whatsappNumber;
        if (alternateContact) user.alternateContact = alternateContact;

        await user.save();
        res.status(200).json({ success: true, message: "Profile updated successfully", data: user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Something went wrong" });
    }
};

// Reset Admin Password (for mandatory first login flow)
export const resetAdminPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordCorrect) return res.status(400).json({ message: "Invalid current password" });

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        
        user.password = hashedPassword;
        user.isPasswordResetRequired = false;
        await user.save();

        res.status(200).json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Something went wrong" });
    }
};

