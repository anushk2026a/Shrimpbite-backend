import AppUser from "../models/AppUser.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { sendPushNotification } from "../services/notificationService.js";
import { emitNotification } from "../services/socketService.js";

export const sendBulkNotification = async (req, res) => {
    try {
        const { title, body, targetType } = req.body; // targetType: 'all', 'retailer', 'rider', 'customer'
        let targetTokens = [];
        let retailerIds = [];

        // 1. Fetch tokens from AppUser (Customers)
        if (targetType === "all" || targetType === "customer") {
            const customers = await AppUser.find({ fcmToken: { $exists: true, $ne: "" } }).select("fcmToken");
            targetTokens = [...targetTokens, ...customers.map(u => u.fcmToken)];
        }

        // 2. Fetch tokens and IDs from User (Retailers & Riders)
        if (targetType === "all" || targetType === "retailer" || targetType === "rider") {
            const query = { fcmToken: { $exists: true, $ne: "" } };
            if (targetType === "retailer") query.role = "retailer";
            if (targetType === "rider") query.role = "rider";
            
            const users = await User.find(query).select("fcmToken _id role");
            targetTokens = [...targetTokens, ...users.map(u => u.fcmToken)];
            
            // Collect retailer IDs for database notifications
            retailerIds = users.filter(u => u.role === "retailer").map(u => u._id);
        }

        // 3. Remove duplicate tokens
        const uniqueTokens = [...new Set(targetTokens)];

        // 4. Create Database Notifications for Retailers (if targeted)
        if (retailerIds.length > 0) {
            const dbNotifications = retailerIds.map(id => ({
                recipient: id,
                title,
                message: body,
                type: "System"
            }));

            // Bulk insert into database
            const createdNotifications = await Notification.insertMany(dbNotifications);

            // Emit via socket for real-time web panel update
            createdNotifications.forEach(notif => {
                emitNotification(notif.recipient, notif.toObject());
            });
        }

        if (uniqueTokens.length === 0 && retailerIds.length === 0) {
            return res.status(404).json({ success: false, message: "No active users found for this segment." });
        }

        // 5. Dispatch Push Notifications
        const pushPromises = uniqueTokens.map(token => sendPushNotification(token, title, body));
        await Promise.all(pushPromises);

        res.json({ 
            success: true, 
            message: `Broadcast complete. Sent to ${uniqueTokens.length} devices and ${retailerIds.length} retailer panels.`,
            pushCount: uniqueTokens.length,
            panelCount: retailerIds.length
        });

    } catch (error) {
        console.error("Bulk broadcast error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const sendBulkEmail = async (req, res) => {
    // Current requirement: Email marketing removed from UI
    res.status(403).json({ message: "Email broadcast is currently disabled." });
};
