// server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const authRoutes = require('../routes/auth');
const eventRoutes = require('../routes/events');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors({
  origin: ['http://localhost:3000', 'https://calendar-test-1.onrender.com'],
  credentials: true,
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend API is running' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));