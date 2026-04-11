import mongoose from "mongoose";
import User from "../models/User.js";
import bcryptjs from "bcryptjs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const createAdmin = async () => {
    try {
        console.log("--------------------------------------------------");
        console.log("🚀 BOOTSTRAP: Production Admin Creation ");
        console.log("--------------------------------------------------");

        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is not defined in .env. Please check your credentials.");
        }

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log("📍 Connected to MongoDB...");

        // --- CONFIGURATION (Reading from .env) ---
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            throw new Error("ADMIN_EMAIL or ADMIN_PASSWORD not found in .env file.");
        }
        // ------------------------------------------

        // Safety Check: Look for existing user
        const existingUser = await User.findOne({ email: adminEmail });

        if (existingUser) {
            console.log(`⚠️  HALT: Admin with email [${adminEmail}] already exists.`);
            console.log("Safe script: No modifications or deletions were performed.");
            console.log("--------------------------------------------------");
            process.exit(0);
        }

        // Hash the password securely
        const salt = await bcryptjs.genSalt(10);
        const hashedPassword = await bcryptjs.hash(adminPassword, salt);

        // Create the Super Admin User
        const adminUser = new User({
            name: "Super Admin",
            email: adminEmail,
            password: hashedPassword,
            role: "admin",
            status: "approved"
        });

        await adminUser.save();

        console.log("✅ SUCCESS: Production Admin account created!");
        console.log(`Email   : ${adminEmail}`);
        console.log(`Password: ${adminPassword}`);
        console.log("");
        console.log("NOTE: You can now log in to your Retailer/Admin panel.");
        console.log("--------------------------------------------------");
        process.exit(0);
    } catch (error) {
        console.error("❌ ERROR:", error.message);
        process.exit(1);
    }
};

createAdmin();
