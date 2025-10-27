// routes/friends.js
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const User    = require('../models/User');

// ---------- SEARCH ----------
router.get('/search', auth, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  try {
    const users = await User.find({
      $or: [{ username: new RegExp(q, 'i') }, { displayName: new RegExp(q, 'i') }],
      _id: { $ne: req.user.id }
    }).select('username displayName').limit(10);
    res.json(users.map(u=>({ id:u._id, username:u.username, displayName:u.displayName })));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ---------- SEND REQUEST ----------
router.post('/request', auth, async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ message: 'to required' });
  try {
    await User.findByIdAndUpdate(req.user.id, { $push: { friendRequests: { senderId: to } } });
    await User.findByIdAndUpdate(to, { $push: { friendRequests: { senderId: req.user.id } } });
    res.json({ message: 'Request sent' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ---------- PENDING ----------
router.get('/requests', auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id)
               .populate('friendRequests.senderId', 'username displayName');
    const pending = me.friendRequests.filter(r=>r.status==='pending');
    res.json(pending.map(r=>({ _id:r._id, from:r.senderId })));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ---------- ACCEPT / REJECT ----------
router.put('/requests/:reqId', auth, async (req, res) => {
  const { accept } = req.body;   // true / false
  try {
    const me = await User.findById(req.user.id);
    const req = me.friendRequests.id(req.params.reqId);
    if (!req) return res.status(404).json({ message: 'Not found' });
    req.status = accept ? 'accepted' : 'rejected';
    await me.save();

    // mirror on the sender side
    const sender = await User.findById(req.senderId);
    const mirror = sender.friendRequests.find(r=>r.senderId.toString()===req.user.id);
    if (mirror) { mirror.status = accept ? 'accepted' : 'rejected'; await sender.save(); }

    if (accept) {
      await User.findByIdAndUpdate(req.user.id, { $push: { friends: req.senderId } });
      await User.findByIdAndUpdate(req.senderId, { $push: { friends: req.user.id } });
    }
    res.json({ message: 'Done' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ---------- LIST ----------
router.get('/', auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).populate('friends', 'username displayName');
    res.json(me.friends);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ---------- REMOVE ----------
router.delete('/:friendId', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $pull: { friends: req.params.friendId } });
    await User.findByIdAndUpdate(req.params.friendId, { $pull: { friends: req.user.id } });
    res.json({ message: 'Removed' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;