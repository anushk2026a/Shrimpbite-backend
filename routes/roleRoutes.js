import express from "express";
import {
    createRole,
    getRoles,
    updateRole,
    inviteAdmin,
    getAdmins,
    updateAdminRole,
} from "../controllers/roleController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(adminOnly);

router.route("/")
    .post(createRole)
    .get(getRoles);

router.route("/:id")
    .put(updateRole);

router.post("/invite", inviteAdmin);

router.route("/admins")
    .get(getAdmins);

router.route("/admins/:id/role")
    .put(updateAdminRole);

export default router;
