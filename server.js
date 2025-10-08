// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ----- Middleware -------------------------------------------------
app.use(cors({
  origin: process.env.CLIENT_URL || '*',   // adjust in Render env if you host the UI elsewhere
  credentials: true
}));
app.use(express.json());

// Serve static frontend (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'frontend')));

// ----- Routes ----------------------------------------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));

// ----- Health check ------------------------------------------------
app.get('/health', (req, res) => res.json({ status: 'OK' }));

// ----- Catch-all – send index.html for SPA routing ----------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ----- MongoDB connection -----------------------------------------
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI is missing – aborting');
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, {
    // Mongoose 8+ no longer needs useNewUrlParser / useUnifiedTopology
  })
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// ----- Start server ------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));