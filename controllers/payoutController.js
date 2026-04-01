import Payout from "../models/Payout.js";
import User from "../models/User.js"; // Assuming Retailer is a type of User or related
import AppUser from "../models/AppUser.js";

export const requestPayout = async (req, res) => {
    try {
        const { amount, bankDetails } = req.body;
        const retailerId = req.user.id;

        const payout = new Payout({
            retailer: retailerId,
            amount,
            bankDetails,
            status: 'Pending'
        });

        await payout.save();

        // Notify Admins about payout request (only those with "Payout Settlements" permission)
        try {
            const { notifyAdminsByModule } = await import("../services/notificationService.js");
            const retailer = await User.findById(retailerId).select("name businessDetails");
            
            await notifyAdminsByModule("Payout Settlements", {
                title: "New Payout Request! 💰",
                message: `Retailer "${retailer.businessDetails?.businessName || retailer.name}" has requested a payout of ₹${amount}.`,
                type: "System",
                referenceId: payout._id.toString()
            });
        } catch (err) {
            console.error("Payout notification error:", err.message);
        }

        res.status(201).json({ message: "Payout requested successfully", payout });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getPayoutHistory = async (req, res) => {
    try {
        const payouts = await Payout.find({ retailer: req.user.id }).sort({ createdAt: -1 });
        res.json(payouts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const approvePayout = async (req, res) => {
    try {
        const { payoutId } = req.params;
        const { transactionId } = req.body;

        const payout = await Payout.findById(payoutId);
        if (!payout) return res.status(404).json({ message: "Payout not found" });

        payout.status = 'Approved';
        payout.transactionId = transactionId;
        payout.processedAt = Date.now();

        await payout.save();

        // Notify Retailer about approved payout
        try {
            const { createNotification } = await import("../services/notificationService.js");
            createNotification(payout.retailer.toString(), {
                title: "Payout Approved! 🎉",
                message: `Your payout request for ₹${payout.amount} has been approved and processed.`,
                type: "System",
                referenceId: payout._id.toString()
            });
        } catch (err) {
            console.error("Retailer payout notification error:", err.message);
        }

        res.json({ message: "Payout approved", payout });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
export const getAllPayouts = async (req, res) => {
    try {
        const payouts = await Payout.find().populate('retailer', 'name email businessDetails').sort({ createdAt: -1 });
        res.json(payouts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
