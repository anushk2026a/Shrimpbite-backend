import 'dotenv/config'
import app from "./app.js"
import connectDB from "./config/db.js"
import { initCronJobs } from "./cron.js";
import { initSocket } from "./services/socketService.js";
import paymentRoutes from "./routes/paymentRoutes.js";

// Connect DB
// await connectDB() // Disabled for Vercel - handled by middleware in app.js

// Register routes
app.use("/api/payment", paymentRoutes)

// Export app for Vercel
export default app;

/*
// Start Server
const PORT = process.env.PORT || 5000
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    initCronJobs();
})

// Init Socket.io
initSocket(server);
*/