import Favorite from "../models/Favorite.js";

export const toggleFavorite = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.userId;

        if (!productId) {
            return res.status(400).json({ success: false, message: "Product ID is required" });
        }

        const existingFavorite = await Favorite.findOne({ user: userId, product: productId });

        if (existingFavorite) {
            await Favorite.deleteOne({ _id: existingFavorite._id });
            return res.status(200).json({
                success: true,
                message: "Removed from favorites",
                isFavorited: false
            });
        } else {
            await Favorite.create({ user: userId, product: productId });
            return res.status(201).json({
                success: true,
                message: "Added to favorites",
                isFavorited: true
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getFavorites = async (req, res) => {
    try {
        const userId = req.userId;

        const favorites = await Favorite.find({ user: userId })
            .populate({
                path: "product",
                populate: {
                    path: "retailer",
                    select: "businessDetails"
                }
            })
            .sort({ createdAt: -1 });

        // Extract products from favorites
        const products = favorites.map(f => f.product).filter(p => p !== null);

        res.status(200).json({
            success: true,
            data: products
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
