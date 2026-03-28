import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        description: {
            type: String,
            default: "",
        },
        modules: {
            type: [String],
            default: [],
            // e.g., "Dashboard", "Retailers", "App Users", "Order Management", "Payout Settlements", "Communication Hub", "Admin Control"
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model("Role", roleSchema, "roles");
