import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AppUser",
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    }
}, { timestamps: true });

// Compound index to ensure a user can only favorite a product once
favoriteSchema.index({ user: 1, product: 1 }, { unique: true });

export default mongoose.model("Favorite", favoriteSchema);
