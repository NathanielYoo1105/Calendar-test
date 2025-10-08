const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const authRoutes = require('./routes/auth'); // Fix path (relative to server.js)
const eventRoutes = require('./routes/events'); // Fix path
const path = require('path');

dotenv.config();

const app = express();

// CORS configuration: Allow dynamic origins or use environment variable
const allowedOrigins = [
  'http://localhost:3000',
  process.env.RENDER_EXTERNAL_URL || 'https://calendar-test-1.onrender.com'
].filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend'))); // Serve frontend folder

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  // Removed deprecated options
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend API is running' });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));