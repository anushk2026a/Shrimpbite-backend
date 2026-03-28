import express from "express"
import {
    registerUser,
    loginUser,
    onboardUser,
    getCurrentUser,
    updateRetailerProfile,
    resetAdminPassword
} from "../controllers/authController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router()

// Register
router.post("/register", registerUser)

// Login
router.post("/login", loginUser)

// Onboarding
router.put("/onboarding", onboardUser)

// Get Me (Current User)
router.get("/me/:id", getCurrentUser)

// Reset Admin Password
router.post("/reset-admin-password", protect, adminOnly, resetAdminPassword)

export default router
