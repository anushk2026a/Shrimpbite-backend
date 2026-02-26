import express from "express"
import mongoose from "mongoose"
import cors from "cors"
import dotenv from "dotenv"
import authRoutes from "./routes/authRoutes.js"
import adminRoutes from "./routes/adminRoutes.js"

dotenv.config()

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// Routes

app.use("/api/auth", authRoutes)
app.use("/api/admin", adminRoutes)






// Basic test route
app.get("/", (req, res) => {
    res.send("Shrimpbite Backend Running 🦐")
})

// Connect DB
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected")
        app.listen(process.env.PORT, () => {
            console.log(`Server running on port ${process.env.PORT}`)
        })
    })
    .catch(err => console.log(err))