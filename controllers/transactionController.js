import Transaction from "../models/Transaction.js";
import AppUser from "../models/AppUser.js";

// GET /api/admin/transactions
export const getAllTransactions = async (req, res) => {
    try {
        const { page = 1, limit = 50, type, status, search } = req.query;

        const filter = {};
        if (type) filter.type = type;
        if (status) filter.status = status;

        // If search by user name/phone, first find matching users
        if (search) {
            const matchingUsers = await AppUser.find({
                $or: [
                    { fullName: { $regex: search, $options: "i" } },
                    { phoneNumber: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } }
                ]
            }).select("_id").lean();
            const userIds = matchingUsers.map(u => u._id);
            filter.$or = [
                { user: { $in: userIds } },
                { referenceId: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [transactions, total] = await Promise.all([
            Transaction.find(filter)
                .populate("user", "fullName email phoneNumber")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Transaction.countDocuments(filter)
        ]);

        // Compute summary stats
        const allTxns = await Transaction.find().lean();
        const totalVolume = allTxns.reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalCredits = allTxns.filter(t => t.type === "Credit").reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalDebits = allTxns.filter(t => t.type === "Debit").reduce((sum, t) => sum + (t.amount || 0), 0);
        const pendingCount = allTxns.filter(t => t.status === "Pending").length;

        res.status(200).json({
            success: true,
            data: {
                transactions: transactions.map(t => ({
                    _id: t._id,
                    user: t.user?.fullName || "Unknown",
                    email: t.user?.email || "",
                    phone: t.user?.phoneNumber || "",
                    amount: t.amount,
                    type: t.type,
                    status: t.status,
                    description: t.description,
                    referenceId: t.referenceId || "-",
                    source: t.source,
                    date: t.createdAt
                })),
                pagination: {
                    total,
                    page: parseInt(page),
                    pages: Math.ceil(total / parseInt(limit))
                },
                stats: {
                    totalVolume,
                    totalCredits,
                    totalDebits,
                    pendingCount
                }
            }
        });
    } catch (error) {
        console.error("Get All Transactions Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
