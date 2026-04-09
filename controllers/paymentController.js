import { createRazorpayOrder, verifyRazorpayWebhook } from "../services/razorpayService.js";
import { finalizeOrder } from "../services/orderService.js";
import Order from "../models/Order.js";

export const createOrder = async (req, res) => {
    try {
        const { amount } = req.body;
        const order = await createRazorpayOrder(amount);
        res.status(200).json({ success: true, order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const handleWebhook = async (req, res) => {
    try {
        const signature = req.headers["x-razorpay-signature"];
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

        const isValid = verifyRazorpayWebhook(req.rawBody, signature, secret);

        if (!isValid) {
            console.error("Invalid Webhook Signature");
            return res.status(400).json({ success: false, message: "Invalid signature" });
        }

        const { event, payload } = req.body;

        if (event === "payment.captured") {
            const razorpayOrderId = payload.payment.entity.order_id;
            const razorpayPaymentId = payload.payment.entity.id;

            // Find order by Razorpay Order ID
            const order = await Order.findOne({ razorpayOrderId });
            if (order) {
                await finalizeOrder(order.orderId, razorpayPaymentId);
                console.log(`Webhook: Order ${order.orderId} finalized via payment.captured`);
            }
        }

        res.status(200).json({ status: "ok" });
    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};