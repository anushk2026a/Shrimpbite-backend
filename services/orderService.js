import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Cart from "../models/Cart.js";
import Transaction from "../models/Transaction.js";
import { createNotification } from "./notificationService.js";
import { emitOrderUpdate } from "./socketService.js";

export const finalizeOrder = async (orderId, razorpayPaymentId, razorpaySignature) => {
    try {
        // 1. Identify Order
        const identifyQuery = mongoose.isValidObjectId(orderId)
            ? { _id: orderId }
            : { orderId: orderId };

        // 2. Atomic Update (Prevents race conditions / double-processing)
        const order = await Order.findOneAndUpdate(
            { ...identifyQuery, paymentStatus: { $ne: "Paid" } },
            {
                $set: {
                    paymentStatus: "Paid",
                    status: "Pending",
                    ...(razorpayPaymentId && { razorpayPaymentId }),
                    ...(razorpaySignature && { razorpaySignature }),
                    "items.$[elem].status": "Pending"
                }
            },
            {
                arrayFilters: [{ "elem.status": "Payment Pending" }],
                new: true
            }
        ).populate("items.product");

        if (!order) {
            const checkOrder = await Order.findOne(identifyQuery);
            if (checkOrder && checkOrder.paymentStatus === "Paid") return checkOrder;
            throw new Error(`Order ${orderId} not found or already processed.`);
        }

        // 3. Log Razorpay Transaction
        try {
            await Transaction.create({
                user: order.user,
                amount: order.totalAmount,
                type: "Debit",
                source: "Razorpay",
                status: "Success",
                description: `Payment for Order #${order.orderId}`,
                referenceId: order.razorpayOrderId
            });
        } catch (txError) {
            console.error("Transaction logging failed:", txError.message);
        }

        // 4. Stock Deduction
        for (const item of order.items) {
            try {
                if (!item.product) continue;

                let weightToReduce = item.quantity;
                if (item.product.variants && item.product.variants.length > 0) {
                    const variant = item.product.variants.find(v => v._id.toString() === item.variantId?.toString());
                    if (variant) weightToReduce = variant.weightInKg * item.quantity;
                }

                const updatedProduct = await Product.findByIdAndUpdate(
                    item.product._id,
                    { $inc: { stock: -weightToReduce } },
                    { new: true }
                );

                if (updatedProduct && updatedProduct.stock <= 5) {
                    createNotification(item.retailer.toString(), {
                        title: "Low Inventory Alert! ⚠️",
                        message: `Product "${updatedProduct.name}" is running low on stock (${updatedProduct.stock}kg left).`,
                        type: "Inventory",
                        referenceId: updatedProduct._id.toString()
                    });
                }
            } catch (stockError) {
                console.error(`Stock deduction failed for ${item.product?._id}:`, stockError.message);
            }
        }

        // 5. Clear Cart
        await Cart.findOneAndDelete({ user: order.user });

        // 6. Notifications for all Retailers
        try {
            const populatedOrder = await Order.findById(order._id).populate("items.product", "name");
            const retailerIds = [...new Set(order.items.map(item => item.retailer.toString()))];

            for (const retailerId of retailerIds) {
                await emitOrderUpdate(order.orderId, "Pending", populatedOrder, retailerId, order.user.toString());
                createNotification(retailerId, {
                    title: "New Order Received! 🦐",
                    message: `You have a new order (#${order._id.toString().slice(-6)}) for ₹${order.totalAmount}.`,
                    type: "Order",
                    referenceId: order._id.toString()
                });
            }
        } catch (notifyError) {
            console.error("Notification failed:", notifyError.message);
        }

        return order;

    } catch (error) {
        console.error("Finalize Order Error:", error.message);
        throw error;
    }
};
