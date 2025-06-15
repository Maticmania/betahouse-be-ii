import './src/config/env.js';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { WebSocketServer } from 'ws';
import {createServer} from "http"
import { connectDB } from './src/config/db.config.js';
import passport from './src/config/passport.config.js';
import authRoutes from './src/routes/auth.routes.js';
import notificationRoutes from './src/routes/notification.js';
import propertyRoutes from './src/routes/property.js';
import agentRoutes from './src/routes/agent.js';
import userRoutes from './src/routes/user.js';




const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 100 requests per window
  })
);
app.use(passport.initialize());
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// Store connected clients
// const clients = new Map();

// wss.on("connection", (ws, req) => {
//   const params = new URLSearchParams(req.url.split("?")[1]);
//   const token = params.get("token");

//   // Validate token (you can use your own logic here)
//   let userId;
//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET); // optional
//     userId = decoded.id;
//     clients.set(userId, ws);
//     console.log(`User ${userId} connected via WebSocket`);
//   } catch (err) {
//     console.error("Invalid token", err);
//     ws.close();
//     return;
//   }

//   ws.on("message", (message) => {
//     try {
//       const data = JSON.parse(message);
//       console.log("Received:", data);

//       // Echo the message or handle routing logic here
//       if (data.type === "message") {
//         // Example: broadcast to all
//         for (const [uid, client] of clients) {
//           if (client.readyState === 1) {
//             client.send(JSON.stringify({ type: "message", payload: data.payload }));
//           }
//         }
//       }
//     } catch (err) {
//       console.error("Error handling message:", err);
//     }
//   });

//   ws.on("close", () => {
//     console.log(`User ${userId} disconnected`);
//     clients.delete(userId);
//   });
// });
 

const PORT = process.env.PORT || 6000;
const MONGO_URI = process.env.MONGO_URI;

// mongoDB connection
connectDB(MONGO_URI);

// Sample route
app.get('/', (req, res) => {
  res.send('Real Estate API running...');
});

// Routes
app.use('/api/v2/auth', authRoutes);
app.use('/api/v2/properties', propertyRoutes);
app.use('/api/v2/notifications', notificationRoutes);
app.use('/api/v2/agent', agentRoutes);
app.use('/api/v2/users', userRoutes);

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
