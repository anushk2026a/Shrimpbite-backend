import express from "express"
import cors from "cors"
import path from "path"
import authRoutes from "./routes/authRoutes.js"
import adminRoutes from "./routes/adminRoutes.js"
import uploadRoutes from "./routes/uploadRoutes.js"

const app = express()

// Connect Database
import connectDB from "./config/db.js"
connectDB()

// Middleware
app.use(cors())
app.use(express.json())
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")))

// Basic test route
app.get("/", (req, res) => {
    res.send("Shrimpbite Backend Running 🦐")
})

// Database Connection Guard Middleware
app.use(async (req, res, next) => {
    try {
        await connectDB()
        next()
    } catch (err) {
        res.status(500).json({ message: "Database connection failed", error: err.message })
    }
})

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/upload", uploadRoutes)

export default app
