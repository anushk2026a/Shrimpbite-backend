import mongoose from "mongoose";
import User from "./models/User.js";
import dotenv from "dotenv";

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log("Connected to MongoDB.");

    const result = await User.updateOne(
        { email: "info@shrimpbite.in" },
        { 
            $set: { 
                "businessDetails.location.latitude": 13.1273419,
                "businessDetails.location.longitude": 77.5329874 
            } 
        }
    );

    if (result.modifiedCount > 0) {
        console.log("Successfully updated the exact coordinates!");
    } else {
        console.log("No documents updated. Result:", result);
    }

    process.exit(0);
}).catch(console.error);
