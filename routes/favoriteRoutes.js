import express from "express";
import protectAppUser from "../middleware/appAuthMiddleware.js";
import { toggleFavorite, getFavorites } from "../controllers/favoriteController.js";

const router = express.Router();

router.post("/", protectAppUser, toggleFavorite);
router.get("/", protectAppUser, getFavorites);

export default router;
