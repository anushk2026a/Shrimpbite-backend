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
export const emitOrderUpdate = (orderId, status, data) => {
    if (io) {
        io.to(orderId).emit("orderUpdate", { status, data });
    } else {
        console.log(`Socket not initialized. Skipping emit for order ${orderId}`);
    }
};

export const emitChatUpdate = (chatId, message) => {
    if (io) {
        io.to(chatId).emit("newMessage", message);
    } else {
        console.log(`Socket not initialized. Skipping emit for chat ${chatId}`);
    }
};
