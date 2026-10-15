import SystemSetting from "../models/SystemSetting.js";
import { sendAdminAlertEmail } from "./emailService.js";

/**
 * Checks system settings and dispatches admin emails if enabled.
 * @param {string} alertType - 'newOrder', 'orderDelayed', or 'newCustomer'
 * @param {object} data - Data to format into the email
 */
export const dispatchAdminAlert = async (alertType, data) => {
    try {
        // 1. Fetch settings
        const settings = await SystemSetting.find();
        const settingsObj = {};
        settings.forEach(s => { settingsObj[s.key] = s.value; });

        const emails = settingsObj.ADMIN_NOTIFICATION_EMAILS || [];
        if (!emails || emails.length === 0) return; // No admins configured

        // 2. Dispatch based on type
        if (alertType === 'newOrder' && settingsObj.NOTIFY_NEW_ORDER) {
            const subject = `🍤 New Order Alert: #${data.orderId.slice(-6).toUpperCase()}`;
            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <h2 style="color: #3B82F6;">New Order Received! 🦐</h2>
                    <p>A new order has been placed on Shrimpbite.</p>
                    <ul style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <li><strong>Order ID:</strong> ${data.orderId}</li>
                        <li><strong>Customer:</strong> ${data.customerName || 'N/A'}</li>
                        <li><strong>Total Amount:</strong> ₹${data.totalAmount}</li>
                        <li><strong>Shop:</strong> ${data.shopName || 'N/A'}</li>
                    </ul>
                    <p>Please check the admin dashboard for full details.</p>
                </div>
            `;
            await sendAdminAlertEmail(emails, subject, html);
        }

        if (alertType === 'newCustomer' && settingsObj.NOTIFY_NEW_CUSTOMER) {
            const customerName = data.name || "Shrimpbite User";
            const subject = `👤 New Customer Registration: ${customerName}`;
            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #15803d; margin: 0; font-size: 22px;">New Customer Registered! 🎊</h2>
                        <p style="color: #64748b; font-size: 14px; margin-top: 6px;">A new user has just registered on the Shrimpbite platform.</p>
                    </div>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 20px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 120px;">Name:</td>
                                <td style="padding: 8px 0; color: #1e293b; font-weight: bold;">${customerName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Phone:</td>
                                <td style="padding: 8px 0; color: #1e293b; font-weight: bold;">${data.phone || 'N/A'}</td>
                            </tr>
                            ${data.email ? `
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Email:</td>
                                <td style="padding: 8px 0; color: #1e293b; font-weight: bold;">${data.email}</td>
                            </tr>` : ''}
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Registered At:</td>
                                <td style="padding: 8px 0; color: #1e293b;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                            </tr>
                        </table>
                    </div>
                    <p style="text-align: center; color: #94a3b8; font-size: 12px; margin: 0;">This is an automated notification from Shrimpbite Admin System.</p>
                </div>
            `;
            await sendAdminAlertEmail(emails, subject, html);
        }
    } catch (err) {
        console.error("[Admin Alert Service] Error dispatching alert:", err.message);
    }
};
