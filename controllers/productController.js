import Product from "../models/Product.js";
import { createNotification } from "../services/notificationService.js";

// Get all products for the logged-in retailer
export const getRetailerProducts = async (req, res) => {
    try {
        const products = await Product.find({ retailer: req.user._id })
            .populate("category", "name")
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get a single product by ID
export const getProductById = async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, retailer: req.user._id })
            .populate("category", "name");
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        res.status(200).json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Create a new product
export const createProduct = async (req, res) => {
    try {
        const productData = {
            ...req.body,
            retailer: req.user._id
        };

        // If category is an empty string, remove it to avoid Mongoose casting errors
        if (productData.category === "") {
            delete productData.category;
        }

        const product = await Product.create(productData);
        res.status(201).json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update a product
export const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };

        if (updateData.category === "") {
            delete updateData.category;
        }

        // Use findById + save() — most reliable for nested subdocument arrays
        const product = await Product.findOne({ _id: id, retailer: req.user._id });
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });

        // Explicitly assign each field so Mongoose tracks changes correctly
        Object.keys(updateData).forEach(key => {
            product[key] = updateData[key];
        });

        await product.save();

        res.status(200).json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete a product
export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findOneAndDelete({ _id: id, retailer: req.user._id });
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });
        res.status(200).json({ success: true, message: "Product deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get public products with advanced filtering for the app
export const getPublicProducts = async (req, res) => {
    try {
        const {
            minPrice,
            maxPrice,
            minRating,
            hasDiscount,
            freeShipping,
            sameDayDelivery,
            category,
            sortBy,
            search,
            lat,
            lng,
            pincode,
            city
        } = req.query;

        // Base query for active retailers
        const retailerQuery = { role: "retailer", status: "approved", isShopActive: true };
        const User = (await import("../models/User.js")).default;
        
        let activeRetailers = [];
        let locationFilterApplied = false;

        if (lat && lng) {
            locationFilterApplied = true;
            // Fetch all active retailers to filter by distance
            const allActiveRetailers = await User.find(retailerQuery).select("_id businessDetails");
            
            const userLat = parseFloat(lat);
            const userLng = parseFloat(lng);

            // Haversine formula to calculate distance in km
            const getDistance = (lat1, lon1, lat2, lon2) => {
                const R = 6371; // km
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                          Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return R * c;
            };

            activeRetailers = allActiveRetailers.filter(retailer => {
                const rLat = retailer.businessDetails?.location?.latitude;
                const rLng = retailer.businessDetails?.location?.longitude;
                const rRadius = retailer.businessDetails?.location?.deliveryRadius || 10;
                
                if (rLat && rLng) {
                    const distance = getDistance(userLat, userLng, rLat, rLng);
                    return distance <= rRadius;
                }
                return false; // Skip retailers without coordinates
            });
        } else {
            // Fallback to pincode or city matching if no coordinates provided
            if (pincode) {
                locationFilterApplied = true;
                retailerQuery["businessDetails.location.pincode"] = pincode;
            } else if (city) {
                locationFilterApplied = true;
                retailerQuery["businessDetails.location.city"] = { $regex: city, $options: "i" };
            }
            activeRetailers = await User.find(retailerQuery).select("_id businessDetails");
        }
        
        // If location filter was explicitly passed and no active retailer covers the user
        if (locationFilterApplied && activeRetailers.length === 0) {
            return res.status(200).json({
                success: true,
                coverageAvailable: false,
                total: 0,
                data: []
            });
        }

        const activeRetailerIds = activeRetailers.map(r => r._id);

        // Build the database query
        let query = { status: "Published" };

        if (activeRetailerIds.length > 0) {
            query.retailer = { $in: activeRetailerIds };
        }

        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }

        if (minRating) {
            query.rating = { $gte: Number(minRating) };
        }

        if (hasDiscount === 'true') {
            query.hasDiscount = true;
        }

        if (freeShipping === 'true') {
            query.isFreeShipping = true;
        }

        if (sameDayDelivery === 'true') {
            query.isSameDayDelivery = true;
        }

        if (category) {
            query.category = category;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } }
            ];
        }

        // Determine sort order
        let sortOption = { createdAt: -1 }; // default newest
        if (sortBy === 'price_low_high') {
            sortOption = { price: 1 };
        } else if (sortBy === 'price_high_low') {
            sortOption = { price: -1 };
        } else if (sortBy === 'rating') {
            sortOption = { rating: -1 };
        }

        // Execute queries
        const total = await Product.countDocuments(query);
        const products = await Product.find(query)
            .populate("category", "name")
            .populate("retailer", "businessDetails.storeDisplayName businessDetails.businessName name")
            .sort(sortOption);

        res.status(200).json({
            success: true,
            coverageAvailable: true,
            total,
            data: products
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
