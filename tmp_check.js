import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

import User from './models/User.js';
import Subscription from './models/Subscription.js';
import Order from './models/Order.js';
import Product from './models/Product.js';

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const retailer = await User.findOne({ email: "alice@gmail.com" });
        
        let out = {};
        
        if (!retailer) {
            out.error = "Retailer not found!";
            fs.writeFileSync('data.json', JSON.stringify(out, null, 2));
            process.exit(1);
        }
        
        const subscriptions = await Subscription.find({ retailer: retailer._id })
            .populate('product', 'name price')
            .lean();
        
        out.subscriptions = subscriptions.map(sub => ({
            id: sub._id,
            product: sub.product?.name,
            freq: sub.frequency,
            status: sub.status,
            customDays: sub.customDays,
            vacationDates: sub.vacationDates
        }));

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const orders = await Order.find({ "items.retailer": retailer._id, createdAt: { $gte: today, $lt: tomorrow } })
            .populate('items.product', 'name')
            .lean();

        out.orders = orders.map(o => ({
            id: o.orderId,
            status: o.status,
            type: o.orderType,
            items: o.items.map(i => ({ name: i.product?.name, status: i.status }))
        }));

        fs.writeFileSync('data.json', JSON.stringify(out, null, 2));
    } catch (e) {
        fs.writeFileSync('data.json', JSON.stringify({ error: e.message, stack: e.stack }, null, 2));
    } finally {
        process.exit(0);
    }
}

checkData();
