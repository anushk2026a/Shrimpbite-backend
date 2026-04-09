import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import AppUser from "../models/AppUser.js";
import Subscription from "../models/Subscription.js";
import * as walletService from "../services/walletService.js";
import { emitOrderUpdate } from "../services/socketService.js";
import { createNotification } from "../services/notificationService.js";
import { createRazorpayOrder, verifyRazorpaySignature } from "../services/razorpayService.js";
import { finalizeOrder } from "../services/orderService.js";

export const placeOrder = async (req, res) => {
    try {
        const userId = req.userId;
        let { deliveryAddress, paymentMethod, orderType, items: bodyItems } = req.body;

        // 1. Fetch Cart or use Body Items
        let itemsToProcess = [];
        let retailerFromCart = null;

        const cart = await Cart.findOne({ user: userId }).populate("items.product");
        if (cart && cart.items.length > 0) {
            itemsToProcess = cart.items;
            retailerFromCart = cart.retailer;
        } else if (bodyItems && bodyItems.length > 0) {
            // Populate product info for body items
            for (const item of bodyItems) {
                const product = await Product.findById(item.productId);
                if (!product) {
                    return res.status(404).json({ success: false, message: `Product not found: ${item.productId}` });
                }
                itemsToProcess.push({
                    product,
                    quantity: item.quantity,
                    variantId: item.variantId,
                    weightLabel: item.weightLabel
                });
            }
        }

        if (itemsToProcess.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty and no items provided" });
        }

        // 1.1 Address handling
        if (!deliveryAddress || Object.keys(deliveryAddress).length === 0) {
            const user = await AppUser.findById(userId);
            const defaultAddress = user?.addresses?.find(a => a.isDefault);
            if (defaultAddress) {
                deliveryAddress = {
                    address: defaultAddress.fullAddress,
                    city: defaultAddress.city,
                    state: defaultAddress.state,
                    pincode: defaultAddress.pincode
                };
            }
        }

        // 2. Validate Stock and Calculate Total
        let totalAmount = 0;
        const orderItems = [];
        let identifiedRetailer = retailerFromCart;

        for (const item of itemsToProcess) {
            let weightToReduce = item.quantity;
            let currentPrice = item.product.price;

            if (item.product.variants && item.product.variants.length > 0) {
                if (!item.variantId) {
                    return res.status(400).json({
                        success: false,
                        message: `Weight option not selected for "${item.product.name}".`
                    });
                }
                const variant = item.product.variants.id(item.variantId);
                if (!variant) {
                    return res.status(400).json({
                        success: false,
                        message: `Selected weight option for "${item.product.name}" is no longer available.`
                    });
                }
                weightToReduce = variant.weightInKg * item.quantity;
                currentPrice = variant.price;
            }

            if (item.product.stock < weightToReduce) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough stock for ${item.product.name}. Required: ${weightToReduce}kg, Available: ${item.product.stock}kg`
                });
            }

            const itemRetailer = item.product.retailer || identifiedRetailer;
            if (!identifiedRetailer) identifiedRetailer = itemRetailer;

            totalAmount += currentPrice * item.quantity;
            orderItems.push({
                product: item.product._id,
                variantId: item.variantId,
                weightLabel: item.weightLabel,
                retailer: itemRetailer,
                quantity: item.quantity,
                price: currentPrice,
                status: paymentMethod === "Razorpay" ? "Payment Pending" : "Pending"
            });

            item.calculatedWeightToReduce = weightToReduce;
        }

        if (!identifiedRetailer) {
            return res.status(400).json({ success: false, message: "Retailer not identified for items" });
        }

        // 2.1 Wallet Balance Check (Only if not Razorpay)
        if (paymentMethod === "Wallet") {
            const user = await AppUser.findById(userId);
            if (!user || user.walletBalance < totalAmount) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient wallet balance. Total: ₹${totalAmount}, Current: ₹${user?.walletBalance || 0}.`
                });
            }
            await walletService.adjustBalance(userId, "appUser", totalAmount, "Debit", "Order Payment", "Order", null);
        }

        // 3. Razorpay Order Creation
        let razorpayOrderId = null;
        if (paymentMethod === "Razorpay") {
            const rzpOrder = await createRazorpayOrder(totalAmount);
            razorpayOrderId = rzpOrder.id;
        }

        // 4. Generate Order ID
        const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // 5. Create Order
        const order = await Order.create({
            orderId,
            user: userId,
            items: orderItems,
            totalAmount,
            deliveryAddress,
            paymentMethod,
            paymentStatus: paymentMethod === "Wallet" ? "Paid" : "Pending",
            status: paymentMethod === "Razorpay" ? "Payment Pending" : "Pending",
            orderType: orderType || "One-time",
            razorpayOrderId
        });

        // 6. Final Steps for Wallet Orders (Stock deduction, notifications, etc.)
        // For Razorpay, these will happen in verify-payment
        if (paymentMethod === "Wallet") {
            for (const item of itemsToProcess) {
                const weightToReduce = item.calculatedWeightToReduce || item.quantity;
                const updatedProduct = await Product.findByIdAndUpdate(
                    item.product._id,
                    { $inc: { stock: -weightToReduce } },
                    { new: true }
                );

                if (updatedProduct.stock <= 5) {
                    createNotification(identifiedRetailer.toString(), {
                        title: "Low Inventory Alert! ⚠️",
                        message: `Product "${updatedProduct.name}" is running low on stock (${updatedProduct.stock}kg left).`,
                        type: "Inventory",
                        referenceId: updatedProduct._id.toString()
                    });
                }
            }

            // Clear Cart
            await Cart.findOneAndDelete({ user: userId });

            // Socket & Push Notifications for each retailer
            const populatedOrder = await Order.findById(order._id).populate("items.product", "name");
            const retailerIds = [...new Set(orderItems.map(item => item.retailer.toString()))];

            for (const retailerId of retailerIds) {
                await emitOrderUpdate(order.orderId, "Pending", populatedOrder, retailerId, userId);
                createNotification(retailerId, {
                    title: "New Order Received! 🦐",
                    message: `You have a new order (#${order._id.toString().slice(-6)}) for ₹${totalAmount}.`,
                    type: "Order",
                    referenceId: order._id.toString()
                });
            }
        }

        res.status(201).json({
            success: true,
            message: paymentMethod === "Razorpay" ? "Payment initiated" : "Order placed successfully",
            orderId: order.orderId,
            razorpayOrderId,
            order: paymentMethod === "Wallet" ? order : undefined // Optionally hide full order for payment pending
        });

    } catch (error) {
        console.error("Place Order Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.userId })
            .populate("items.product")
            .populate("items.retailer", "businessDetails")
            .populate("rider", "name phone")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            orders
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const placeSpotOrder = async (req, res) => {
    // Spot orders are just one-time orders placed manually. 
    // We can reuse the placeOrder logic but maybe with a flag or specific tagging.
    // For now, let's just implement a dedicated endpoint if needed, 
    // but placeOrder already handles one-time orders.
    // However, the user wants a specific "Order for Today" button.
    return placeOrder(req, res);
};

export const getUserOrderHistory = async (req, res) => {
    try {
        const userId = req.userId;

        // 1. Fetch Past Orders
        const orders = await Order.find({ user: userId })
            .populate("items.product")
            .populate("items.retailer", "businessDetails")
            .populate("rider", "name phone")
            .sort({ createdAt: -1 });

        // 2. Fetch Active Plans (Subscriptions) - Including paused for history visibility
        const subscriptions = await Subscription.find({ user: userId })
            .populate("product")
            .populate("retailer", "businessDetails")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                orders: orders,
                activePlans: subscriptions
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const getOrderTracking = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate("items.product")
            .populate("items.retailer", "businessDetails")
            .populate("rider", "name phone")
            .populate("subscriptionId", "frequency customDays");

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Authorization: ensure the order belongs to the requester
        if (order.user.toString() !== req.userId) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        res.status(200).json({
            success: true,
            order
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const verifyPayment = async (req, res) => {
    try {
        const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

        // 1. Verify Signature
        const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

        if (!isValid) {
            return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }

        // 2. Finalize Order
        const order = await finalizeOrder(orderId, razorpayPaymentId, razorpaySignature);

        res.status(200).json({
            success: true,
            message: "Payment verified and order processed",
            order
        });

    } catch (error) {
        console.error("Verify Payment Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
