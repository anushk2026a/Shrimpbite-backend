import mongoose from "mongoose";
import Notification from "../models/Notification.js";

export const getNotifications = async (req, res) => {
    try {
        const userId = req.user._id;

        // Check if the ID is a valid ObjectId (avoids crash for test IDs like 'admin-test-id')
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(200).json({ success: true, notifications: [] });
        }

        const notifications = await Notification.find({ recipient: userId })
            .sort({ createdAt: -1 })
            .limit(50);

        res.status(200).json({ success: true, notifications });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid notification ID" });
        }
        await Notification.findByIdAndUpdate(id, { isRead: true });
        res.status(200).json({ success: true, message: "Notification marked as read" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(200).json({ success: true, message: "All notifications marked as read" });
        }

        await Notification.updateMany({ recipient: userId, isRead: false }, { isRead: true });
        res.status(200).json({ success: true, message: "All notifications marked as read" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateFcmToken = async (req, res) => {
    try {
        const { fcmToken } = req.body;
        const userId = req.user?.id || req.user?._id;
        const role = req.user?.role || "customer";

        if (!fcmToken) {
            return res.status(400).json({ success: false, message: "FCM token is required" });
        }

        let updatedUser;
        if (role === "customer") {
            const AppUser = (await import("../models/AppUser.js")).default;
            updatedUser = await AppUser.findByIdAndUpdate(userId, { fcmToken }, { new: true });
        } else {
            const User = (await import("../models/User.js")).default;
            updatedUser = await User.findByIdAndUpdate(userId, { fcmToken }, { new: true });
        }

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.status(200).json({ 
            success: true, 
            message: "FCM token updated successfully",
            role
        });
    } catch (error) {
        console.error("updateFcmToken error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const testNotifyAll = async (req, res) => {
    try {
        const { title, message, secret } = req.body;

        // Simple safety check
        if (secret !== "shrimpbite_test_2026") {
            return res.status(403).json({ success: false, message: "Invalid secret" });
        }

        if (!title || !message) {
            return res.status(400).json({ success: false, message: "Title and message are required" });
        }

        const AppUser = (await import("../models/AppUser.js")).default;
        const User = (await import("../models/User.js")).default;

        // Fetch all tokens from both collections
        const customerTokens = await AppUser.find({ fcmToken: { $exists: true, $ne: "" } }).distinct("fcmToken");
        const staffTokens = await User.find({ fcmToken: { $exists: true, $ne: "" } }).distinct("fcmToken");
        
        // Combine all tokens
        const allTokens = [...customerTokens, ...staffTokens];

        if (allTokens.length === 0) {
            return res.status(404).json({ success: true, message: "No devices found with FCM tokens" });
        }

        const { sendMulticastNotification } = await import("../services/notificationService.js");
        const result = await sendMulticastNotification(allTokens, title, message, { type: "Test" });

        res.status(200).json({ 
            success: true, 
            message: `Sent to ${allTokens.length} devices`,
            result
        });
    } catch (error) {
        console.error("testNotifyAll error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
