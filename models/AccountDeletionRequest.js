import mongoose from "mongoose";

const accountDeletionRequestSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AppUser", // Assuming AppUser is the user model
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
        },
        region: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ["pending", "reviewed", "completed", "rejected"],
            default: "pending",
        },
        adminNotes: {
            type: String,
        }
    },
    { timestamps: true }
);

const AccountDeletionRequest = mongoose.model("AccountDeletionRequest", accountDeletionRequestSchema);

export default AccountDeletionRequest;
