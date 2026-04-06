import express from "express"
import cors from "cors"
import "./config/firebase.js"
import path from "path"
import authRoutes from "./routes/authRoutes.js"
import adminRoutes from "./routes/adminRoutes.js"
import uploadRoutes from "./routes/uploadRoutes.js"
import appAuthRoutes from "./routes/appAuthRoutes.js";
import retailerRoutes from "./routes/retailerRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import riderRoutes from "./routes/riderRoutes.js";
import payoutRoutes from "./routes/payoutRoutes.js";
import communicationRoutes from "./routes/communicationRoutes.js";
import otpRoutes from "./routes/otpRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import cronRoutes from "./routes/cronRoutes.js";
import favoriteRoutes from "./routes/favoriteRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";

const app = express()

// Middleware
const allowedOrigins = [
    "http://localhost:3000",
    "https://retailer.shrimpbite.in",
    "http://127.0.0.1:3000",
    "https://shrimpbite-admin.vercel.app",
    "https://shrimpbite-retailer.vercel.app",
    "http://16.16.9.58:5000"
];

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "x-cron-secret",
        "x-requested-with",
        "Accept",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers"
    ],
    optionsSuccessStatus: 200
}));

app.use(express.json())
// DB is connected once at startup in server.js

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")))

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/upload", uploadRoutes)
app.use("/api/retailer", retailerRoutes)
app.use("/api/otp", otpRoutes);
//app routes

app.use("/api/app", appAuthRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/rider", riderRoutes);
app.use("/api/payout", payoutRoutes);
app.use("/api/communication", communicationRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/app/orders", orderRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/cron", cronRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/app/favorites", favoriteRoutes);
app.use("/api/app/search", searchRoutes);
app.use("/api/roles", roleRoutes);

// Basic test route
app.get("/", (req, res) => {
    res.send("Shrimpbite Backend Running 🦐")
})

export default app
