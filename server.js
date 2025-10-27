// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');               // <-- ADDED

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ---------- Rate limiting ----------
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// ---------- CORS ----------
const allowedOrigins = [
  'http://localhost:5000',
  'https://calendar-test.onrender.com',
];
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

// ---------- Middleware ----------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// ---------- MongoDB ----------
if (!process.env.MONGO_URI) {
  console.error('MONGO_URI environment variable is required');
  process.exit(1);
}
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// ---------- JWT Auth Middleware ----------
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;               // <-- attach user to request
    next();
  });
}

// ---------- USER MODEL (inline – you can move to models/User.js) ----------
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, sparse: true },
  passwordHash: { type: String, required: true },
  displayName: String,
  bio: String,
  profileImage: String,

  // Friend system
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  friendRequests: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
  }]
});
const User = mongoose.model('User', userSchema);

// ---------- FRIEND ROUTER ----------
const friendRouter = express.Router();
friendRouter.use(authenticateToken);   // protect all friend endpoints

/* 1. SEARCH USERS */
friendRouter.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q?.trim()) return res.json([]);

    const regex = new RegExp(q.trim(), 'i');
    const users = await User.find({
      $or: [{ username: regex }, { email: regex }],
      _id: { $ne: req.user.id }
    })
      .select('username displayName')
      .limit(10)
      .lean();

    const results = users.map(u => ({
      id: u._id.toString(),
      username: u.username,
      displayName: u.displayName || null
    }));
    res.json(results);
  } catch (err) {
    console.error('Friend search error:', err);
    res.status(500).json({ message: 'Search failed' });
  }
});

/* 2. SEND FRIEND REQUEST */
friendRouter.post('/request', async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ message: 'Target user required' });
    if (to === req.user.id) return res.status(400).json({ message: 'Cannot request yourself' });

    const target = await User.findById(to);
    if (!target) return res.status(404).json({ message: 'User not found' });

    const alreadyFriends = target.friends.includes(req.user.id);
    const alreadyRequested = target.friendRequests.some(r => r.from.toString() === req.user.id && r.status === 'pending');

    if (alreadyFriends || alreadyRequested) {
      return res.status(400).json({ message: 'Already friends or request pending' });
    }

    target.friendRequests.push({ from: req.user.id });
    await target.save();
    res.json({ message: 'Friend request sent' });
  } catch (err) {
    console.error('Friend request error:', err);
    res.status(500).json({ message: 'Failed to send request' });
  }
});

/* 3. GET PENDING REQUESTS */
friendRouter.get('/requests', async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('friendRequests.from', 'username displayName')
      .select('friendRequests');

    const pending = user.friendRequests
      .filter(r => r.status === 'pending')
      .map(r => ({
        _id: r._id,
        from: {
          id: r.from._id.toString(),
          username: r.from.username,
          displayName: r.from.displayName || null
        }
      }));
    res.json(pending);
  } catch (err) {
    console.error('Get requests error:', err);
    res.status(500).json({ message: 'Failed to load requests' });
  }
});

/* 4. ACCEPT / REJECT REQUEST */
friendRouter.put('/requests/:reqId', async (req, res) => {
  try {
    const { reqId } = req.params;
    const { accept } = req.body;               // true = accept, false = reject

    const user = await User.findById(req.user.id);
    const request = user.friendRequests.id(reqId);
    if (!request || request.status !== 'pending') {
      return res.status(404).json({ message: 'Request not found or already handled' });
    }

    if (accept) {
      request.status = 'accepted';
      user.friends.push(request.from);
      const sender = await User.findById(request.from);
      sender.friends.push(req.user.id);
      await sender.save();
    } else {
      request.status = 'rejected';
    }
    await user.save();
    res.json({ message: accept ? 'Friend added' : 'Request rejected' });
  } catch (err) {
    console.error('Handle request error:', err);
    res.status(500).json({ message: 'Failed to process request' });
  }
});

/* 5. GET FRIENDS LIST */
friendRouter.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('friends', 'username displayName')
      .select('friends');

    const friends = user.friends.map(f => ({
      id: f._id.toString(),
      username: f.username,
      displayName: f.displayName || null
    }));
    res.json(friends);
  } catch (err) {
    console.error('Get friends error:', err);
    res.status(500).json({ message: 'Failed to load friends' });
  }
});

/* 6. REMOVE FRIEND */
friendRouter.delete('/:friendId', async (req, res) => {
  try {
    const { friendId } = req.params;

    await User.updateOne(
      { _id: req.user.id },
      { $pull: { friends: friendId } }
    );
    await User.updateOne(
      { _id: friendId },
      { $pull: { friends: req.user.id } }
    );
    res.json({ message: 'Friend removed' });
  } catch (err) {
    console.error('Remove friend error:', err);
    res.status(500).json({ message: 'Failed to remove friend' });
  }
});

// ---------- MOUNT FRIEND ROUTER ----------
app.use('/api/friends', friendRouter);   // <-- NEW

// ---------- Existing Routes ----------
try {
  const authRoutes = require('./routes/auth');
  const eventRoutes = require('./routes/events');
  const userRoutes = require('./routes/user');
  app.use('/api/auth', authRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/user', userRoutes);
} catch (err) {
  console.error('Error loading routes:', err);
  process.exit(1);
}

// ---------- Health Check ----------
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend API is running' });
});

// ---------- SPA Fallback ----------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ---------- Global Error Handler ----------
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// ---------- Start Server ----------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});