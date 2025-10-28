const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');

// Search users
router.get('/search', protect, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  try {
    const users = await User.find({
      $or: [{ username: new RegExp(q, 'i') }, { displayName: new RegExp(q, 'i') }],
      _id: { $ne: req.user._id }
    }).select('username displayName profileImage').limit(10);
    res.json(users.map(u => ({ 
      id: u._id, 
      username: u.username, 
      displayName: u.displayName,
      profileImage: u.profileImage 
    })));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Send friend request
router.post('/request', protect, async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ message: 'to required' });
  
  try {
    const sender = await User.findById(req.user._id);
    const recipient = await User.findById(to);
    
    if (!recipient) return res.status(404).json({ message: 'User not found' });
    if (sender._id.toString() === to) return res.status(400).json({ message: 'Cannot add yourself' });
    
    // Check if already friends
    const senderFriends = sender.friends || [];
    if (senderFriends.some(f => f.toString() === to)) {
      return res.status(400).json({ message: 'Already friends' });
    }

    // Initialize friendRequests arrays if they don't exist
    if (!sender.friendRequests) sender.friendRequests = [];
    if (!recipient.friendRequests) recipient.friendRequests = [];

    // Check if request already exists
    const alreadyReceived = recipient.friendRequests.some(r => 
      r.from && r.from.toString() === req.user._id.toString() && r.status === 'pending'
    );
    const alreadySent = sender.friendRequests.some(r => 
      r.to && r.to.toString() === to && r.status === 'pending'
    );

    if (alreadyReceived || alreadySent) {
      return res.status(400).json({ message: 'Request already exists' });
    }

    // Add to recipient's incoming requests
    recipient.friendRequests.push({ 
      from: req.user._id, 
      to: null,
      status: 'pending',
      createdAt: new Date()
    });
    await recipient.save();

    // Add to sender's outgoing requests  
    sender.friendRequests.push({ 
      from: null,
      to: to, 
      status: 'pending',
      createdAt: new Date()
    });
    await sender.save();

    res.json({ message: 'Request sent' });
  } catch (e) {
    console.error('Friend request error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Get incoming friend requests
router.get('/requests/incoming', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friendRequests.from', 'username displayName profileImage bio');
    
    if (!user.friendRequests) {
      return res.json([]);
    }
    
    const incoming = user.friendRequests
      .filter(r => r.from && r.status === 'pending')
      .map(r => ({
        _id: r._id,
        from: {
          id: r.from._id,
          username: r.from.username,
          displayName: r.from.displayName,
          profileImage: r.from.profileImage,
          bio: r.from.bio
        },
        createdAt: r.createdAt
      }));
    
    res.json(incoming);
  } catch (e) {
    console.error('Get incoming requests error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Get outgoing friend requests
router.get('/requests/outgoing', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friendRequests.to', 'username displayName profileImage bio');
    
    if (!user.friendRequests) {
      return res.json([]);
    }
    
    const outgoing = user.friendRequests
      .filter(r => r.to && r.status === 'pending')
      .map(r => ({
        _id: r._id,
        to: {
          id: r.to._id,
          username: r.to.username,
          displayName: r.to.displayName,
          profileImage: r.to.profileImage,
          bio: r.to.bio
        },
        createdAt: r.createdAt
      }));
    
    res.json(outgoing);
  } catch (e) {
    console.error('Get outgoing requests error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Accept/reject friend request
router.put('/requests/:reqId', protect, async (req, res) => {
  const { accept } = req.body;
  try {
    const user = await User.findById(req.user._id);
    
    if (!user.friendRequests) {
      return res.status(404).json({ message: 'No requests found' });
    }
    
    const reqIndex = user.friendRequests.findIndex(
      r => r._id.toString() === req.params.reqId && r.from && r.status === 'pending'
    );
    
    if (reqIndex === -1) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const senderId = user.friendRequests[reqIndex].from;
    
    // Update recipient's request
    user.friendRequests[reqIndex].status = accept ? 'accepted' : 'rejected';
    await user.save();

    // Update sender's outgoing request
    const sender = await User.findById(senderId);
    if (sender && sender.friendRequests) {
      const senderReqIndex = sender.friendRequests.findIndex(
        r => r.to && r.to.toString() === req.user._id.toString() && r.status === 'pending'
      );
      if (senderReqIndex !== -1) {
        sender.friendRequests[senderReqIndex].status = accept ? 'accepted' : 'rejected';
        await sender.save();
      }
    }

    // Add to friends list if accepted
    if (accept) {
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { friends: senderId } });
      await User.findByIdAndUpdate(senderId, { $addToSet: { friends: req.user._id } });
    }

    res.json({ message: accept ? 'Accepted' : 'Rejected' });
  } catch (e) {
    console.error('Handle request error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Cancel outgoing friend request
router.delete('/requests/outgoing/:reqId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user.friendRequests) {
      return res.status(404).json({ message: 'No requests found' });
    }
    
    const reqIndex = user.friendRequests.findIndex(
      r => r._id.toString() === req.params.reqId && r.to && r.status === 'pending'
    );
    
    if (reqIndex === -1) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const recipientId = user.friendRequests[reqIndex].to;
    
    // Remove from sender's outgoing
    user.friendRequests.splice(reqIndex, 1);
    await user.save();

    // Remove from recipient's incoming
    const recipient = await User.findById(recipientId);
    if (recipient && recipient.friendRequests) {
      const recipientReqIndex = recipient.friendRequests.findIndex(
        r => r.from && r.from.toString() === req.user._id.toString() && r.status === 'pending'
      );
      if (recipientReqIndex !== -1) {
        recipient.friendRequests.splice(recipientReqIndex, 1);
        await recipient.save();
      }
    }

    res.json({ message: 'Request cancelled' });
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
    res.status(500).json({ message: e.message });
  }
});

// Remove friend
router.delete('/:friendId', protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $pull: { friends: req.params.friendId } });
    await User.findByIdAndUpdate(req.params.friendId, { $pull: { friends: req.user._id } });
    res.json({ message: 'Friend removed' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;