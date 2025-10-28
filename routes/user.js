// routes/user.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

router.put('/profile', protect, async (req, res) => {
  const { displayName, bio, profileImage } = req.body;

  if (displayName && (displayName.length < 1 || displayName.length > 50))
    return res.status(400).json({ message: 'Display name must be 1-50 characters' });
  if (bio && bio.length > 200)
    return res.status(400).json({ message: 'Bio too long' });
  if (profileImage && !profileImage.startsWith('data:image/'))
    return res.status(400).json({ message: 'Invalid image' });

  const update = {};
  if (displayName) update.displayName = displayName.trim();
  if (bio !== undefined) update.bio = bio.trim();
  if (profileImage) update.profileImage = profileImage;

  try {
    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true })
      .select('displayName bio profileImage');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/account', protect, async (req, res) => {
  const { email, password } = req.body;
  if (email && !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email))
    return res.status(400).json({ message: 'Invalid email' });
  if (password && password.length < 6)
    return res.status(400).json({ message: 'Password too short' });

  const update = {};
  if (email) update.email = email.trim().toLowerCase();
  if (password) {
    const salt = await bcrypt.genSalt(10);
    update.password = await bcrypt.hash(password, salt);
  }

  try {
    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true })
      .select('email');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;