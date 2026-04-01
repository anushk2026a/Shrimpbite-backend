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

    const addItemToRequirements = (item, type, status = "Pending") => {
        if (!item.product) return;
        const prodId = item.product._id.toString();
        if (!requirements[prodId]) {
            requirements[prodId] = {
                id: prodId,
                productName: item.product.name,
                category: item.product.category || "Uncategorized",
                quantity: 0,
                unit: item.product.unit || "kg",
                orderCount: 0,
                subscriptionCount: 0,
                oneTimeCount: 0,
                processedCount: 0,
                status: "Pending"
            };
        }
        requirements[prodId].quantity += item.quantity;
        requirements[prodId].orderCount += 1;
        if (type === "Subscription") requirements[prodId].subscriptionCount += 1;
        else requirements[prodId].oneTimeCount += 1;

        const processedStatuses = ["Accepted", "Processing", "Preparing", "Shipped", "Out for Delivery", "Delivered", "Completed", "Rider Assigned", "Rider Accepted"];
        if (processedStatuses.includes(status)) {
            requirements[prodId].processedCount += 1;
        }
    };

    if (isFuture) {
        // PREDICTIVE MODE: Analyze active subscriptions
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const targetDayName = dayNames[targetDate.getDay()];

        // Broaden the search by using nextDay so we don't miss subscriptions starting throughout the targetDay
        const subscriptions = await Subscription.find({
            retailer: retailerId,
            status: "Active",
            startDate: { $lt: nextDay } 
        }).populate("product");

        for (const sub of subscriptions) {
            let shouldDeliver = false;
            
            // Normalize dates to start of day for accurate comparison
            const subStart = new Date(sub.startDate);
            subStart.setHours(0, 0, 0, 0);
            const target = new Date(targetDate);
            target.setHours(0, 0, 0, 0);

            // Frequency Logic
            if (sub.frequency === "Daily") {
                shouldDeliver = true;
            } else if (sub.frequency === "Alternate Days") {
                const diffTime = Math.abs(target - subStart);
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays % 2 === 0) shouldDeliver = true;
            } else if (sub.frequency === "Weekly") {
                if (sub.customDays && sub.customDays.some(d => d.toLowerCase() === targetDayName.toLowerCase())) {
                    shouldDeliver = true;
                }
            }

            // Vacation Check
            const isOnVacation = sub.vacationDates && sub.vacationDates.some(vDate => {
                const vacationDate = new Date(vDate);
                vacationDate.setHours(0, 0, 0, 0);
                return vacationDate.getTime() === target.getTime();
            });

            // Ensure the subscription has actually started relative to the target day
            if (target < subStart) {
                shouldDeliver = false;
            }

            if (shouldDeliver && !isOnVacation) {
                addItemToRequirements({
                    product: sub.product,
                    quantity: sub.quantity,
                }, "Subscription", "Pending");
            }
        }
    } else {
        // ACTUAL MODE: Use existing orders
        const orders = await Order.find({
            "items.retailer": retailerId,
            createdAt: { $gte: targetDate, $lt: nextDay },
            status: { $nin: ["Cancelled"] }
        }).populate("items.product");

        orders.forEach(order => {
            order.items.forEach(item => {
                if (item.retailer && item.retailer.toString() === retailerId.toString()) {
                    addItemToRequirements(item, order.orderType, item.status);
                }
            });
        });
    }

    return Object.values(requirements);
};
