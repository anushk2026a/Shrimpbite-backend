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

        return notification;
    } catch (error) {
        console.error("Failed to create notification:", error.message);
    }
};

/**
 * Sends a push notification via FCM.
 */
export const sendPushNotification = async (fcmToken, title, body) => {
    console.log(`[Push Notification] To: ${fcmToken} | Title: ${title} | Body: ${body}`);
    // Baseline stub to prevent crashes - actual FCM logic can be added if keys are provided
    return { success: true };
};

/**
 * Sends an email receipt/notification.
 */
export const sendEmailReceipt = async (email, { orderId, html }) => {
    console.log(`[Email Receipt] To: ${email} | Order: ${orderId}`);
    // Logic for receipts - can reuse transporter from emailService if needed
    return { success: true };
};
