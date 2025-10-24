const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

const router = express.Router();

// Middleware to verify JWT (copied from events.js for consistency)
const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined');
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
      return res.status(401).json({ message: 'Invalid user ID in token' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    console.error('JWT verification error:', err);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  const { displayName, bio, profileImage } = req.body;

  // Input validation
  if (displayName && (displayName.length < 1 || displayName.length > 50)) {
    return res.status(400).json({ message: 'Display name must be 1-50 characters' });
  }
  if (bio && bio.length > 200) {
    return res.status(400).json({ message: 'Bio cannot exceed 200 characters' });
  }
  if (profileImage && !profileImage.startsWith('data:image/')) {
    return res.status(400).json({ message: 'Invalid image format (must be base64 data URL)' });
  }

  try {
    const updateData = {};
    if (displayName) updateData.displayName = displayName.trim();
    if (bio !== undefined) updateData.bio = bio.trim();
    if (profileImage) updateData.profileImage = profileImage;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      displayName: user.displayName,
      bio: user.bio,
      profileImage: user.profileImage,
    });
  } catch (err) {
    console.error('Update profile error:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error updating profile' });
  }
});

// Update account
router.put('/account', authMiddleware, async (req, res) => {
  const { email, password } = req.body;

  // Input validation
  if (email && !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  if (password && password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    const updateData = {};
    if (email) updateData.email = email.trim().toLowerCase();
    if (password) updateData.password = password; // Will be hashed in pre-save hook

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      email: user.email,
    });
  } catch (err) {
    console.error('Update account error:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error updating account' });
  }
});

// Search users by username or email
router.get('/search', authMiddleware, async (req, res) => {
  const { query } = req.query;
  if (!query || query.trim().length < 3) {
    return res.status(400).json({ message: 'Search query must be at least 3 characters' });
  }
  try {
    const users = await User.find({
      $or: [
        { username: { $regex: query.trim(), $options: 'i' } },
        { email: { $regex: query.trim(), $options: 'i' } }
      ],
      _id: { $ne: req.user.id } // Exclude self
    }).select('_id username displayName profileImage').limit(10);
    res.json(users);
  } catch (err) {
    console.error('User search error:', err);
    res.status(500).json({ message: 'Server error searching users' });
  }
});

// Send friend request
router.post('/friend/request', authMiddleware, async (req, res) => {
  const { recipientId } = req.body;
  if (!mongoose.Types.ObjectId.isValid(recipientId)) {
    return res.status(400).json({ message: 'Invalid recipient ID' });
  }
  if (recipientId === req.user.id) {
    return res.status(400).json({ message: 'Cannot send request to yourself' });
  }
  try {
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'User not found' });
    }
    const sender = await User.findById(req.user.id);
    // Check if already friends
    if (sender.friends.includes(recipientId)) {
      return res.status(400).json({ message: 'Already friends' });
    }
    // Check for existing request
    if (recipient.friendRequests.some(r => r.senderId.toString() === req.user.id && r.status === 'pending')) {
      return res.status(400).json({ message: 'Request already sent' });
    }
    // Add request to recipient
    recipient.friendRequests.push({ senderId: req.user.id });
    await recipient.save();
    res.status(201).json({ message: 'Friend request sent' });
  } catch (err) {
    console.error('Send friend request error:', err);
    res.status(500).json({ message: 'Server error sending friend request' });
  }
});

// Accept friend request
router.put('/friend/accept/:requestId', authMiddleware, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
    return res.status(400).json({ message: 'Invalid request ID' });
  }
  try {
    const user = await User.findById(req.user.id);
    const requestIndex = user.friendRequests.findIndex(r => r._id.toString() === req.params.requestId && r.status === 'pending');
    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Pending request not found' });
    }
    const senderId = user.friendRequests[requestIndex].senderId;
    // Add to friends
    user.friends.push(senderId);
    const sender = await User.findById(senderId);
    sender.friends.push(req.user.id);
    // Remove request
    user.friendRequests.splice(requestIndex, 1);
    await user.save();
    await sender.save();
    res.json({ message: 'Friend request accepted' });
  } catch (err) {
    console.error('Accept friend request error:', err);
    res.status(500).json({ message: 'Server error accepting friend request' });
  }
});

// Reject friend request
router.put('/friend/reject/:requestId', authMiddleware, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
    return res.status(400).json({ message: 'Invalid request ID' });
  }
  try {
    const user = await User.findById(req.user.id);
    const requestIndex = user.friendRequests.findIndex(r => r._id.toString() === req.params.requestId && r.status === 'pending');
    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Pending request not found' });
    }
    // Remove request
    user.friendRequests.splice(requestIndex, 1);
    await user.save();
    res.json({ message: 'Friend request rejected' });
  } catch (err) {
    console.error('Reject friend request error:', err);
    res.status(500).json({ message: 'Server error rejecting friend request' });
  }
});

// Get friends and pending requests
router.get('/friends', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('friends', '_id username displayName profileImage')
      .populate('friendRequests.senderId', '_id username displayName profileImage');
    res.json({
      friends: user.friends,
      pendingRequests: user.friendRequests.filter(r => r.status === 'pending')
    });
  } catch (err) {
    console.error('Get friends error:', err);
    res.status(500).json({ message: 'Server error fetching friends' });
  }
});

// Remove friend
router.delete('/friend/:friendId', authMiddleware, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.friendId)) {
    return res.status(400).json({ message: 'Invalid friend ID' });
  }
  try {
    const user = await User.findById(req.user.id);
    const friendIndex = user.friends.findIndex(id => id.toString() === req.params.friendId);
    if (friendIndex === -1) {
      return res.status(404).json({ message: 'Friend not found' });
    }
    user.friends.splice(friendIndex, 1);
    await user.save();
    const friend = await User.findById(req.params.friendId);
    const userIndex = friend.friends.findIndex(id => id.toString() === req.user.id);
    if (userIndex !== -1) {
      friend.friends.splice(userIndex, 1);
      await friend.save();
    }
    res.json({ message: 'Friend removed' });
  } catch (err) {
    console.error('Remove friend error:', err);
    res.status(500).json({ message: 'Server error removing friend' });
  }
});

module.exports = router;