import mongoose from "mongoose"

let isConnected = false

const connectDB = async () => {
    if (isConnected) {
        return
    }

    try {
        const db = await mongoose.connect(process.env.MONGO_URI)
        isConnected = db.connections[0].readyState === 1
        console.log("MongoDB Connected 🚀")
    } catch (err) {
        console.error("Database Connection Failed ❌", err.message)
        // In serverless, we don't necessarily want to process.exit(1) as it might kill the lambda unfairly
    }
}

export default connectDB
