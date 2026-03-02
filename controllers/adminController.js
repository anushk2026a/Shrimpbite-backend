import User from "../models/User.js";
import AppUser from "../models/AppUser.js";

// Get all app users
export const getAppUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = "" } = req.query;
        const query = {};

        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phoneNumber: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const totalUsers = await AppUser.countDocuments(query);
        const users = await AppUser.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            data: users,
            pagination: {
                totalUsers,
                totalPages: Math.ceil(totalUsers / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Get all retailers
export const getRetailers = async (req, res) => {
    try {
        const { status, page = 1, limit = 10, search = "" } = req.query;
        const query = { role: "retailer" };
        if (status) query.status = status;

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { "businessDetails.businessName": { $regex: search, $options: "i" } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const totalRetailers = await User.countDocuments(query);
        const retailers = await User.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            data: retailers,
            pagination: {
                totalRetailers,
                totalPages: Math.ceil(totalRetailers / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit)
            }
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