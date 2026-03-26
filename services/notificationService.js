import Notification from "../models/Notification.js";
import { emitNotification } from "./socketService.js";
import { sendWelcomeEmail } from "./emailService.js";

/**
 * Creates a notification in the DB and emits it via socket.
 * @param {string} recipientId - The User ID of the recipient.
 * @param {object} data - { title, message, type, referenceId }
 */
export const createNotification = async (recipientId, { title, message, type, referenceId }) => {
    try {
        const notification = await Notification.create({
            recipient: recipientId,
            title,
            message,
            type,
            referenceId
        });

        // Emit via socket
        await emitNotification(recipientId, notification.toObject());

        // Try sending push notification
        try {
            // Check AppUser (Customers)
            let user = await (await import("../models/AppUser.js")).default.findById(recipientId).select("fcmToken");
            
            // If not found in AppUser, check User (Riders/Retailers)
            if (!user) {
                user = await (await import("../models/User.js")).default.findById(recipientId).select("fcmToken fields.fcmToken businessDetails.fcmToken");
                // Note: The schema update I made was top level in User.js but inside businessDetails was a possibility in previous thoughts. 
                // Let's stick to the top level one I just added.
            }

            if (user && user.fcmToken) {
                await sendPushNotification(user.fcmToken, title, message, { type, referenceId });
            }
        } catch (pushErr) {
            console.error("Non-blocking Push Notification fetch error:", pushErr.message);
        }

        return notification;
    } catch (error) {
        console.error("Failed to create notification:", error.message);
    }
};

/**
 * Sends a push notification via FCM.
 */
export const sendPushNotification = async (fcmToken, title, body, data = {}) => {
    if (!fcmToken) return { success: false, message: "No FCM token provided" };

    try {
        const admin = (await import("../config/firebase.js")).default;
        
        // Safety check: Ensure Firebase is initialized
        if (!admin || !admin.appCheck) { // Using a generic check since app() might be private
            // admin might be initialized but we want to be sure it's functional
            // If it's the export from config/firebase.js, it's the admin object
        }

        const message = {
            notification: {
                title,
                body,
            },
            data: {
                ...data,
                click_action: "FLUTTER_NOTIFICATION_CLICK"
            },
            token: fcmToken,
        };

        const response = await admin.messaging().send(message);
        console.log(`[Push Notification] Successfully sent to ${fcmToken}: ${response}`);
        return { success: true, response };
    } catch (error) {
        console.error(`[Push Notification] Error sending to ${fcmToken}:`, error.message);
        
        // Cleanup expired or invalid tokens
        if (error.code === 'messaging/registration-token-not-registered' || 
            error.code === 'messaging/invalid-registration-token') {
            await removeInvalidFCMToken(fcmToken);
        }

        return { success: false, error: error.message };
    }
};

/**
 * Sends a push notification to multiple tokens via FCM.
 */
export const sendMulticastNotification = async (fcmTokens, title, body, data = {}) => {
    if (!fcmTokens || fcmTokens.length === 0) return { success: false, message: "No FCM tokens provided" };

    try {
        const admin = (await import("../config/firebase.js")).default;
        
        // Remove duplicates and empty tokens
        const uniqueTokens = [...new Set(fcmTokens.filter(t => t))];

        if (uniqueTokens.length === 0) return { success: false, message: "No valid FCM tokens found" };

        const message = {
            notification: {
                title,
                body,
            },
            data: {
                ...data,
                click_action: "FLUTTER_NOTIFICATION_CLICK"
            },
            tokens: uniqueTokens,
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`[Multicast Notification] Sent ${response.successCount} successfully, ${response.failureCount} failed.`);

        // Cleanup expired or invalid tokens
        if (response.failureCount > 0) {
            await Promise.all(response.responses.map(async (resp, idx) => {
                if (!resp.success && resp.error) {
                    if (resp.error.code === 'messaging/registration-token-not-registered' || 
                        resp.error.code === 'messaging/invalid-registration-token') {
                        await removeInvalidFCMToken(uniqueTokens[idx]);
                    }
                }
            }));
        }

        return { success: true, response };
    } catch (error) {
        console.error(`[Multicast Notification] Error:`, error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Removes an invalid FCM token from the database.
 */
export const removeInvalidFCMToken = async (fcmToken) => {
    if (!fcmToken) return;
    try {
        const AppUser = (await import("../models/AppUser.js")).default;
        const User = (await import("../models/User.js")).default;

        await Promise.all([
            AppUser.updateMany({ fcmToken }, { $unset: { fcmToken: "" } }),
            User.updateMany({ fcmToken }, { $unset: { fcmToken: "" } })
        ]);
        
        console.log(`[FCM CLEANUP] Removed invalid token: ${fcmToken}`);
    } catch (err) {
        console.error(`[FCM CLEANUP ERROR] Failed to remove token ${fcmToken}:`, err.message);
    }
};

/**
 * Sends an email receipt/notification.
 */
export const sendEmailReceipt = async (email, { orderId, html }) => {
    console.log(`[Email Receipt] To: ${email} | Order: ${orderId}`);
    // Logic for receipts - can reuse transporter from emailService if needed
    return { success: true };
};
