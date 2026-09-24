import mongoose from 'mongoose';
import axios from 'axios';
import AppUser from './models/AppUser.js';

const MONGO_URI = "mongodb+srv://anushk2026a_db_user:ZldrfxIRRXr5YGTz@cluster0.xuspmih.mongodb.net/shrimpbite_prod?retryWrites=true&w=majority";

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected to MongoDB");

        const users = await AppUser.find({});
        console.log(`Found ${users.length} total AppUsers`);
        
        let updatedCount = 0;

        for (let u of users) {
            if (!u.addresses || u.addresses.length === 0) continue;

            // Iterate over all addresses for the user
            for (let i = 0; i < u.addresses.length; i++) {
                const addr = u.addresses[i];

                // Only process if missing lat/lng
                if (!addr.latitude || !addr.longitude) {
                    let queryParts = [];
                    if (addr.fullAddress) queryParts.push(addr.fullAddress);
                    if (addr.city) queryParts.push(addr.city);
                    if (addr.state) queryParts.push(addr.state);
                    
                    const query = queryParts.join(", ").trim();
                    if (!query) continue;

                    console.log(`🔍 Geocoding Customer: ${u.fullName} -> ${query}`);
                    
                    try {
                        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
                        const res = await axios.get(url, { headers: { 'User-Agent': 'Shrimpbite-Admin-Geocode-Customers' } });
                        
                        if (res.data && res.data.length > 0) {
                            addr.latitude = parseFloat(res.data[0].lat);
                            addr.longitude = parseFloat(res.data[0].lon);
                            updatedCount++;
                            console.log(`   ✅ Success! Set to lat: ${addr.latitude}, lng: ${addr.longitude}`);
                        } else {
                            // Fallback to City + State
                            const fallbackQuery = `${addr.city || ''}, ${addr.state || ''}`.trim();
                            if (fallbackQuery && fallbackQuery !== query) {
                                console.log(`   ⚠️ Retrying with fallback: ${fallbackQuery}`);
                                await new Promise(resolve => setTimeout(resolve, 1500)); 
                                
                                const fallbackUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fallbackQuery)}&format=json&limit=1`;
                                const fallbackRes = await axios.get(fallbackUrl, { headers: { 'User-Agent': 'Shrimpbite-Admin-Geocode-Customers' } });
                                
                                if (fallbackRes.data && fallbackRes.data.length > 0) {
                                    addr.latitude = parseFloat(fallbackRes.data[0].lat);
                                    addr.longitude = parseFloat(fallbackRes.data[0].lon);
                                    updatedCount++;
                                    console.log(`   ✅ Fallback Success! Set to lat: ${addr.latitude}, lng: ${addr.longitude}`);
                                } else {
                                    console.log(`   ❌ No results found for fallback.`);
                                }
                            }
                        }
                    } catch (e) {
                        console.error(`   ❌ Error geocoding:`, e.message);
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
            // Save the user if any addresses were updated
            await u.save();
        }
        
        console.log(`\n🎉 Finished! Successfully geocoded and updated ${updatedCount} customer addresses.`);
        process.exit(0);
    } catch (error) {
        console.error("Fatal Error:", error);
        process.exit(1);
    }
}

run();
