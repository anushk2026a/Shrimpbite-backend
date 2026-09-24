import mongoose from "mongoose";

const SystemSettingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true }, 
    value: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

const SystemSetting = mongoose.models.SystemSetting || mongoose.model("SystemSetting", SystemSettingSchema);
export default SystemSetting;
