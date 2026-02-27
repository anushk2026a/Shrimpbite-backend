import mongoose from "mongoose"

let cachedPromise = null

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) {
        return mongoose.connection
    }

    if (!cachedPromise) {
        const opts = {
            bufferCommands: false,
        }

        console.log("Connecting to MongoDB... ⏳")
        cachedPromise = mongoose.connect(process.env.MONGO_URI, opts).then((mongoose) => {
            console.log("MongoDB Connected 🚀")
            return mongoose
        }).catch((err) => {
            cachedPromise = null
            console.error("Database Connection Failed ❌", err.message)
            throw err
        })
    }

    return cachedPromise
}

export default connectDB
