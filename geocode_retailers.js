import mongoose from 'mongoose';
import axios from 'axios';
import User from './models/User.js';

const MONGO_URI = "mongodb+srv://anushk2026a_db_user:ZldrfxIRRXr5YGTz@cluster0.xuspmih.mongodb.net/shrimpbite_prod?retryWrites=true&w=majority";

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected to MongoDB");

        const retailers = await User.find({ role: "retailer" });
        console.log(`Found ${retailers.length} total retailers`);
        
        let updatedCount = 0;

        for (let r of retailers) {
            const loc = r.businessDetails?.location;
            
            // Only process if latitude/longitude is missing
            if (loc && (!loc.latitude || !loc.longitude)) {
                // Construct a search query. Address is usually best, fallback to city/state.
                let queryParts = [];
                if (loc.address) queryParts.push(loc.address);
                if (loc.city) queryParts.push(loc.city);
                if (loc.state) queryParts.push(loc.state);
                
                const query = queryParts.join(", ").trim();
                
                if (!query) {
                    console.log(`⚠️ Skipping ${r.businessDetails.businessName || r.name} - No address data`);
                    continue;
                }
                
                console.log(`🔍 Geocoding: ${query} (for ${r.businessDetails.businessName || r.name})`);
                try {
                    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
                    const res = await axios.get(url, { headers: { 'User-Agent': 'Shrimpbite-Admin-Geocode-Script' } });
                    
                    if (res.data && res.data.length > 0) {
                        const lat = parseFloat(res.data[0].lat);
                        const lon = parseFloat(res.data[0].lon);
                        
                        // Update in DB
                        r.businessDetails.location.latitude = lat;
                        r.businessDetails.location.longitude = lon;
                        await r.save();
                        updatedCount++;
                        console.log(`   ✅ Success! Set to lat: ${lat}, lng: ${lon}`);
                    } else {
                        // Fallback: If full address fails, try just City + State
                        const fallbackQuery = `${loc.city || ''}, ${loc.state || ''}`.trim();
                        if (fallbackQuery && fallbackQuery !== query) {
                            console.log(`   ⚠️ Retrying with fallback: ${fallbackQuery}`);
                            await new Promise(resolve => setTimeout(resolve, 1500)); // Rate limit
                            
                            const fallbackUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fallbackQuery)}&format=json&limit=1`;
                            const fallbackRes = await axios.get(fallbackUrl, { headers: { 'User-Agent': 'Shrimpbite-Admin-Geocode-Script' } });
                            
                            if (fallbackRes.data && fallbackRes.data.length > 0) {
                                const lat = parseFloat(fallbackRes.data[0].lat);
                                const lon = parseFloat(fallbackRes.data[0].lon);
                                
                                r.businessDetails.location.latitude = lat;
                                r.businessDetails.location.longitude = lon;
                                await r.save();
                                updatedCount++;
                                console.log(`   ✅ Fallback Success! Set to lat: ${lat}, lng: ${lon}`);
                            } else {
                                console.log(`   ❌ No results found for fallback either.`);
                            }
                        } else {
                            console.log(`   ❌ No results found.`);
                        }
                    }
                } catch (e) {
                    console.error(`   ❌ Error geocoding`, e.message);
                }
                
                // Sleep to respect Nominatim API rate limits (absolute max 1 req/sec)
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
        console.log(`\n🎉 Finished! Successfully geocoded and updated ${updatedCount} retailers.`);
        process.exit(0);
    } catch (error) {
        console.error("Fatal Error:", error);
        process.exit(1);
    }
}

run();
