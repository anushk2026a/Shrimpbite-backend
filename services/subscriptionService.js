import Subscription from "../models/Subscription.js";
import Order from "../models/Order.js";
import { emitOrderUpdate } from "./socketService.js";
import Product from "../models/Product.js";
import { adjustBalance } from "./walletService.js";
import mongoose from "mongoose";
import { createNotification } from "./notificationService.js";


export const cancelSubscription = async (id) => {
    const sub = await Subscription.findById(id).populate('product');
    if (!sub) throw new Error("Subscription not found");

    // 1. Get current hour in IST
    const istTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false
    }).format(new Date());

    const currentHourIST = parseInt(istTime);

    // Cutoff: 8 PM (20:00)
    if (currentHourIST < 20) {
        // [BEFORE 8 PM] Cancel immediately
        sub.status = "Cancelled";
        sub.cancelAtMidnight = false;
        await sub.save();

        // Notify retailer immediately so they remove it from prep list
        const { emitOrderUpdate } = await import("./socketService.js");
        emitOrderUpdate("SUB-CANCEL", "Cancelled", { subscriptionId: sub._id }, sub.retailer, sub.user);
    } else {
        // [AFTER 8 PM] Cancel after tonight's delivery (Grace period)
        sub.status = "PendingCancellation";
        sub.cancelAtMidnight = true;
        await sub.save();
    }

    return sub;
};

export const generateDailyOrders = async (targetDate = new Date()) => {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayName = dayNames[targetDate.getDay()];

    // 1. Find active or pending cancellation subscriptions
    const subscriptions = await Subscription.find({ 
        status: { $in: ["Active", "PendingCancellation"] } 
    }).populate("product");

    const stats = { created: 0, failed: 0, skipped: 0 };

    for (const sub of subscriptions) {
        if (sub.status === "Paused" || (sub.status === "Cancelled" && !sub.cancelAtMidnight)) {
            stats.skipped++;
            continue;
        }

        try {
            let shouldDeliver = false;
            
            // Normalize dates for accurate comparison
            const subStart = new Date(sub.startDate);
            subStart.setHours(0, 0, 0, 0);
            const targetDay = new Date(targetDate);
            targetDay.setHours(0, 0, 0, 0);

            // Frequency Checks
            if (sub.frequency === "Daily") {
                shouldDeliver = true;
            } else if (sub.frequency === "Alternate Days") {
                const diffTime = Math.abs(targetDay - subStart);
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays % 2 === 0) shouldDeliver = true;
            } else if (sub.frequency === "Weekly") {
                if (sub.customDays && sub.customDays.some(d => d.toLowerCase() === currentDayName.toLowerCase())) {
                    shouldDeliver = true;
                }
            }

            // Vacation Check
            const isOnVacation = sub.vacationDates.some(vDate => {
                const vacationDate = new Date(vDate);
                vacationDate.setHours(0, 0, 0, 0);
                return vacationDate.getTime() === targetDay.getTime();
            });

            if (!shouldDeliver || isOnVacation || targetDay < subStart) {
                stats.skipped++;
                continue;
            }

            // [NEW] Prevent multiple notifications/orders if job is triggered repeatedly
            if (sub.lastGeneratedDate && sub.lastGeneratedDate.toDateString() === targetDate.toDateString()) {
                stats.skipped++;
                continue;
            }

            const product = sub.product;
            const amount = product.price * sub.quantity;

            // 5. Debit Wallet and Create Order
            await adjustBalance(
                sub.user,
                "appUser",
                amount,
                "Debit",
                `Subscription Delivery: ${product.name}`,
                "Wallet",
                sub._id
            );

            const orderId = `SUB-${Date.now()}-${sub._id.toString().slice(-4)}`;
            const newOrder = await Order.create({
                orderId,
                user: sub.user,
                items: [{
                    product: product._id,
                    retailer: sub.retailer,
                    quantity: sub.quantity,
                    price: product.price,
                    status: "Accepted"
                }],
                totalAmount: amount,
                orderType: "Subscription",
                subscriptionId: sub._id,
                paymentStatus: "Paid",
                paymentMethod: "Wallet"
            });

            sub.lastGeneratedDate = targetDate;
            
            // Auto-finalise cancellation if it was pending
            if (sub.cancelAtMidnight) {
                sub.status = "Cancelled";
                sub.cancelAtMidnight = false;
            }

            await sub.save();

            // Notify retailer
            await emitOrderUpdate(newOrder.orderId, "Accepted", {
                ...newOrder.toObject(),
                product: `${sub.quantity}x ${product.name}`,
                subscriptionDetails: { frequency: sub.frequency, customDays: sub.customDays }
            }, newOrder.items[0].retailer, sub.user);

            stats.created++;

        } catch (error) {
            console.error(`Failed sub ${sub._id}:`, error.message);
            stats.failed++;
            
            if (error.message.includes("Insufficient wallet balance")) {
                sub.lastGeneratedDate = targetDate;
                await sub.save();
                await createNotification(sub.user.toString(), {
                    title: "Subscription Delivery Failed ⚠️",
                    message: `Insufficient wallet balance for "${sub.product.name}". Delivery paused.`,
                    type: "System",
                    referenceId: sub._id.toString()
                });
            }
        }
    }

    return stats;
};
