import mongoose from "mongoose";
import User from "./models/User.js";
import Product from "./models/Product.js";
import dotenv from "dotenv";

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    // 1. Update Pune shops
    const puneShops = await User.find({ role: "retailer", "businessDetails.location.city": "Pune" });
    for (const shop of puneShops) {
        shop.businessDetails.location.latitude = 18.5204 + (Math.random() * 0.05);
        shop.businessDetails.location.longitude = 73.8567 + (Math.random() * 0.05);
        await shop.save();
    }
    console.log(`Updated ${puneShops.length} Pune shops with coordinates.`);

    // 2. Check if BLR shop exists
    let blrShop = await User.findOne({ role: "retailer", "businessDetails.location.city": "Bengaluru" });
    if (!blrShop) {
        const sourceShop = puneShops[0];
        blrShop = new User({
            name: "Shrimpbite Yelahanka (Bengaluru)",
            email: "blr_shop@shrimpbite.in",
            role: "retailer",
            status: "approved",
            isShopActive: true,
            phone: "9998887776",
            businessDetails: {
                businessName: "Aqua BLR Shrimp Farmers",
                storeDisplayName: "Shrimpbite Yelahanka",
                ownerName: "Admin",
                location: {
                    city: "Bengaluru",
                    state: "Karnataka",
                    address: "Vaishnavi Serene Area",
                    latitude: 13.1115,
                    longitude: 77.5890
                }
            }
        });
        await blrShop.save();

        // Copy a few products from the source shop
        const sourceProducts = await Product.find({ retailer: sourceShop._id, status: "Published" }).limit(5);
        for (const sp of sourceProducts) {
            const np = new Product(sp.toObject());
            np._id = new mongoose.Types.ObjectId();
            np.retailer = blrShop._id;
            np.createdAt = new Date();
            np.updatedAt = new Date();
            np.isNew = true;
            await np.save();
        }
        console.log("Created Bengaluru test shop and cloned products.");
    } else {
        blrShop.businessDetails.location.latitude = 13.1115;
        blrShop.businessDetails.location.longitude = 77.5890;
        await blrShop.save();
        console.log("Updated existing Bengaluru test shop coordinates.");
    }
    
    process.exit(0);
}).catch(console.error);
