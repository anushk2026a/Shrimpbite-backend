import Notification from "../models/Notification.js";

export const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user._id })
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
        await Notification.findByIdAndUpdate(id, { isRead: true });
        res.status(200).json({ success: true, message: "Notification marked as read" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
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
