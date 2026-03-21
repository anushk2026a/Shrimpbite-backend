import AppUser from "../models/AppUser.js";
import User from "../models/User.js";
import { sendPushNotification } from "../services/notificationService.js";

export const sendBulkNotification = async (req, res) => {
    try {
        const { title, body, targetType } = req.body; // targetType: 'all', 'retailer', 'rider', 'customer'
        let targetTokens = [];

        // 1. Fetch tokens from AppUser (Customers)
        if (targetType === "all" || targetType === "customer") {
            const customers = await AppUser.find({ fcmToken: { $exists: true, $ne: "" } }).select("fcmToken");
            targetTokens = [...targetTokens, ...customers.map(u => u.fcmToken)];
        }

        // 2. Fetch tokens from User (Retailers & Riders)
        if (targetType === "all" || targetType === "retailer" || targetType === "rider") {
            const query = { fcmToken: { $exists: true, $ne: "" } };
            if (targetType === "retailer") query.role = "retailer";
            if (targetType === "rider") query.role = "rider";
            
            const users = await User.find(query).select("fcmToken");
            targetTokens = [...targetTokens, ...users.map(u => u.fcmToken)];
        }

        // 3. Remove duplicates
        const uniqueTokens = [...new Set(targetTokens)];

        if (uniqueTokens.length === 0) {
            return res.status(404).json({ success: false, message: "No active users found with registered push tokens for this segment." });
        }

        const notifications = uniqueTokens.map(token => sendPushNotification(token, title, body));

        await Promise.all(notifications);
        res.json({ success: true, message: `Bulk notifications sent to ${uniqueTokens.length} active devices.`, count: uniqueTokens.length });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const sendBulkEmail = async (req, res) => {
    try {
        const { subject, htmlContent } = req.body;
        const users = await AppUser.find({ email: { $exists: true } });

        const emails = users.map(user => {
            // Placeholder for generic bulk email logic
            console.log(`Sending email to ${user.email}: ${subject}`);
            // return sendEmailReceipt(user.email, { orderId: 'BULK', html: htmlContent });
        });

        res.json({ message: "Bulk emails initiated", count: users.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
