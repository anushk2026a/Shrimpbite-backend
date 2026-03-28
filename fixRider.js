import mongoose from 'mongoose';

const uri = "mongodb+srv://anushk2026a_db_user:ZldrfxIRRXr5YGTz@cluster0.xuspmih.mongodb.net/shrimpbite?retryWrites=true&w=majority";

async function fix() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    // 1. Update the Rider's phone number to include +91
    const userUpdateResult = await db.collection("users").updateOne(
        { phone: "8052838161", role: "rider" },
        { $set: { phone: "+918052838161" } }
    );
    console.log("Updated Rider phone:", userUpdateResult);

    // 2. Delete the automatically created customer account
    const appUserDeleteResult = await db.collection("appusers").deleteOne({ phoneNumber: "+918052838161" });
    console.log("Deleted rogue AppUser:", appUserDeleteResult);

    mongoose.disconnect();
}

fix();
