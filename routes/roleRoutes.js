import express from "express";
import {
    createRole,
    getRoles,
    updateRole,
    inviteAdmin,
    getAdmins,
    updateAdminRole,
} from "../controllers/roleController.js";
import { protect, adminOnly, checkModuleAccess } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(adminOnly);

router.route("/")
    .post(checkModuleAccess("Control Authority"), createRole)
    .get(checkModuleAccess("Control Authority"), getRoles);

router.route("/:id")
    .put(checkModuleAccess("Control Authority"), updateRole);

router.post("/invite", checkModuleAccess("Admin role"), inviteAdmin);

router.route("/admins")
    .get(checkModuleAccess("Admin role"), getAdmins);

router.route("/admins/:id/role")
    .put(checkModuleAccess("Admin role"), updateAdminRole);

export default router;
