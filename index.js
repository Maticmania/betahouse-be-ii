import './src/config/env.js';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDB } from './src/config/db.config.js';
import authRoutes from './src/routes/auth.routes.js';
import passport from './src/config/passport.config.js';


const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
  })
);
app.use(passport.initialize());


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

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
