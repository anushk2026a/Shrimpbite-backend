import mongoose from "mongoose"

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: false,
        unique: true,
        sparse: true
    },
    password: {
        type: String,
        required: false
    },
    role: {
        type: String,
        enum: ["admin", "retailer", "rider"],
        default: "retailer"
    },
    adminRole: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Role"
    },
    isPasswordResetRequired: {
        type: Boolean,
        default: false
    },
    walletBalance: { type: Number, default: 0 },
    isShopActive: { type: Boolean, default: true },
    phone: {
        type: String,
        required: function() { return this.role !== "admin"; },
        unique: true,
        sparse: true
    },
    alternateContact: String,
    whatsappNumber: String,
    status: {
        type: String,
        enum: ["draft", "under_review", "approved", "rejected"],
        default: "draft"
    },
    rejectionReason: {
        type: String,
        default: ""
    },
    businessDetails: {
        businessName: String,
        storeDisplayName: String,
        ownerName: String,
        businessType: String,
        yearsInBusiness: String,
        coldStorage: String,
        monthlyPurchaseVolume: String,
        location: {
            address: String,
            city: String,
            state: String,
            pincode: String,
            landmark: String,
        },
        legal: {
            gst: String,
            fssai: String,
            licenseUrl: String,
            gstCertificateUrl: String
        },
        storeImage: String
    },
    fcmToken: {
        type: String
    }
}, { timestamps: true })

export default mongoose.model("User", userSchema, "users")