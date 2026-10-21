import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    discountType: {
        type: String,
        enum: ["percentage", "flat"],
        default: "percentage"
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    minOrderValue: {
        type: Number,
        default: 0,
        min: 0
    },
    maxDiscountAmount: {
        type: Number,
        default: null // Cap for percentage discounts (null = no cap)
    },
    validFrom: {
        type: Date,
        default: Date.now
    },
    validUntil: {
        type: Date,
        required: true
    },
    usageLimit: {
        type: Number,
        default: 100 // Total redemptions across all users (null = unlimited)
    },
    usageCount: {
        type: Number,
        default: 0
    },
    userUsageLimit: {
        type: Number,
        default: 1 // Max times single user can use
    },
    usedBy: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AppUser"
        },
        orderId: String,
        discountGiven: Number,
        usedAt: {
            type: Date,
            default: Date.now
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    retailer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null // null = Global platform coupon
    }
}, { timestamps: true });

// Pre-save uppercase code
couponSchema.pre("save", function (next) {
    if (this.code) this.code = this.code.toUpperCase().trim();
    next();
});

export default mongoose.model("Coupon", couponSchema);
