import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

export const addToCart = async (req, res) => {
    try {
        const { productId, quantity, variantId, weightLabel } = req.body;
        const userId = req.userId;

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Resolve price: use variant price if variantId provided, else flat price
        let resolvedPrice = product.price;
        let resolvedVariantId = null;
        let resolvedWeightLabel = null;
        let resolvedWeightInKg = null; // Used for accurate stock check

        if (product.variants && product.variants.length > 0) {
            // This product HAS variants — variantId is REQUIRED
            if (!variantId) {
                return res.status(400).json({
                    message: `Please select a weight option for "${product.name}" before adding to cart.`
                });
            }
            const variant = product.variants.find(v => v._id.toString() === variantId.toString());
            if (!variant) {
                return res.status(400).json({ message: "Selected variant not found on this product" });
            }
            resolvedPrice = variant.price;
            resolvedVariantId = variant._id;
            resolvedWeightLabel = weightLabel || variant.label;
            resolvedWeightInKg = variant.weightInKg; // e.g. 0.5 for 500g
        } else if (variantId) {
            // variantId sent but product has no variants — ignore gracefully
            resolvedPrice = product.price;
        }

        let cart = await Cart.findOne({ user: userId });

        if (!cart) {
            cart = new Cart({
                user: userId,
                retailer: product.retailer,
                items: []
            });
        }

        // Prevent multi-shop cart
        if (cart.retailer && cart.retailer.toString() !== product.retailer.toString()) {
            return res.status(400).json({
                message: "Cart already contains items from another shop"
            });
        }

        // Match by product AND variant (same product, different weight = different cart item)
        const existingItem = cart.items.find(item =>
            item.product.toString() === productId &&
            (item.variantId?.toString() || null) === (resolvedVariantId?.toString() || null)
        );

        if (existingItem) {
            const newQuantity = existingItem.quantity + quantity;
            // Stock check: compare actual KG weight, not raw packet count
            const totalWeightKg = resolvedWeightInKg ? resolvedWeightInKg * newQuantity : newQuantity;
            if (totalWeightKg > product.stock) {
                return res.status(400).json({
                    message: `Only ${product.stock}kg available in stock for "${product.name}"`
                });
            }
            existingItem.quantity = newQuantity;
            existingItem.price = resolvedPrice;
        } else {
            // Stock check: compare actual KG weight, not raw packet count
            const totalWeightKg = resolvedWeightInKg ? resolvedWeightInKg * quantity : quantity;
            if (totalWeightKg > product.stock) {
                return res.status(400).json({
                    message: `Only ${product.stock}kg available in stock for "${product.name}"`
                });
            }
            cart.items.push({
                product: productId,
                quantity,
                price: resolvedPrice,
                variantId: resolvedVariantId,
                weightLabel: resolvedWeightLabel
            });
        }

        // Remove if quantity = 0
        cart.items = cart.items.filter(item => item.quantity > 0);
        // If cart becomes empty, reset retailer
        if (cart.items.length === 0) {
            cart.retailer = null;
        }
        await cart.save();

        res.json({
            success: true,
            cart
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateCartItem = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.userId;

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        const item = cart.items.find(
            item => item.product.toString() === productId
        );

        if (!item) {
            return res.status(404).json({ message: "Item not found in cart" });
        }

        const product = await Product.findById(productId);
        if (quantity > product.stock) {
            return res.status(400).json({
                message: `Only ${product.stock}kg available in stock`
            });
        }

        item.quantity = quantity;

        // Remove if quantity = 0
        if (quantity <= 0) {
            cart.items = cart.items.filter(i => i.product.toString() !== productId);
        }

        // Reset retailer if cart empty
        if (cart.items.length === 0) {
            cart.retailer = null;
        }

        await cart.save();
        res.json({ success: true, cart });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const removeFromCart = async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.userId;

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        cart.items = cart.items.filter(
            item => item.product.toString() !== productId
        );

        // Reset retailer if cart empty
        if (cart.items.length === 0) {
            cart.retailer = null;
        }

        await cart.save();
        res.json({ success: true, cart });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getCart = async (req, res) => {
    try {

        const cart = await Cart.findOne({ user: req.userId })
            .populate("items.product");

        res.json({
            success: true,
            cart
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
export const clearCart = async (req, res) => {
    try {

        await Cart.findOneAndDelete({ user: req.userId });

        res.json({
            success: true,
            message: "Cart cleared"
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};