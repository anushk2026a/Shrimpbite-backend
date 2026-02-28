export const uploadFile = (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" })
        }
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`
        const fileUrl = `${baseUrl}/uploads/${req.file.filename}`
        res.status(200).json({ url: fileUrl, filename: req.file.originalname })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}
