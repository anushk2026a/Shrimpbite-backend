import mongoose from "mongoose";

const OrderReviewSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AppUser",
        required: true
    },
    retailers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: false
    }
}, { timestamps: true });

// Prevent duplicate order reviews for the same order
OrderReviewSchema.index({ order: 1, user: 1 }, { unique: true });

export default mongoose.model("OrderReview", OrderReviewSchema);
