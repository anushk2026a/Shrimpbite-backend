import express from "express";
import { globalSearch } from "../controllers/searchController.js";

const router = express.Router();

// Search route for App Users
router.get("/", globalSearch);

export default router;
