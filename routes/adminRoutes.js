import express from "express"
import {
    getRetailers,
    updateRetailerStatus
} from "../controllers/adminController.js";

const router = express.Router()

// Get all retailers (can filter by status)
router.get("/retailers", getRetailers)

// Update retailer status (approve/reject/suspend)
router.put("/retailers/status", updateRetailerStatus)



export default router
