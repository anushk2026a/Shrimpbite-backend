import express from "express";
import { getNotifications, markAsRead, markAllAsRead, updateFcmToken } from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getNotifications);
router.patch("/read/:id", protect, markAsRead);
router.patch("/read-all", protect, markAllAsRead);
router.post("/update-token", protect, updateFcmToken);

export default router;
