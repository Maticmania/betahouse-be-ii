import './src/config/env.js';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import http from "http";
import { Server } from "socket.io";
import { connectDB } from './src/config/db.config.js';
import passport from './src/config/passport.config.js';

// Routes
import authRoutes from './src/api/auth/auth.routes.js';
import notificationRoutes from './src/api/notifications/notification.routes.js';
import propertyRoutes from './src/api/properties/property.routes.js';
import agentRoutes from './src/api/agents/agent.routes.js';
import userRoutes from './src/api/users/user.routes.js';
import uploadRoutes from './src/routes/upload.routes.js';

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 6000;
const MONGO_URI = process.env.MONGO_URI;

// ✅ MongoDB connection
connectDB(MONGO_URI);

// ✅ Middleware
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5000",
  "https://yourfrontend.com",
];

app.use(express.json());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(helmet());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 1000,
}));
app.use(passport.initialize());

// ✅ Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Keep track of online users
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  socket.on("register", (userId) => {
    onlineUsers.set(userId, socket.id);
    console.log(`✅ User ${userId} registered with socket ${socket.id}`);
  });

  socket.on("disconnect", () => {
    for (const [userId, sId] of onlineUsers.entries()) {
      if (sId === socket.id) onlineUsers.delete(userId);
    }
    console.log("❌ User disconnected:", socket.id);
  });
});

// Make io accessible in routes/services
app.set("io", io);
app.set("onlineUsers", onlineUsers);

// ✅ Base route
app.get('/', (req, res) => {
  res.send('Betahouse Real Estate API running...');
});

// ✅ API Routes
app.use('/api/v2/auth', authRoutes);
app.use('/api/v2/properties', propertyRoutes);
app.use('/api/v2/notifications', notificationRoutes);
app.use('/api/v2/agent', agentRoutes);
app.use('/api/v2/users', userRoutes);
app.use('/api/v2/upload', uploadRoutes);

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
