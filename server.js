import 'dotenv/config'
import app from "./app.js"
import connectDB from "./config/db.js"
import { initCronJobs } from "./cron.js";
import { initSocket } from "./services/socketService.js";
import paymentRoutes from "./routes/paymentRoutes.js";

const PORT = process.env.PORT || 5000

// Connect DB once at startup, then start server
const startServer = async () => {
    try {
        await connectDB();
    } catch (err) {
        console.error("Failed to connect to DB. Exiting.", err.message);
        process.exit(1);
    }

    // Register routes
    app.use("/api/payment", paymentRoutes)

    const server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`)
        initCronJobs();
    })

    // Init Socket.io
    initSocket(server);
}

startServer();