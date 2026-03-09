import { Server } from "socket.io";

let io;

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*", // Adjust for production
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
        console.log("New client connected:", socket.id);

        socket.on("join", (room) => {
            socket.join(room);
            console.log(`Socket ${socket.id} joined room ${room}`);
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

// Simplified emitters for common events
export const emitOrderUpdate = async (orderId, status, data, retailerId = null) => {
    const rooms = [`order_${orderId}`];
    if (retailerId) rooms.push(`retailer_${retailerId}`);

    // 1. Try local emit
    if (io) {
        rooms.forEach(room => {
            io.to(room).emit("orderUpdate", { status, data, orderId });
        });
    }

    // 2. Try relay emit (for Vercel)
    const relayUrl = process.env.SOCKET_RELAY_URL;
    if (relayUrl) {
        try {
            for (const room of rooms) {
                await fetch(`${relayUrl}/emit`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        secret: process.env.SOCKET_SECRET || "shrimpbite_socket_relay_secret_2026",
                        event: "orderUpdate",
                        room: room,
                        data: { status, data, orderId }
                    })
                });
            }
        } catch (error) {
            console.error("Relay emit failed:", error.message);
        }
    }
};

export const emitChatUpdate = async (chatId, message) => {
    const room = `chat_${chatId}`;
    // 1. Try local emit
    if (io) {
        io.to(room).emit("newMessage", message);
    }

    // 2. Try relay emit (for Vercel)
    const relayUrl = process.env.SOCKET_RELAY_URL;
    if (relayUrl) {
        try {
            await fetch(`${relayUrl}/emit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    secret: process.env.SOCKET_SECRET || "shrimpbite_socket_relay_secret_2026",
                    event: "newMessage",
                    room: room,
                    data: message
                })
            });
        } catch (error) {
            console.error("Relay chat emit failed:", error.message);
        }
    }
};
