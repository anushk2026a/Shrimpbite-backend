import Role from "../models/Role.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendAdminInviteEmail } from "../utils/email.js";

// @desc    Create a new role
// @route   POST /api/roles
// @access  Private/Admin
export const createRole = async (req, res) => {
    try {
        const { name, modules } = req.body;
        
        const roleExists = await Role.findOne({ name });
        if (roleExists) {
            return res.status(400).json({ success: false, message: "Role already exists" });
        }

        const role = await Role.create({
            name,
            modules: modules || [],
        });

        res.status(201).json({ success: true, role });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all roles
// @route   GET /api/roles
// @access  Private/Admin
export const getRoles = async (req, res) => {
    try {
        const roles = await Role.find({});
        // Let's also attach active capacity (count of users with this role)
        const rolesWithCounts = await Promise.all(
            roles.map(async (role) => {
                const count = await User.countDocuments({ adminRole: role._id });
                return { ...role.toObject(), activeCapacity: count };
            })
        );
        res.status(200).json({ success: true, roles: rolesWithCounts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update role permissions
// @route   PUT /api/roles/:id
// @access  Private/Admin
export const updateRole = async (req, res) => {
    try {
        const { modules, isActive } = req.body;
        
        const role = await Role.findById(req.params.id);
        if (!role) {
            return res.status(404).json({ success: false, message: "Role not found" });
        }

        if (modules !== undefined) role.modules = modules;
        if (isActive !== undefined) role.isActive = isActive;

        await role.save();

        res.status(200).json({ success: true, role });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Invite a new admin user
// @route   POST /api/roles/invite
// @access  Private/Admin
export const inviteAdmin = async (req, res) => {
    try {
        const { name, email, phone, roleId } = req.body;

        if (!name || !email || !roleId || !phone) {
            return res.status(400).json({ success: false, message: "Name, email, phone, and role are required." });
        }

        const userExists = await User.findOne({ $or: [{ email }, { phone }] });
        if (userExists) {
            return res.status(400).json({ success: false, message: "User with this email or phone already exists." });
        }

        const role = await Role.findById(roleId);
        if (!role) {
            return res.status(404).json({ success: false, message: "Role not found." });
        }

        // Generate temporary password (8 chars)
        const tempPassword = crypto.randomBytes(4).toString("hex");

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);

        const newUser = await User.create({
            name,
            email,
            phone,
            password: hashedPassword,
            role: "admin",
            adminRole: roleId,
            status: "approved",
            isPasswordResetRequired: true,
        });

        // Send Email
        const emailSent = await sendAdminInviteEmail(email, name, tempPassword, role.name);

        res.status(201).json({ 
            success: true, 
            message: "User invited successfully",
            emailSent
        });
    } catch (error) {
        console.error("Invite Admin Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all admins
// @route   GET /api/roles/admins
// @access  Private/Admin
export const getAdmins = async (req, res) => {
    try {
        const admins = await User.find({ role: "admin" })
            .select("-password")
            .populate("adminRole", "name modules");
            
        res.status(200).json({ success: true, admins });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update an admin's assigned role
// @route   PUT /api/roles/admins/:id/role
// @access  Private/Admin
export const updateAdminRole = async (req, res) => {
    try {
        const { roleId } = req.body;

        const adminUser = await User.findOne({ _id: req.params.id, role: "admin" });
        if (!adminUser) {
            return res.status(404).json({ success: false, message: "Admin user not found" });
        }

        if (roleId) {
            const roleExists = await Role.findById(roleId);
            if (!roleExists) {
                return res.status(404).json({ success: false, message: "Role not found" });
            }
            adminUser.adminRole = roleId;
        } else {
             // If roleId is empty, meaning making them a Super Admin (or removing role logic)
            // Need to be careful here, maybe we shouldn't allow making superadmins arbitrarily
            adminUser.adminRole = null;
        }

        await adminUser.save();

        res.status(200).json({ success: true, message: "Admin role updated", adminUser });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
