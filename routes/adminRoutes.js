import express from "express"
import User from "../models/User.js"

const router = express.Router()

// Get all retailers (can filter by status)
router.get("/retailers", async (req, res) => {
    try {
        const { status } = req.query
        const query = { role: "retailer" }
        if (status) query.status = status

        const retailers = await User.find(query).sort({ createdAt: -1 })
        res.json(retailers)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
})

// Update retailer status (approve/reject/suspend)
router.put("/retailers/status", async (req, res) => {
    try {
        const { userId, status, rejectionReason } = req.body

        if (status === "rejected" && !rejectionReason) {
            return res.status(400).json({ message: "Rejection reason is mandatory for rejecting an application." })
        }

        const user = await User.findById(userId)
        if (!user) return res.status(404).json({ message: "Retailer not found" })

        user.status = status
        if (rejectionReason) user.rejectionReason = rejectionReason

        await user.save()
        res.json({ message: `Retailer ${status} successfully`, user })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
})

export default router
