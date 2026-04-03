import express from "express";
import protectAppUser from "../middleware/appAuthMiddleware.js";
import { subscribeToProduct, getMySubscriptions, updateSubscriptionStatus, updateAllSubscriptionStatus, updateVacation, cancelSubscription, updateAllVacationDate } from "../controllers/subscriptionController.js";

const router = express.Router();

router.use(protectAppUser);

router.post("/subscribe", subscribeToProduct);
router.get("/my", getMySubscriptions);
router.post("/cancel", cancelSubscription);
router.patch("/status", updateSubscriptionStatus);
router.patch("/status-all", updateAllSubscriptionStatus);
router.post("/vacation", updateVacation);
router.patch("/vacation-all-date", updateAllVacationDate);

export default router;
