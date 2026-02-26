import express from "express"
import multer from "multer"
import path from "path"
import fs from "fs"

const router = express.Router()

// Ensure uploads directory exists
const uploadDir = "uploads"
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir)
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir)
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + path.extname(file.originalname))
    }
})

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowTypes = /jpeg|jpg|png|pdf/
        const extname = allowTypes.test(path.extname(file.originalname).toLowerCase())
        const mimetype = allowTypes.test(file.mimetype)

        if (extname && mimetype) {
            return cb(null, true)
        } else {
            cb(new Error("Only images (jpg, jpeg, png) and PDFs are allowed"))
        }
    }
})

router.post("/", upload.single("file"), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" })
        }
        const fileUrl = `http://localhost:5000/uploads/${req.file.filename}`
        res.status(200).json({ url: fileUrl, filename: req.file.originalname })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
})

export default router
