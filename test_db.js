import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("MONGO_URI not found in .env");
    process.exit(1);
}

async function testConnection() {
    try {
        console.log("Connecting to:", MONGO_URI.split('@')[1] || "Localhost");
        await mongoose.connect(MONGO_URI);
        console.log("Connected Successfully!");

        // Try a simple count
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log("Collections names:", collections.map(c => c.name));

        await mongoose.disconnect();
        console.log("Disconnected.");
    } catch (error) {
        console.error("Connection Failed:", error);
    }
}

testConnection();
