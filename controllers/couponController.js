import Coupon from "../models/Coupon.js";

/**
 * POST /api/coupons/apply
 * Applies a coupon code to a cart total and returns calculated discount.
 */
export const applyCoupon = async (req, res) => {
    try {
        const { code, cartTotal, retailerId } = req.body;
        const userId = req.user?._id || req.user?.id;

        if (!code) {
            return res.status(400).json({ success: false, message: "Coupon code is required" });
        }

        const cleanCode = code.trim().toUpperCase();
        const coupon = await Coupon.findOne({ code: cleanCode, isActive: true });

        if (!coupon) {
            return res.status(404).json({ success: false, message: "Invalid or expired coupon code" });
        }

        const now = new Date();
        if (coupon.validFrom && now < coupon.validFrom) {
            return res.status(400).json({ success: false, message: "This coupon is not active yet" });
        }
        if (coupon.validUntil && now > coupon.validUntil) {
            return res.status(400).json({ success: false, message: "This coupon has expired" });
        }

        // Check global usage limit
        if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
            return res.status(400).json({ success: false, message: "This coupon has reached its maximum usage limit" });
        }

        // Check per-user limit
        if (userId && coupon.userUsageLimit) {
            const userUses = coupon.usedBy.filter(u => u.user && u.user.toString() === userId.toString()).length;
            if (userUses >= coupon.userUsageLimit) {
                return res.status(400).json({
                    success: false,
                    message: `You have already used this coupon ${userUses} time(s). Limit: ${coupon.userUsageLimit}`
                });
            }
        }

        // Check retailer scope if specified
        if (coupon.retailer && retailerId && coupon.retailer.toString() !== retailerId.toString()) {
            return res.status(400).json({ success: false, message: "This coupon is not valid for this store" });
        }

        // Check minimum order value
        const subtotal = Number(cartTotal) || 0;
        if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
            return res.status(400).json({
                success: false,
                message: `Minimum order value of ₹${coupon.minOrderValue} required for this coupon`
            });
        }

        // Calculate discount
        let discount = 0;
        if (coupon.discountType === "percentage") {
            discount = (subtotal * coupon.discountValue) / 100;
            if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
                discount = coupon.maxDiscountAmount;
            }
        } else {
            // Flat discount
            discount = coupon.discountValue;
        }

        // Discount cannot exceed subtotal
        if (discount > subtotal) {
            discount = subtotal;
        }

        discount = Math.round(discount * 100) / 100;
        const newTotal = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

        return res.status(200).json({
            success: true,
            message: `Coupon '${coupon.code}' applied successfully! Saved ₹${discount}`,
            data: {
                couponId: coupon._id,
                code: coupon.code,
                title: coupon.title,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                discountAmount: discount,
                originalTotal: subtotal,
                finalTotal: newTotal
            }
        });
    } catch (error) {
        console.error("Apply Coupon Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/coupons/public
 * Returns active coupons for display in app/website.
 */
export const getPublicCoupons = async (req, res) => {
    try {
        const now = new Date();
        const coupons = await Coupon.find({
            isActive: true,
            validUntil: { $gte: now },
            validFrom: { $lte: now }
        }).select("code title description discountType discountValue minOrderValue maxDiscountAmount validUntil").lean();

        res.status(200).json({
            success: true,
            data: coupons
        });
    } catch (error) {
        console.error("Get Public Coupons Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/coupons/admin
 * Admin/Retailer list with stats
 */
export const getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find()
            .populate("retailer", "name businessDetails.shopName")
            .sort({ createdAt: -1 })
            .lean();

        const totalCampaigns = coupons.length;
        const activeCoupons = coupons.filter(c => c.isActive && new Date(c.validUntil) >= new Date()).length;
        const totalRedemptions = coupons.reduce((sum, c) => sum + (c.usageCount || 0), 0);
        const totalSubsidized = coupons.reduce((sum, c) => {
            const given = (c.usedBy || []).reduce((s, u) => s + (u.discountGiven || 0), 0);
            return sum + given;
        }, 0);

        res.status(200).json({
            success: true,
            data: {
                coupons,
                stats: {
                    totalCampaigns,
                    activeCoupons,
                    totalRedemptions,
                    totalSubsidized: Math.round(totalSubsidized)
                }
            }
        });
    } catch (error) {
        console.error("Get All Coupons Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/coupons
 * Create a new coupon
 */
export const createCoupon = async (req, res) => {
    try {
        const {
            code,
            title,
            description,
            discountType,
            discountValue,
            minOrderValue,
            maxDiscountAmount,
            validFrom,
            validUntil,
            usageLimit,
            userUsageLimit,
            retailer
        } = req.body;

        if (!code || !title || !discountValue || !validUntil) {
            return res.status(400).json({
                success: false,
                message: "Code, title, discountValue, and validUntil are required"
            });
        }

        const existing = await Coupon.findOne({ code: code.trim().toUpperCase() });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: `Coupon code '${code.toUpperCase()}' already exists`
            });
        }

        const coupon = await Coupon.create({
            code: code.trim().toUpperCase(),
            title,
            description,
            discountType: discountType || "percentage",
            discountValue: Number(discountValue),
            minOrderValue: Number(minOrderValue) || 0,
            maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
            validFrom: validFrom ? new Date(validFrom) : new Date(),
            validUntil: new Date(validUntil),
            usageLimit: usageLimit ? Number(usageLimit) : 100,
            userUsageLimit: userUsageLimit ? Number(userUsageLimit) : 1,
            retailer: retailer || null
        });

        res.status(201).json({
            success: true,
            message: "Coupon created successfully",
            data: coupon
        });
    } catch (error) {
        console.error("Create Coupon Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PUT /api/coupons/:id
 * Update coupon
 */
export const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (updates.code) {
            updates.code = updates.code.trim().toUpperCase();
        }

        const coupon = await Coupon.findByIdAndUpdate(id, updates, { new: true });
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        res.status(200).json({
            success: true,
            message: "Coupon updated successfully",
            data: coupon
        });
    } catch (error) {
        console.error("Update Coupon Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * DELETE /api/coupons/:id
 * Delete coupon
 */
export const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findByIdAndDelete(id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        res.status(200).json({
            success: true,
            message: "Coupon deleted successfully"
        });
    } catch (error) {
        console.error("Delete Coupon Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
