import express from "express"
import {
    registerUser,
    loginUser,
    onboardUser,
    getCurrentUser
} from "../controllers/authController.js";

const router = express.Router()

// Register
router.post("/register", registerUser)

// Login
router.post("/login", loginUser)

// Onboarding
router.put("/onboarding", onboardUser)

// Get Me (Current User)
router.get("/me/:id", getCurrentUser)

export default router
