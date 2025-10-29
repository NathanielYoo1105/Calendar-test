const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest'); // ADD THIS

// Search users
router.get('/search', protect, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ message: 'Query required' });
  
  try {
    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { displayName: { $regex: q, $options: 'i' } }
      ],
      _id: { $ne: req.user._id }
    })
    .select('username displayName profileImage bio')
    .limit(20);
    
    res.json(users.map(u => ({
      id: u._id,
      username: u.username,
      displayName: u.displayName,
      profileImage: u.profileImage,
      bio: u.bio
    })));
  } catch (e) {
    console.error('Search error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Send friend request
router.post('/request', protect, async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ message: 'Recipient ID required' });
  
  if (to === req.user._id.toString()) {
    return res.status(400).json({ message: 'Cannot send request to yourself' });
  }
  
  try {
    const recipient = await User.findById(to);
    if (!recipient) return res.status(404).json({ message: 'User not found' });
    
    // Check if already friends
    const currentUser = await User.findById(req.user._id);
    if (currentUser.friends.includes(to)) {
      return res.status(400).json({ message: 'Already friends' });
    }
    
    // Check if request already exists
    const existing = await FriendRequest.findOne({
      $or: [
        { from: req.user._id, to, status: 'pending' },
        { from: to, to: req.user._id, status: 'pending' }
      ]
    });
    
    if (existing) {
      return res.status(400).json({ message: 'Friend request already exists' });
    }
    
    // Create new request
    const request = await FriendRequest.create({
      from: req.user._id,
      to
    });
    
    res.json({ message: 'Friend request sent', request });
  } catch (e) {
    console.error('Send request error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Get incoming friend requests
router.get('/requests/incoming', protect, async (req, res) => {
  try {
    const requests = await FriendRequest.find({ 
      to: req.user._id, 
      status: 'pending' 
    })
    .populate('from', 'username displayName profileImage bio')
    .sort({ createdAt: -1 });
    
    res.json(requests);
  } catch (e) {
    console.error('Get incoming requests error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Get outgoing friend requests
router.get('/requests/outgoing', protect, async (req, res) => {
  try {
    const requests = await FriendRequest.find({ 
      from: req.user._id, 
      status: 'pending' 
    })
    .populate('to', 'username displayName profileImage bio')
    .sort({ createdAt: -1 });
    
    res.json(requests);
  } catch (e) {
    console.error('Get outgoing requests error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Accept or reject friend request
router.put('/requests/:requestId', protect, async (req, res) => {
  const { accept } = req.body;
  
  try {
    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    
    if (request.to.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }
    
    if (accept) {
      // Add to friends lists
      await User.findByIdAndUpdate(request.from, { 
        $addToSet: { friends: request.to } 
      });
      await User.findByIdAndUpdate(request.to, { 
        $addToSet: { friends: request.from } 
      });
      
      request.status = 'accepted';
    } else {
      request.status = 'rejected';
    }
    
    await request.save();
    res.json({ message: accept ? 'Friend request accepted' : 'Friend request rejected' });
  } catch (e) {
    console.error('Handle request error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Cancel outgoing friend request
router.delete('/requests/outgoing/:requestId', protect, async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    
    if (request.from.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    await FriendRequest.findByIdAndDelete(req.params.requestId);
    res.json({ message: 'Friend request cancelled' });
  } catch (e) {
    console.error('Cancel request error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Get friends list
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friends', 'username displayName profileImage bio');
    
    res.json(user.friends.map(f => ({
      id: f._id,
      username: f.username,
      displayName: f.displayName,
      profileImage: f.profileImage,
      bio: f.bio
    })));
  } catch (e) {
    console.error('Get friends error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Remove friend
router.delete('/:friendId', protect, async (req, res) => {
  try {
    // Remove from both users' friends lists
    await User.findByIdAndUpdate(req.user._id, { 
      $pull: { friends: req.params.friendId } 
    });
    await User.findByIdAndUpdate(req.params.friendId, { 
      $pull: { friends: req.user._id } 
    });
    
    res.json({ message: 'Friend removed' });
  } catch (e) {
    console.error('Remove friend error:', e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;