import User from "../models/User.js";

// Get all retailers
export const getRetailers = async (req, res) => {
    try {
        const { status } = req.query;

        const query = { role: "retailer" };
        if (status) query.status = status;

        const retailers = await User.find(query).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: retailers,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Update retailer status
export const updateRetailerStatus = async (req, res) => {
    try {
        const { userId, status, rejectionReason } = req.body;

        if (status === "rejected" && !rejectionReason) {
            return res.status(400).json({
                success: false,
                message: "Rejection reason is mandatory for rejecting an application.",
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Retailer not found",
            });
        }

        user.status = status;
        if (rejectionReason) user.rejectionReason = rejectionReason;

        await user.save();

        res.status(200).json({
            success: true,
            message: `Retailer ${status} successfully`,
            data: user,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};