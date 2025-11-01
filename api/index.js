const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const authRoutes = require('../src/routes/auth');
const settingsRoutes = require('../src/routes/settings');
const sessionsRoutes = require('../src/routes/sessions');
const reflectionsRoutes = require('../src/routes/reflections');
const usersRoutes = require('../src/routes/users');

const { apiLimiter } = require('../src/middleware/rateLimit');
const errorHandler = require('../src/middleware/errorHandler');

const app = express();

app.use(helmet());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'https://reflectivepomodoro.com'
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/', apiLimiter);

// Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/reflections', reflectionsRoutes);
app.use('/api/users', usersRoutes);

app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorHandler);

// MongoDB connection for serverless
let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) throw new Error('MongoDB connection string is missing');

  await mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  isConnected = true;
  console.log('Connected to MongoDB');
}

connectDB().catch(err => console.error(err));

// Export app for Vercel serverless
module.exports = app;
