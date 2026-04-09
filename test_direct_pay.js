import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './models/Order.js';
import Product from './models/Product.js';
import AppUser from './models/AppUser.js';
import { finalizeOrder } from './services/orderService.js';

dotenv.config();

async function runTest() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB ✅");

        // 1. Get a test user and product
        const user = await AppUser.findOne();
        const product = await Product.findOne();

        if (!user || !product) {
            console.error("Missing test data (user/product)");
            process.exit(1);
        }

        console.log(`Using User: ${user.phone}, Product: ${product.name}`);

        // 2. Create a Mock "Payment Pending" Order (Simulating placeOrder response)
        const mockOrderId = `ORD-TEST-${Date.now()}`;
        const mockRzpOrderId = `order_test_${Math.random().toString(36).slice(2)}`;

        const order = await Order.create({
            orderId: mockOrderId,
            user: user._id,
            items: [{
                product: product._id,
                retailer: product.retailer || user._id, // fallback
                quantity: 1,
                price: product.price,
                status: "Payment Pending"
            }],
            totalAmount: product.price,
            paymentMethod: "Razorpay",
            paymentStatus: "Pending",
            status: "Payment Pending",
            razorpayOrderId: mockRzpOrderId
        });

        console.log(`Created Mock Order: ${order.orderId} (Status: ${order.status})`);

        // 3. Simulate finalizeOrder (What verify-payment or webhook calls)
        console.log("Simulating payment finalization...");
        const finalized = await finalizeOrder(order.orderId, "pay_mock_123", "sig_mock_456");

        console.log("Finalized Order Status:", finalized.status);
        console.log("Finalized Payment Status:", finalized.paymentStatus);
        console.log("Razorpay Payment ID:", finalized.razorpayPaymentId);

        if (finalized.status === "Pending" && finalized.paymentStatus === "Paid") {
            console.log("Test PASSED: Direct Payment Flow Verified! 🦐✅");
        } else {
            console.log("Test FAILED: Unexpected Order State ❌");
        }

        // Cleanup
        await Order.findByIdAndDelete(order._id);
        console.log("Cleanup complete.");

        process.exit(0);

    } catch (error) {
        console.error("Test Failed with error:", error);
        process.exit(1);
    }
}

runTest();
