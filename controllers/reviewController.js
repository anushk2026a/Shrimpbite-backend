import Review from "../models/Review.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import RiderReview from "../models/RiderReview.js";
import OrderReview from "../models/OrderReview.js";

// @desc    Submit a consolidated review for an order (Order, Rider, and optionally Products)
// @route   POST /api/reviews/submit-order-review
// @access  Private (AppUser)
export const submitOrderReview = async (req, res) => {
    try {
        const { orderId, orderRating, orderComment, riderRating, productReviews } = req.body;
        const userId = req.user._id;

        // 1. Verify and fetch the order
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        // 2. Submit General Order Review (Experince)
        let savedOrderReview;
        if (orderRating) {
            savedOrderReview = await OrderReview.findOneAndUpdate(
                { order: orderId, user: userId },
                { rating: orderRating, comment: orderComment },
                { upsert: true, new: true }
            );
        }

        // 3. Submit Rider Review (Stars only)
        let savedRiderReview;
        if (riderRating && order.rider) {
            savedRiderReview = await RiderReview.findOneAndUpdate(
                { order: orderId, rider: order.rider },
                { rating: riderRating, user: userId },
                { upsert: true, new: true }
            );
        }

        // 4. Submit Product Reviews (Optional)
        const savedProductReviews = [];
        if (productReviews && Array.isArray(productReviews)) {
            for (const pr of productReviews) {
                const product = await Product.findById(pr.productId);
                if (product) {
                    const review = await Review.findOneAndUpdate(
                        { user: userId, product: pr.productId, order: orderId },
                        {
                            rating: pr.rating,
                            comment: pr.comment || "",
                            retailer: product.retailer,
                            order: orderId
                        },
                        { upsert: true, new: true }
                    );
                    savedProductReviews.push(review);
                }
            }
        }

        res.status(200).json({
            success: true,
            message: "Reviews submitted successfully",
            data: {
                orderReview: savedOrderReview,
                riderReview: savedRiderReview,
                productReviews: savedProductReviews
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get average rating and review list for a Rider
// @route   GET /api/reviews/rider/:riderId
// @access  Private (Rider/Admin)
export const getRiderRating = async (req, res) => {
    try {
        const { riderId } = req.params;

        const reviews = await RiderReview.find({ rider: riderId })
            .populate("user", "fullName profilePicture")
            .sort("-createdAt");

        const totalReviews = reviews.length;
        let averageRating = 0;

        if (totalReviews > 0) {
            const sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
            averageRating = (sum / totalReviews).toFixed(1);
        }

        res.status(200).json({
            success: true,
            data: {
                averageRating: Number(averageRating),
                totalReviews,
                reviews
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get average rating and reviews for a Product
// @route   GET /api/reviews/product/:productId
// @access  Public
export const getProductReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ product: req.params.productId })
            .populate("user", "fullName profilePicture")
            .sort("-createdAt");

        res.status(200).json({
            success: true,
            count: reviews.length,
            data: reviews
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Submit a single product review (legacy/individual)
// @route   POST /api/reviews/product
export const createReview = async (req, res) => {
    try {
        const { product: productId, rating, comment, order: orderId } = req.body;
        const userId = req.user._id;

        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });

        const review = await Review.findOneAndUpdate(
            { user: userId, product: productId },
            {
                rating,
                comment,
                retailer: product.retailer,
                order: orderId
            },
            { upsert: true, new: true }
        );

        res.status(201).json({ success: true, data: review });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

