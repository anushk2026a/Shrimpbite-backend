import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Review from "../models/Review.js";
import { adjustBalance } from "../services/walletService.js";
import { emitOrderUpdate, emitShopStatusUpdate } from "../services/socketService.js";
import { createNotification } from "../services/notificationService.js";
import OrderReview from "../models/OrderReview.js";

// Helper function to calculate shop rating
const calculateShopRating = async (retailerId) => {
    const reviews = await Review.find({ retailer: retailerId });
    if (reviews.length === 0) return 4.5; // Default for new shops
    const total = reviews.reduce((acc, curr) => acc + curr.rating, 0);
    return Number((total / reviews.length).toFixed(1));
};

// Get all approved shops (retailers)
export const getPublicShops = async (req, res) => {
    try {
        const { search = "" } = req.query;
        const query = { role: "retailer", status: "approved" };

        if (search) {
            query.$or = [
                { "businessDetails.businessName": { $regex: search, $options: "i" } },
                { "businessDetails.storeDisplayName": { $regex: search, $options: "i" } }
            ];
        }

        const shops = await User.find(query)
            .select("name email businessDetails isShopActive createdAt")
            .sort({ createdAt: -1 });

        const minimalShops = await Promise.all(shops.map(async (shop) => {
            const rating = await calculateShopRating(shop._id);
            return {
                id: shop._id,
                name: shop.businessDetails?.storeDisplayName || shop.businessDetails?.businessName || shop.name,
                businessName: shop.businessDetails?.businessName,
                image: shop.businessDetails?.storeImage || "",
                location: shop.businessDetails?.location?.city || "",
                isShopActive: shop.isShopActive ?? false,
                rating: rating,
                deliveryTime: "30-45 mins"
            };
        }));

        res.status(200).json({
            success: true,
            data: minimalShops
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get single shop details
export const getShopDetails = async (req, res) => {
    try {
        const shop = await User.findOne({ _id: req.params.id, role: "retailer", status: "approved" })
            .select("businessDetails name email isShopActive");

        if (!shop) {
            return res.status(404).json({ success: false, message: "Shop not found or not approved" });
        }

        const rating = await calculateShopRating(shop._id);

        res.status(200).json({
            success: true,
            data: {
                id: shop._id,
                name: shop.businessDetails?.storeDisplayName || shop.businessDetails?.businessName || shop.name,
                businessName: shop.businessDetails?.businessName,
                image: shop.businessDetails?.storeImage || "",
                address: shop.businessDetails?.location,
                contact: shop.email,
                isShopActive: shop.isShopActive ?? false,
                rating: rating
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get products for a specific shop
export const getShopProducts = async (req, res) => {
    try {
        const products = await Product.find({ retailer: req.params.shopId, status: "Published" })
            .populate("category", "name")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: products
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Toggle Shop status (Active/Inactive)
export const toggleShopStatus = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).send("Retailer not found");

        user.isShopActive = !user.isShopActive;
        await user.save();

        // Broadcast the status change in real-time
        await emitShopStatusUpdate(user._id, user.isShopActive);

        res.status(200).json({ success: true, isShopActive: user.isShopActive });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Finalize order weight and handle balance adjustments
export const finalizeOrderWeight = async (req, res) => {
    try {
        const { orderId, itemId, actualWeight } = req.body;
        const order = await Order.findOne({ orderId });
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        const item = order.items.id(itemId);
        if (!item) return res.status(404).json({ success: false, message: "Item not found" });

        // Calculate price difference
        const originalPrice = item.price * item.quantity;
        const actualPrice = item.price * (actualWeight / 1); // Logic depends on unit
        const diff = originalPrice - actualPrice;

        item.deliveredWeight = actualWeight;
        await order.save();

        if (diff > 0) {
            await adjustBalance(
                order.user,
                "appUser",
                diff,
                "Credit",
                `Wallet refund for weight variation in order ${orderId}`,
                "System Adjustment",
                orderId
            );
        }

        // Emit real-time update
        const retailerId = req.user.id;
        await emitOrderUpdate(orderId, "Weight Finalized", { orderId, itemId, actualWeight, actualPrice }, retailerId);

        res.status(200).json({ success: true, diff, newPrice: actualPrice });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- RETAILER DASHBOARD ANALYTICS ---
export const getRetailerDashboardStats = async (req, res) => {
    try {
        const retailerId = req.user.id;

        // Fetch all orders containing items from this retailer
        const orders = await Order.find({ "items.retailer": retailerId });

        let totalRevenue = 0;
        let totalOrders = orders.length;
        const customerIds = new Set();
        let newOrdersCount = 0;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        orders.forEach(order => {
            customerIds.add(order.user.toString());

            if (new Date(order.createdAt) >= yesterday) {
                newOrdersCount++;
            }

            order.items.forEach(item => {
                if (item.retailer.toString() === retailerId) {
                    totalRevenue += item.price * item.quantity;
                }
            });
        });

        const activeProducts = await Product.countDocuments({ retailer: retailerId, status: "Published" });
        const totalCustomers = customerIds.size;

        // Last 7 days chart data
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const ordersLast7Days = await Order.aggregate([
            {
                $match: {
                    "items.retailer": req.user._id, // Match retailer in items
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $unwind: "$items"
            },
            {
                $match: {
                    "items.retailer": req.user._id // Ensure we only sum items for this retailer
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Format chart data
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const chartData = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split("T")[0];
            const found = ordersLast7Days.find(o => o._id === dateStr);
            chartData.push({
                name: days[d.getDay()],
                sales: found ? found.revenue : 0
            });
        }

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalRevenue,
                    totalOrders,
                    newOrders: newOrdersCount,
                    activeProducts,
                    totalCustomers,
                    isShopActive: (await User.findById(retailerId)).isShopActive
                },
                chartData
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

import Payout from "../models/Payout.js";

export const getRetailerRevenueStats = async (req, res) => {
    try {
        const retailerId = req.user._id;

        // 1. Calculate Total Earnings (Lifetime) and This Month's Earnings
        const orders = await Order.find({ "items.retailer": retailerId });

        let totalEarnings = 0;
        let earningsThisMonth = 0;

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        orders.forEach(order => {
            order.items.forEach(item => {
                if (item.retailer && item.retailer.toString() === retailerId.toString()) {
                    const itemRevenue = item.price * item.quantity;
                    totalEarnings += itemRevenue;

                    if (new Date(order.createdAt) >= startOfMonth) {
                        earningsThisMonth += itemRevenue;
                    }
                }
            });
        });

        // 2. Fetch Payouts to calculate Settled and Requested
        const payouts = await Payout.find({ retailer: retailerId });

        let totalSettled = 0;
        let totalRequestedOrPending = 0;

        payouts.forEach(payout => {
            if (payout.status === 'Approved') {
                totalSettled += payout.amount;
                totalRequestedOrPending += payout.amount; // Since it's already approved, it's taken from available balance
            } else if (payout.status === 'Pending') {
                totalRequestedOrPending += payout.amount; // Pending is also locked from available balance
            }
        });

        // 3. Calculate Available Balance
        const availableBalance = totalEarnings - totalRequestedOrPending;

        res.status(200).json({
            success: true,
            data: {
                availableBalance: availableBalance > 0 ? availableBalance : 0,
                estimatedEarnings: earningsThisMonth,
                totalSettled: totalSettled,
                totalEarnings: totalEarnings
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getRetailerCustomers = async (req, res) => {
    try {
        const retailerId = req.user._id;

        // 1. Get all orders involving this retailer and populate customer info
        const orders = await Order.find({ "items.retailer": retailerId }).populate("user", "fullName email phoneNumber profilePicture");

        const customerMap = new Map();

        let newCustomersCount = 0;
        let repeatCustomersCount = 0;

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        orders.forEach(order => {
            if (!order.user) return; // safety check

            const customerId = order.user._id.toString();

            // Calculate spend ONLY for items from this retailer
            let orderSpendForRetailer = 0;
            order.items.forEach(item => {
                if (item.retailer && item.retailer.toString() === retailerId.toString()) {
                    orderSpendForRetailer += item.price * item.quantity;
                }
            });

            if (!customerMap.has(customerId)) {
                customerMap.set(customerId, {
                    user: order.user,
                    orderCount: 1,
                    totalSpend: orderSpendForRetailer,
                    orderIds: [order.orderId],
                    firstOrderDate: order.createdAt,
                    lastOrderDate: order.createdAt
                });
            } else {
                const customerData = customerMap.get(customerId);
                customerData.orderCount++;
                customerData.totalSpend += orderSpendForRetailer;
                if (!customerData.orderIds.includes(order.orderId)) {
                    customerData.orderIds.push(order.orderId);
                }
                if (new Date(order.createdAt) > new Date(customerData.lastOrderDate)) {
                    customerData.lastOrderDate = order.createdAt;
                }
                if (new Date(order.createdAt) < new Date(customerData.firstOrderDate)) {
                    customerData.firstOrderDate = order.createdAt;
                }
            }
        });

        const myCustomersArray = Array.from(customerMap.values()).map(({ user, orderCount, totalSpend, orderIds, firstOrderDate, lastOrderDate }) => {
            let status = "Active";
            if (orderCount > 3 || totalSpend > 2000) status = "VIP";
            else if (new Date(firstOrderDate) >= thirtyDaysAgo) status = "New";

            if (new Date(firstOrderDate) >= thirtyDaysAgo) {
                newCustomersCount++;
            }
            if (orderCount > 1) {
                repeatCustomersCount++;
            }

            return {
                id: user._id,
                name: user.fullName || "Customer",
                email: user.email || "N/A",
                phone: user.phoneNumber || "N/A",
                orderCount,
                orderIds,
                spend: totalSpend.toFixed(2),
                status,
                image: user.profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${(user.fullName || 'User').replace(/\s+/g, '')}`
            };
        });

        const totalCustomers = myCustomersArray.length;
        const repeatPercentage = totalCustomers > 0 ? Math.round((repeatCustomersCount / totalCustomers) * 100) : 0;

        // Chart Data - Unique customers per day (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const chartData = [];

        for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo);
            d.setDate(d.getDate() + i);
            const nextD = new Date(d);
            nextD.setDate(nextD.getDate() + 1);

            // Count unique customers who ordered on this day
            const custsThisDay = new Set();
            orders.forEach(order => {
                if (!order.user) return;
                const orderDate = new Date(order.createdAt);
                if (orderDate >= d && orderDate < nextD) {
                    custsThisDay.add(order.user._id.toString());
                }
            });

            chartData.push({
                name: days[d.getDay()],
                customers: custsThisDay.size
            });
        }

        // Sort customers by highest output
        myCustomersArray.sort((a, b) => parseFloat(b.spend) - parseFloat(a.spend));

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalCustomers,
                    newCustomers: newCustomersCount,
                    repeatPercentage: `${repeatPercentage}%`
                },
                chartData,
                customers: myCustomersArray
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getRetailerOrders = async (req, res) => {
    try {
        const retailerId = req.user._id;
        const { customerId } = req.query;

        // Build query
        const query = { "items.retailer": retailerId };
        if (customerId) {
            query.user = customerId;
        }

        // Fetch all orders containing items from this retailer and populate product, rider, and subscription info
        const orders = await Order.find(query)
            .populate("items.product", "name")
            .populate("rider", "name")
            .populate("subscriptionId", "frequency customDays")
            .sort({ createdAt: -1 });

        // Calculate Stats
        const totalOrders = orders.length;
        let pendingOrders = 0;
        let completedOrders = 0;
        let totalRevenue = 0;

        const formattedOrders = [];

        orders.forEach(order => {
            let retailerOrderTotal = 0;
            let productNames = [];

            // Filter items specific to this retailer
            const retailerItems = order.items.filter(item => item.retailer && item.retailer.toString() === retailerId.toString());

            retailerItems.forEach(item => {
                retailerOrderTotal += item.price * item.quantity;
                productNames.push(`${item.quantity}x ${item.product?.name || 'Unknown Product'}`);
            });

            totalRevenue += retailerOrderTotal;

            // Determine order status for this retailer
            let status = order.status;

            if (['Pending', 'Accepted', 'Processing', 'Preparing', 'Shipped', 'Out for Delivery', 'Rider Assigned', 'Rider Accepted'].includes(status)) {
                pendingOrders++;
            } else if (status === 'Delivered' || status === 'Completed') {
                completedOrders++;
            }

            formattedOrders.push({
                id: order.orderId || `#${order._id.toString().slice(-6).toUpperCase()}`,
                product: productNames.join(", "),
                date: new Date(order.createdAt).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true
                }).replace(/\//g, "-"),
                price: retailerOrderTotal.toFixed(2),
                payment: order.paymentStatus,
                status: status,
                orderType: order.orderType || ((order.orderId || "").startsWith("SUB-") ? "Subscription" : "One-time"),
                rider: order.rider,
                subscriptionDetails: order.subscriptionId ? {
                    frequency: order.subscriptionId.frequency,
                    customDays: order.subscriptionId.customDays
                } : null,
                statusHistory: order.statusHistory
            });
        });

        const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : "0.00";
        const completedPercentage = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalOrders,
                    pendingOrders,
                    completedOrders,
                    completedPercentage: `${completedPercentage}%`,
                    avgOrderValue: `₹${avgOrderValue}`
                },
                orders: formattedOrders
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateOrderItemStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const retailerId = req.user._id;

        const order = await Order.findOne({ orderId }).populate('user', '_id');
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        // Guard: prevent setting the same status again
        if (order.status === status) {
            return res.status(400).json({ success: false, message: `Order is already in '${status}' status.` });
        }

        // Enforce sequential flow for retailer actions
        // Pending -> Accepted
        // Accepted -> Processing
        if (status === "Accepted" && order.status !== "Pending") {
            return res.status(400).json({ success: false, message: "Order must be 'Pending' to mark as 'Accepted'." });
        }
        if (status === "Processing" && order.status !== "Accepted") {
            return res.status(400).json({ success: false, message: "Order must be 'Accepted' to mark as 'Processing'." });
        }

        // Update all items belonging to this retailer in this order
        let updated = false;
        order.items.forEach(item => {
            if (item.retailer && item.retailer.toString() === retailerId.toString()) {
                item.status = status;
                updated = true;
            }
        });

        if (!updated) {
            return res.status(400).json({ success: false, message: "No items found for this retailer in this order" });
        }

        // Update overall order status
        order.status = status;

        // Push to statusHistory audit trail
        order.statusHistory = order.statusHistory || [];
        order.statusHistory.push({
            status,
            changedBy: retailerId,
            role: 'retailer',
            timestamp: new Date()
        });

        await order.save();

        // Emit real-time update to order room, retailer room, and user room
        const userId = order.user?._id || order.user;
        await emitOrderUpdate(orderId, status, { orderId, status, statusHistory: order.statusHistory }, retailerId, userId);

        // Notify Retailer and Customer of status changes
        if (status === "Delivered") {
            const customer = await (await import("../models/AppUser.js")).default.findById(userId);
            createNotification(retailerId.toString(), {
                title: `Order Delivered! 🎉`,
                message: `Order #${orderId.slice(-6).toUpperCase()} delivered to ${customer?.fullName || "Customer"} customer by your team.`,
                type: "Order",
                referenceId: orderId
            });

            // Notify Customer
            createNotification(userId.toString(), {
                title: `Order Delivered! 🎉`,
                message: `Your order #${orderId.slice(-6).toUpperCase()} has been delivered. Enjoy your meal!`,
                type: "Order",
                referenceId: orderId
            });
        } else {
            // Notify Customer for status updates like Accepted or Processing
            const statusEmojis = {
                "Accepted": "✅",
                "Processing": "👨‍🍳",
                "Preparing": "🍱",
                "Shipped": "🚚"
            };
            const emoji = statusEmojis[status] || "📦";
            
            createNotification(userId.toString(), {
                title: `Order Update: ${status} ${emoji}`,
                message: `Your order #${orderId.slice(-6).toUpperCase()} is now ${status.toLowerCase()}.`,
                type: "Order",
                referenceId: orderId
            });
        }

        res.status(200).json({ success: true, message: "Order status updated successfully", order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


export const getRetailerReviews = async (req, res) => {
    try {
        const retailerId = req.user._id;

        // 1. Fetch Product Reviews and General Experience Reviews for this retailer
        const [productReviews, orderReviews] = await Promise.all([
            Review.find({ retailer: retailerId })
                .populate("user", "fullName profilePicture phoneNumber email")
                .populate("product", "name")
                .populate("order", "orderId")
                .sort({ createdAt: -1 }),
            OrderReview.find({ retailers: retailerId })
                .populate("user", "fullName profilePicture phoneNumber email")
                .populate("order", "orderId")
                .sort({ createdAt: -1 })
        ]);

        // 2. Group reviews by Order ID
        const groupedByOrder = {};

        // Process Product Reviews
        productReviews.forEach(r => {
            const orderId = r.order?._id?.toString() || r.order?.toString() || "No-Order";
            if (!groupedByOrder[orderId]) {
                groupedByOrder[orderId] = {
                    orderId: r.order?.orderId || "One-time Purchase",
                    user: r.user ? {
                        name: r.user.fullName,
                        phone: r.user.phoneNumber || "N/A",
                        image: r.user.profilePicture
                    } : { name: "Anonymous", phone: "N/A" },
                    date: r.createdAt,
                    overallExperience: null,
                    productRatings: []
                };
            }
            groupedByOrder[orderId].productRatings.push({
                productName: r.product?.name || "Unknown Product",
                rating: r.rating,
                comment: r.comment || ""
            });
        });

        // Process General Order Reviews
        orderReviews.forEach(r => {
            const orderId = r.order?._id?.toString() || r.order?.toString() || "No-Order";
            if (!groupedByOrder[orderId]) {
                groupedByOrder[orderId] = {
                    orderId: r.order?.orderId || "Subscription",
                    user: r.user ? {
                        name: r.user.fullName,
                        phone: r.user.phoneNumber || "N/A",
                        image: r.user.profilePicture
                    } : { name: "Anonymous", phone: "N/A" },
                    date: r.createdAt,
                    overallExperience: null,
                    productRatings: []
                };
            }
            groupedByOrder[orderId].overallExperience = {
                rating: r.rating,
                comment: r.comment || ""
            };
        });

        // 3. Convert to sorted array and format dates
        const reviewsByOrder = Object.values(groupedByOrder)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(group => ({
                ...group,
                date: new Date(group.date).toLocaleDateString("en-GB", { 
                    day: '2-digit', month: 'short', year: 'numeric' 
                })
            }));

        // 4. Calculate Stats (Base it on the consolidated ratings)
        let totalVal = 0;
        let count = 0;
        let positive = 0;
        const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

        reviewsByOrder.forEach(o => {
            if (o.overallExperience) {
                totalVal += o.overallExperience.rating;
                distribution[o.overallExperience.rating]++;
                if (o.overallExperience.rating >= 4) positive++;
                count++;
            }
            
            // Factor in every product rating into the weight
            o.productRatings.forEach(pr => {
                totalVal += pr.rating;
                distribution[pr.rating]++;
                if (pr.rating >= 4) positive++;
                count++;
            });
        });

        const stats = {
            averageRating: count > 0 ? (totalVal / count).toFixed(1) : "0.0",
            totalReviews: count,
            positivePercentage: count > 0 ? Math.round((positive / count) * 100) : 0,
            distribution: {
                5: count > 0 ? Math.round((distribution[5] / count) * 100) : 0,
                4: count > 0 ? Math.round((distribution[4] / count) * 100) : 0,
                3: count > 0 ? Math.round((distribution[3] / count) * 100) : 0,
                2: count > 0 ? Math.round((distribution[2] / count) * 100) : 0,
                1: count > 0 ? Math.round((distribution[1] / count) * 100) : 0,
            }
        };

        res.status(200).json({
            success: true,
            data: {
                stats,
                reviews: reviewsByOrder
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const assignRiderToOrder = async (req, res) => {
    try {
        const { orderId, riderId } = req.body;
        const retailerId = req.user._id;
        const order = await Order.findOne({ orderId, "items.retailer": retailerId });
        if (!order) return res.status(404).json({ success: false, message: "Order not found or access denied" });
        order.rider = riderId;
        order.riderAssignmentStatus = "Pending";
        order.status = "Rider Assigned"; // Sync main order status

        // Sync individual item statuses for this retailer
        order.items.forEach(item => {
            if (item.retailer && item.retailer.toString() === retailerId.toString()) {
                item.status = "Rider Assigned";
            }
        });

        await order.save();

        // Emit real-time update to retailer and rider
        await emitOrderUpdate(orderId, "Rider Assigned", { orderId, riderId, order }, retailerId, null, riderId);

        // Notify Rider via Push Notification
        try {
            const riderUser = await User.findById(riderId).select("fcmToken name");
            if (riderUser && riderUser.fcmToken) {
                const { sendPushNotification } = await import("../services/notificationService.js");
                await sendPushNotification(
                    riderUser.fcmToken,
                    "New Order Assigned! 🏍️",
                    `You have been assigned to Order #${orderId.slice(-6).toUpperCase()}. Open the app for details.`,
                    { type: "NewAssignment", orderId }
                );
            }
        } catch (pushErr) {
            console.error("Non-blocking Rider Assignment Push error:", pushErr.message);
        }

        res.status(200).json({ success: true, message: "Rider assigned successfully", data: order });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Bank Accounts Management ────────────────────────────────────────────────

export const getBankAccounts = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("bankAccounts");
        res.status(200).json({ success: true, bankAccounts: user.bankAccounts || [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const addBankAccount = async (req, res) => {
    try {
        const { bankName, accountNumber, ifscCode, accountHolderName } = req.body;
        
        // Basic validation matching frontend requirements
        if (!/^\d+$/.test(accountNumber)) {
            return res.status(400).json({ success: false, message: "Account number must contain only numbers." });
        }
        if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(ifscCode)) {
            return res.status(400).json({ success: false, message: "Invalid IFSC Code format. Must be 11 characters, first 4 letters, 5th is '0', last 6 alphanumeric." });
        }

        const user = await User.findById(req.userId);
        const newBank = {
            bankName,
            accountNumber,
            ifscCode: ifscCode.toUpperCase(),
            accountHolderName,
            isDefault: user.bankAccounts.length === 0
        };

        user.bankAccounts.push(newBank);
        await user.save();

        res.status(201).json({ success: true, message: "Bank account added successfully", bankAccounts: user.bankAccounts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteBankAccount = async (req, res) => {
    const { bankId } = req.params;
    try {
        console.log(`[BANK_DELETE] Attempting to delete bank ${bankId} for user ${req.userId}`);
        
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Pull the bank account by ID - the most robust method in Mongoose
        user.bankAccounts.pull({ _id: bankId });
        await user.save();

        console.log(`[BANK_DELETE] Successfully deleted bank ${bankId}`);
        res.status(200).json({ success: true, message: "Bank account deleted successfully", bankAccounts: user.bankAccounts });
    } catch (error) {
        console.error(`[BANK_DELETE] Error deleting bank ${bankId}:`, error);
        res.status(500).json({ success: false, message: error.message });
    }
};

