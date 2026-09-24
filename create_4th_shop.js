import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
import Product from "./models/Product.js";
import dotenv from "dotenv";

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log("Connected to MongoDB.");

    const existingUser = await User.findOne({ email: "info@shrimpbite.in" });
    if (existingUser) {
        console.log("User with info@shrimpbite.in already exists. Deleting or skipping...");
        await User.deleteOne({ email: "info@shrimpbite.in" });
    }

    const hashedPassword = await bcrypt.hash("123456", 12);

    const newRetailer = new User({
        name: "Aqua AVP Bangalore",
        email: "info@shrimpbite.in",
        phone: "9148949909",
        password: hashedPassword,
        whatsappNumber: "9148949909",
        role: "retailer",
        isEmailVerified: true,
        isShopActive: true,
        businessDetails: {
            businessName: "AQUA AVP Shrimp Farmers Pride Pvt Ltd",
            storeDisplayName: "Aqua AVP - Yelahanka",
            ownerName: "AVP Management",
            storeImage: "https://res.cloudinary.com/dwemun2dn/image/upload/v1726915152/shrimpbite_logo_new_gztqfk.png",
            location: {
                address: "Survey No: 33/2, Shop No. 3 & 4, M Byregowda Complex, Mavalipura, Yelahanka Main Road, Shivakote (P)",
                city: "Bangalore",
                state: "Karnataka",
                pincode: "560089",
                landmark: "M Byregowda Complex",
                deliveryRadius: 20,
                latitude: 13.0841,
                longitude: 77.5621
            },
            legal: {
                gst: "29ABCCA1413F1Z5",
                fssai: ""
            }
        }
    });

    await newRetailer.save();
    console.log("Successfully created 4th shop!");
    console.log("Shop ID:", newRetailer._id);

    const existingProducts = await Product.find().limit(4);
    if (existingProducts.length > 0) {
        console.log(`Cloning ${existingProducts.length} products to the new shop...`);
        for (let p of existingProducts) {
            const newProduct = new Product({
                name: p.name,
                description: p.description,
                price: p.price,
                category: p.category,
                images: p.images,
                stock: 50,
                stockStatus: 'In Stock',
                retailer: newRetailer._id,
                status: 'Published',
                variants: p.variants,
                rating: 5,
                ratingsCount: 1
            });
            await newProduct.save();
        }
        console.log("Products successfully cloned!");
    }

    process.exit(0);
}).catch(console.error);
