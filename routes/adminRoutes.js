import express from "express"
import {
    getRetailers,
    updateRetailerStatus,
    getAppUsers,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getDashboardStats,
    getAllOrders
} from "../controllers/adminController.js";
import {
    getSubscriptionPlans,
    createSubscriptionPlan,
    updateSubscriptionPlan,
    deleteSubscriptionPlan
} from "../controllers/subscriptionController.js";
import { protect, adminOnly, checkModuleAccess } from "../middleware/authMiddleware.js";

const router = express.Router()

// Use protect and adminOnly for ALL routes in this file
router.use(protect);
router.use(adminOnly);

// Dashboard
router.get("/dashboard-stats", checkModuleAccess("Dashboard"), getDashboardStats)

// Retailer Management
router.get("/retailers", checkModuleAccess("Retailers"), getRetailers)
router.put("/retailers/status", checkModuleAccess("Retailers"), updateRetailerStatus)

// User Management (Customers)
router.get("/users", checkModuleAccess("App Users"), getAppUsers)

// Category Management (General System Control)
router.get("/categories", checkModuleAccess("Dashboard"), getCategories)
router.post("/categories", checkModuleAccess("Dashboard"), createCategory)
router.put("/categories/:id", checkModuleAccess("Dashboard"), updateCategory)
router.delete("/categories/:id", checkModuleAccess("Dashboard"), deleteCategory)

// Subscription/Plan Management (General System Control)
router.get("/subscriptions", checkModuleAccess("Dashboard"), getSubscriptionPlans)
router.post("/subscriptions", checkModuleAccess("Dashboard"), createSubscriptionPlan)
router.put("/subscriptions/:id", checkModuleAccess("Dashboard"), updateSubscriptionPlan)
router.delete("/subscriptions/:id", checkModuleAccess("Dashboard"), deleteSubscriptionPlan)

// Order Management
router.get("/orders", checkModuleAccess("Order Management"), getAllOrders)

export default router
