import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import { connectDB } from './src/config/db.config.js';
import { redisConnect } from './src/config/redis.config.js';
import authRoutes from './src/routes/auth.routes.js';

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));
app.use(helmet());
// app.use(express.urlencoded({ extended: true }));


const PORT = process.env.PORT || 6000;
const MONGO_URI = process.env.MONGO_URI;
const REDIS_URL = process.env.REDIS_URL;

// mongoDB connection
connectDB(MONGO_URI);
// redis connection
redisConnect(REDIS_URL);

// Sample route
app.get('/', (req, res) => {
  res.send('Real Estate API running...');
});

// Routes
app.use('/api/v2/auth', authRoutes);

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
