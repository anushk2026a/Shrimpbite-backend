import AppUser from "../models/AppUser.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { sendPushNotification } from "../services/notificationService.js";
import { emitNotification } from "../services/socketService.js";

export const sendBulkNotification = async (req, res) => {
    try {
        const { title, body, targetType } = req.body; // targetType: 'all', 'retailer', 'rider', 'customer'
        let pushTokens = [];
        let retailerIds = [];

        // 1. Fetch tokens from AppUser (Customers) - Always FCM
        if (targetType === "all" || targetType === "customer") {
            const customers = await AppUser.find({ fcmToken: { $exists: true, $ne: "" } }).select("fcmToken");
            pushTokens = [...pushTokens, ...customers.map(u => u.fcmToken)];
        }

        // 2. Fetch riders for FCM
        if (targetType === "all" || targetType === "rider") {
            const riders = await User.find({ role: "rider", fcmToken: { $exists: true, $ne: "" } }).select("fcmToken");
            pushTokens = [...pushTokens, ...riders.map(u => u.fcmToken)];
        }

        // 3. Fetch retailers for Database/Panel (regardless of FCM token)
        if (targetType === "all" || targetType === "retailer") {
            const retailers = await User.find({ role: "retailer" }).select("_id");
            retailerIds = retailers.map(u => u._id);
        }

        // 4. Create Database Notifications for Retailers
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

        // 5. Clean push tokens (remove duplicates)
        const uniquePushTokens = [...new Set(pushTokens)];

        // 6. Final verification - If NO push tokens AND NO retailers, then error
        if (uniquePushTokens.length === 0 && retailerIds.length === 0) {
            return res.status(404).json({ success: false, message: "No users found in this segment (Retailers, Riders, or Customers)." });
        }

        // 7. Dispatch FCM only to those in the push list (Customers/Riders)
        if (uniquePushTokens.length > 0) {
            const pushPromises = uniquePushTokens.map(token => sendPushNotification(token, title, body));
            await Promise.all(pushPromises);
        }

        res.json({ 
            success: true, 
            message: `Dispatch successful.`,
            details: {
                pushNotificationsSent: uniquePushTokens.length,
                panelNotificationsSent: retailerIds.length
            }
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
