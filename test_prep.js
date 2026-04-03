import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { getDailyPrepList } from './services/prepService.js';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb+srv://admin:L96qIARXW3xN2TXY@cluster0.k54b4.mongodb.net/shrimpbite?retryWrites=true&w=majority&appName=Cluster0");
        console.log("Connected to DB");
        
        // Find a valid retailer ID (Alex)
        const Retailer = mongoose.model('User');
        const retailer = await Retailer.findOne({ role: 'retailer' });
        
        if (!retailer) {
            console.log("No retailer found");
            process.exit(1);
        }
        
        // Get date for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        console.log(`Getting prep list for Retailer ${retailer._id} on ${tomorrow.toISOString()}`);
        const result = await getDailyPrepList(tomorrow.toISOString(), retailer._id);
        
        const pausedItems = result.detailed.filter(i => i.status.includes('Paused'));
        console.log("PAUSED ITEMS RAW:");
        console.log(JSON.stringify(pausedItems, null, 2));
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
