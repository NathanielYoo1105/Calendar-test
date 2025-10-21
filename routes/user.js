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

module.exports = router;