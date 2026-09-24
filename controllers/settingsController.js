import SystemSetting from "../models/SystemSetting.js";

// GET /api/admin/settings
export const getSettings = async (req, res) => {
    try {
        const settings = await SystemSetting.find();
        const settingsObj = {};
        settings.forEach(s => {
            settingsObj[s.key] = s.value;
        });
        res.status(200).json({ success: true, data: settingsObj });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/admin/settings
export const updateSettings = async (req, res) => {
    try {
        const updates = req.body; // e.g. { NOTIFICATION_EMAILS: ['admin1@test.com'], NEW_CUSTOMER_ALERTS: true }
        
        const updatePromises = Object.keys(updates).map(key => 
            SystemSetting.findOneAndUpdate(
                { key },
                { value: updates[key] },
                { upsert: true, new: true }
            )
        );

        await Promise.all(updatePromises);
        res.status(200).json({ success: true, message: "Settings updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
