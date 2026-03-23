import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    // silverPrice: {
    //     type: Number,
    //     default: 0
    // },
    // goldPrice: {
    //     type: Number,
    //     default: 0
    // },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: false
    },
    images: [{
        type: String // Cloudinary URLs
    }],
    stock: {
        type: Number,
        default: 0
    },
    dailyCapacity: {
        type: Number,
        default: 50
    },
    stockStatus: {
        type: String,
        enum: ["In Stock", "Out of Stock", "Low Stock"],
        default: "In Stock"
    },
    // sku: {
    //     type: String,
    //     unique: true,
    //     sparse: true
    // },
    retailer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Assuming User model is used for Retailers too, or I should check Retailer model if any
        required: true
    },
    status: {
        type: String,
        enum: ["Published", "Draft", "Archived"],
        default: "Published"
    },
    rating: {
        type: Number,
        default: 0
    },
    hasDiscount: {
        type: Boolean,
        default: false
    },
    isFreeShipping: {
        type: Boolean,
        default: false
    },
    isSameDayDelivery: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

export default mongoose.model("Product", ProductSchema);
