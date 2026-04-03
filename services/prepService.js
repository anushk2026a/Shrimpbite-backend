import Order from "../models/Order.js";
import Subscription from "../models/Subscription.js";
import Product from "../models/Product.js";

export const getDailyPrepList = async (retailerId, dateString) => {
    const targetDate = new Date(dateString || new Date());
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(targetDate.getDate() + 1);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isFuture = targetDate > today;
    const requirements = {};

    const targetDateISO = targetDate.toISOString().split('T')[0];

    const addItemToRequirements = (item, type, status = "Pending") => {
        if (!item.product) return;
        const prodId = item.product._id.toString();
        
        // Find if this is a variant-based order
        const variant = item.product.variants?.find(v => v._id?.toString() === item.variantId?.toString());
        const weightToSum = variant ? variant.weightInKg : 1.0; // Default to 1kg if no variant

        if (!requirements[prodId]) {
            requirements[prodId] = {
                id: prodId,
                productName: item.product.name,
                category: item.product.category || "Uncategorized",
                quantity: 0, // This is count (how many packs)
                totalWeight: 0, // This is actual kilos to prepare
                unit: "kg",
                orderCount: 0,
                subscriptionCount: 0,
                oneTimeCount: 0,
                processedCount: 0,
                status: "Pending"
            };
        }
        requirements[prodId].quantity += item.quantity;
        requirements[prodId].totalWeight += (weightToSum * item.quantity);
        requirements[prodId].orderCount += 1;
        if (type === "Subscription") requirements[prodId].subscriptionCount += 1;
        else requirements[prodId].oneTimeCount += 1;

        const processedStatuses = ["Accepted", "Processing", "Preparing", "Shipped", "Out for Delivery", "Delivered", "Completed", "Rider Assigned", "Rider Accepted"];
        if (processedStatuses.includes(status)) {
            requirements[prodId].processedCount += 1;
        }
    };

    // 1. Gather all existing orders for this date
    const orders = await Order.find({
        "items.retailer": retailerId,
        createdAt: { $gte: targetDate, $lt: nextDay },
        status: { $nin: ["Cancelled"] }
    }).populate("items.product");

    const existingSubIds = new Set(orders.filter(o => o.orderType === "Subscription").map(o => o.subscriptionId?.toString()));

    // 2. Process existing orders first (ONLY SUBSCRIPTIONS)
    orders.forEach(order => {
        if (order.orderType !== "Subscription") return;
        order.items.forEach(item => {
            if (item.retailer && item.retailer.toString() === retailerId.toString()) {
                addItemToRequirements(item, order.orderType, item.status);
            }
        });
    });

    // 3. Smart Predictive Mode: Filter active subscriptions
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetDayName = dayNames[targetDate.getDay()];

    const subscriptions = await Subscription.find({
        retailer: retailerId,
        status: { $in: ["Active", "PendingCancellation", "Paused"] },
        startDate: { $lt: nextDay } 
    }).populate("product").populate("user");

    for (const sub of subscriptions) {
        if (!sub.user) continue;

        const productPrice = sub.product?.price || 0;
        if (sub.user.walletBalance < (productPrice * sub.quantity)) continue;
        if (!isFuture && existingSubIds.has(sub._id.toString())) continue;

        let shouldDeliver = false;
        const subStart = new Date(sub.startDate);
        subStart.setHours(0, 0, 0, 0);
        const target = new Date(targetDate);
        target.setHours(0, 0, 0, 0);

        if (sub.frequency === "Daily") {
            shouldDeliver = true;
        } else if (sub.frequency === "Alternate Days") {
            const diffTime = Math.abs(target - subStart);
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays % 2 === 0) shouldDeliver = true;
        } else if (sub.frequency === "Weekly") {
            if (sub.customDays && sub.customDays.some(d => d.toLowerCase() === targetDayName.toLowerCase())) shouldDeliver = true;
        }

        const isOnVacation = sub.vacationDates && sub.vacationDates.some(vDate => {
            const vString = new Date(vDate).toISOString().split('T')[0];
            return vString === targetDateISO;
        });

        if (target < subStart) shouldDeliver = false;

        if (shouldDeliver) {
            // Determine display status for the UI
            let displayStatus = "Pending";
            if (sub.status === "Paused") {
                displayStatus = "Paused";
            } else if (isOnVacation) {
                // Using DD/MM format
                const [yyyy, mm, dd] = targetDateISO.split('-');
                displayStatus = `Paused for ${dd}/${mm}`;
            }

            // Only add to summary totals if it actually needs to be prepared
            if (displayStatus === "Pending") {
                addItemToRequirements({
                    product: sub.product,
                    quantity: sub.quantity,
                    variantId: sub.variantId,
                    weightLabel: sub.weightLabel,
                }, "Subscription", "Pending");
            }
        }
    }

    // 4. Build Final Response
    const detailedItems = [];

    // Add items from existing orders
    for (const order of orders) {
        if (order.orderType !== "Subscription") continue;
        
        // Find subscription details
        const sub = await Subscription.findById(order.subscriptionId).select('frequency customDays status');

        order.items.forEach(item => {
            if (item.retailer && item.retailer.toString() === retailerId.toString()) {
                detailedItems.push({
                    id: order._id + "_" + item.product._id,
                    orderId: order.orderId,
                    orderType: order.orderType,
                    productId: item.product._id,
                    productName: item.product.name,
                    quantity: item.quantity,
                    weightLabel: item.weightLabel || "",
                    unit: "kg",
                    status: item.status,
                    frequency: sub?.frequency || "Subscription",
                    customDays: sub?.customDays || [],
                    isLastDelivery: sub?.status === "PendingCancellation"
                });
            }
        });
    }

    // Add items from predictive subscriptions (that don't have an order yet)
    for (const sub of subscriptions) {
        // ... (logic remains same, just adding field to push)
        let shouldDeliver = false;
        const subStart = new Date(sub.startDate);
        subStart.setHours(0, 0, 0, 0);
        const target = new Date(targetDate);
        target.setHours(0, 0, 0, 0);

        const productPrice = sub.product?.price || 0;
        if (!sub.user || sub.user.walletBalance < (productPrice * sub.quantity)) continue;
        if (!isFuture && existingSubIds.has(sub._id.toString())) continue;

        if (sub.frequency === "Daily") {
            shouldDeliver = true;
        } else if (sub.frequency === "Alternate Days") {
            const diffTime = Math.abs(target - subStart);
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays % 2 === 0) shouldDeliver = true;
        } else if (sub.frequency === "Weekly") {
            if (sub.customDays && sub.customDays.some(d => d.toLowerCase() === targetDayName.toLowerCase())) shouldDeliver = true;
        }

        const isOnVacation = sub.vacationDates && sub.vacationDates.some(vDate => {
            const vString = new Date(vDate).toISOString().split('T')[0];
            return vString === targetDateISO;
        });

        if (target < subStart) shouldDeliver = false;

        if (shouldDeliver) {
            // Determine display status for the UI
            let displayStatus = "Pending";
            if (sub.status === "Paused") {
                displayStatus = "Paused";
            } else if (isOnVacation) {
                const [yyyy, mm, dd] = targetDateISO.split('-');
                displayStatus = `Paused for ${dd}/${mm}`;
            }

            detailedItems.push({
                id: "PRE-" + sub._id,
                orderId: "WAITING-BILLING",
                orderType: "Subscription",
                productId: sub.product._id,
                productName: sub.product.name,
                quantity: sub.quantity,
                weightLabel: sub.weightLabel || "",
                unit: "kg",
                status: displayStatus,
                frequency: sub.frequency,
                customDays: sub.customDays,
                isLastDelivery: sub.status === "PendingCancellation"
            });
        }
    }

    return {
        summary: Object.values(requirements).filter(r => r.subscriptionCount > 0),
        detailed: detailedItems
    };
};
