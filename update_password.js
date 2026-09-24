import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
import dotenv from "dotenv";

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const hashedPassword = await bcrypt.hash("123456", 12);
    const result = await User.updateOne(
        { email: "pragati@gmail.com" },
        { $set: { password: hashedPassword } }
    );
    if (result.modifiedCount > 0) {
        console.log("Successfully updated password to 123456.");
    } else {
        console.log("No documents modified. Update result:", result);
    }
    process.exit(0);
}).catch(console.error);
