export const uploadFile = (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" })
        }

        // When using multer-storage-cloudinary, the URL is provided in req.file.path
        res.status(200).json({
            url: req.file.path,
            filename: req.file.originalname
        })
    } catch (error) {
        console.error("Cloudinary upload error:", error)
        res.status(500).json({ message: error.message })
    }
}
