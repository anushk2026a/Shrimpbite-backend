import mongoose from 'mongoose';

const uri = "mongodb+srv://anushk2026a_db_user:ZldrfxIRRXr5YGTz@cluster0.xuspmih.mongodb.net/shrimpbite?retryWrites=true&w=majority";

async function check() {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const users = await db.collection("users").find({ name: "Klee" }).toArray();
    console.log("Users named Klee:");
    console.dir(users);

    const appUsers = await db.collection("appusers").find({ phoneNumber: { $regex: "8052838161" } }).toArray();
    console.log("AppUsers with 8052838161:");
    console.dir(appUsers);

    mongoose.disconnect();
}

check();
