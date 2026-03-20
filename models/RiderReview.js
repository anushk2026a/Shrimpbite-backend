import mongoose from "mongoose";

const RiderReviewSchema = new mongoose.Schema({
    rider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Riders are Users with role 'rider'
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AppUser",
        required: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    }
}, { timestamps: true });

// Prevent duplicate rider reviews for the same order
RiderReviewSchema.index({ order: 1, rider: 1 }, { unique: true });

export default mongoose.model("RiderReview", RiderReviewSchema);
