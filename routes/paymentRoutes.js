import express from "express";
import { createOrder, handleWebhook } from "../controllers/paymentController.js";

const router = express.Router();

router.post("/create-order", createOrder);
router.post("/webhook", handleWebhook);

export default router;