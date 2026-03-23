import express from "express";
import protectAppUser from "../middleware/appAuthMiddleware.js";
import { updateFcmToken, getNotifications, markAsRead, markAllAsRead } from "../controllers/notificationController.js";

const router = express.Router();

import {
    registerUser,
    loginUser,
    googleAuth,
    getProfile,
    updateProfile,
    updateName,
    changePassword,
    forgotPassword,
    addAddress,
    getAddresses,
    deleteAddress
} from "../controllers/appAuthController.js";
import { getPublicCategories } from "../controllers/adminController.js";
import { getPublicSubscriptionPlans } from "../controllers/subscriptionController.js";
import { getPublicShops, getShopDetails, getShopProducts } from "../controllers/shopController.js";
import { addToCart, getCart, clearCart, updateCartItem, removeFromCart } from "../controllers/cartController.js";
import { getPublicProducts } from "../controllers/productController.js";

// Products (Public with filtering)
router.get("/products", getPublicProducts);

// Categories (Public for App)
router.get("/categories", getPublicCategories);

// Shops (Public for App)
router.get("/shops", getPublicShops);
router.get("/shops/:id", getShopDetails);
router.get("/shops/:shopId/products", getShopProducts);

// Subscription Plans (Public for App - Protected)
router.get("/subscriptions", protectAppUser, getPublicSubscriptionPlans);

//register
router.post("/register", registerUser);

//login
router.post("/login", loginUser);

//google auth
router.post("/google", googleAuth);

//get profile
router.get("/profile", protectAppUser, getProfile);

//update profile
router.put("/profile", protectAppUser, updateProfile);

//update name
router.put("/update-name", protectAppUser, updateName);

//change password
router.put("/change-password", protectAppUser, changePassword);

//forgot password
router.post("/forgot-password", forgotPassword);

//add address
router.post("/addaddress", protectAppUser, addAddress);
router.post("/address", protectAppUser, addAddress); // Alias for Flutter App

//get addresses
router.get("/address", protectAppUser, getAddresses);

//delete address
router.delete("/address/:id", protectAppUser, deleteAddress);

// --- Cart ---
router.get("/cart", protectAppUser, getCart);
router.post("/cart/item", protectAppUser, addToCart);
router.post("/cart/add", protectAppUser, addToCart);       // Alias
router.put("/cart/update", protectAppUser, updateCartItem); // New
router.delete("/cart/remove/:productId", protectAppUser, removeFromCart); // New
router.delete("/cart/clear", protectAppUser, clearCart);   // Alias
router.delete("/cart", protectAppUser, clearCart);

// --- Notifications / FCM ---
router.get("/notifications", protectAppUser, getNotifications);
router.patch("/notifications/read/:id", protectAppUser, markAsRead);
router.patch("/notifications/read-all", protectAppUser, markAllAsRead);
router.post("/update-fcm-token", protectAppUser, updateFcmToken);

export default router;