import Subscription from "../models/Subscription.js";
import Product from "../models/Product.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import { 
    createSubscription as createSubService, 
    cancelSubscription as cancelSubService 
} from "../services/subscriptionService.js";

export const subscribeToProduct = async (req, res) => {
    try {
        const userId = req.userId;
        const { productId, frequency, customDays, quantity, startDate, endDate, variantId, weightLabel } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // 8 PM IST Cut-off Logic (India Standard Time)
        // Ensure consistent rules for everyone regardless of server location (Stockholm, etc.)
        const nowUTC = new Date();
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        const nowIST = new Date(nowUTC.getTime() + istOffsetMs);
        
        const cutoffHour = 20; // 8:00 PM IST
        const isPastCutoff = nowIST.getHours() >= cutoffHour;
        
        let requestedStartDate = new Date(startDate || nowIST);
        requestedStartDate.setHours(0, 0, 0, 0);

        if (isPastCutoff) {
            // Cut-off passed: Next available start is Day After Tomorrow
            const dayAfterTomorrow = new Date(nowIST);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
            dayAfterTomorrow.setHours(0, 0, 0, 0);

            if (requestedStartDate < dayAfterTomorrow) {
                requestedStartDate = dayAfterTomorrow;
            }
        }

        const subscription = await createSubService(userId, {
            product: productId,
            frequency,
            customDays,
            quantity,
            startDate: requestedStartDate,
            endDate,
            ...(variantId && variantId !== "null" ? { variantId } : {}),
            ...(weightLabel && weightLabel !== "null" ? { weightLabel } : {})
        });

        res.status(201).json({
            success: true,
            message: "Subscribed successfully",
            subscription
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getMySubscriptions = async (req, res) => {
    try {
        const subscriptions = await Subscription.find({ user: req.userId })
            .populate("product")
            .populate("retailer", "businessDetails.storeDisplayName");

        res.status(200).json({
            success: true,
            subscriptions
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateVacation = async (req, res) => {
    try {
        const { subscriptionId, startDate, endDate } = req.body;
        const start = new Date(startDate);
        const end = new Date(endDate);

        // 8 PM Cut-off Logic based on Indian Standard Time (IST / UTC+5:30)
        // AWS Stockholm servers default to UTC. 
        const nowUTC = new Date();
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        const nowIST = new Date(nowUTC.getTime() + istOffsetMs);
        
        const cutoffHour = 20; // 8:00 PM IST
        
        // Normalize the user's requested start date to midnight
        const startNormalized = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
        
        // Calculate the minimum exact allowed start date
        const minStartDate = new Date(Date.UTC(
            nowIST.getUTCFullYear(),
            nowIST.getUTCMonth(),
            nowIST.getUTCDate() + (nowIST.getUTCHours() >= cutoffHour ? 2 : 1)
        ));

        if (startNormalized < minStartDate) {
            const day = String(minStartDate.getUTCDate()).padStart(2, '0');
            const month = String(minStartDate.getUTCMonth() + 1).padStart(2, '0');
            const year = minStartDate.getUTCFullYear();
            return res.status(400).json({
                success: false,
                message: `After 8:00 PM cut-off, your vacation can only start from ${day}/${month}/${year}. Please contact the store for urgent changes.`
            });
        }

        const dates = [];
        let current = new Date(start);
        while (current <= end) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }

        const subscription = await Subscription.findOneAndUpdate(
            { _id: subscriptionId, user: req.userId },
            { $addToSet: { vacationDates: { $each: dates } } },
            { new: true }
        );

        if (!subscription) {
            return res.status(404).json({ success: false, message: "Subscription not found" });
        }

        res.status(200).json({
            success: true,
            message: "Vacation dates updated successfully",
            subscription
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const cancelSubscription = async (req, res) => {
    try {
        const { subscriptionId } = req.body;
        
        // Ownership check
        const sub = await Subscription.findOne({ _id: subscriptionId, user: req.userId });
        if (!sub) {
            return res.status(404).json({ success: false, message: "Subscription not found or unauthorized" });
        }

        const result = await cancelSubService(subscriptionId);
        
        const message = result.status === "Cancelled" 
            ? "Subscription cancelled successfully. No further deliveries will be scheduled."
            : "Cut-off (8 PM) passed. Your subscription will be cancelled after tonight's final delivery.";

        res.status(200).json({
            success: true,
            message,
            subscription: result
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateSubscriptionStatus = async (req, res) => {
    try {
        const { subscriptionId, status } = req.body;
        const subscription = await Subscription.findOneAndUpdate(
            { _id: subscriptionId, user: req.userId },
            { status },
            { new: true }
        );

        if (!subscription) {
            return res.status(404).json({ success: false, message: "Subscription not found" });
        }

        res.status(200).json({
            success: true,
            message: `Subscription ${status} successfully`,
            subscription
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateAllSubscriptionStatus = async (req, res) => {
    try {
        const { status } = req.body;
        
        // Ownership check & Bulk update
        // We only update subscriptions that aren't already Cancelled or in PendingCancellation
        const result = await Subscription.updateMany(
            { 
                user: req.userId, 
                status: { $nin: ["Cancelled", "PendingCancellation"] } 
            },
            { status }
        );

        res.status(200).json({
            success: true,
            message: `All active subscriptions have been ${status.toLowerCase()} successfully`,
            updatedCount: result.modifiedCount
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getSubscriptionPlans = async (req, res) => {
    try {
        const plans = await SubscriptionPlan.find();
        res.status(200).json({ success: true, data: plans });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getPublicSubscriptionPlans = async (req, res) => {
    try {
        const plans = await SubscriptionPlan.find({ status: "Active" });
        res.status(200).json({ success: true, data: plans });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createSubscriptionPlan = async (req, res) => {
    try {
        const plan = await SubscriptionPlan.create(req.body);
        res.status(201).json({ success: true, data: plan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateSubscriptionPlan = async (req, res) => {
    try {
        const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
        res.status(200).json({ success: true, data: plan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteSubscriptionPlan = async (req, res) => {
    try {
        const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);
        if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
        res.status(200).json({ success: true, message: "Plan deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
