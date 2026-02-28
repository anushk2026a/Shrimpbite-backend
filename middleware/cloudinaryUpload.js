import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "shrimpbite",
        allowed_formats: ["jpg", "png", "jpeg", "webp", "pdf"],
        resource_type: "auto", // Allows for PDF and raw file uploads
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

export default upload;