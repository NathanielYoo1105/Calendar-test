// routes/calendars.js
const express   = require('express');
const router    = express.Router();
const auth      = require('../middleware/auth');
const Calendar  = require('../models/Calendar');
const User      = require('../models/User');
const Event     = require('../models/Event');

// ---------- CREATE ----------
router.post('/', auth, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: 'Name required' });
  try {
    const cal = new Calendar({ name, description, owner: req.user.id });
    await cal.save();
    await User.findByIdAndUpdate(req.user.id, { $push: { calendars: cal._id } });
    res.status(201).json(cal);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ---------- LIST (owned + shared) ----------
router.get('/', auth, async (req, res) => {
  try {
    const owned  = await Calendar.find({ owner: req.user.id }).select('-events');
    const shared = await Calendar.find({ 'sharedWith.user': req.user.id })
                                 .select('name description owner sharedWith');
    res.json({ owned, shared });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ---------- SHARE ----------
router.post('/:id/share', auth, async (req, res) => {
  const { userId, permission = 'view' } = req.body;
  try {
    const cal = await Calendar.findById(req.params.id);
    if (!cal) return res.status(404).json({ message: 'Calendar not found' });
    if (cal.owner.toString() !== req.user.id) return res.status(403).json({ message: 'Not owner' });

    // optional: only allow sharing with accepted friends
    const me = await User.findById(req.user.id).select('friends');
    const isFriend = me.friends.some(f => f.toString() === userId);
    if (!isFriend) return res.status(400).json({ message: 'Only friends can be shared with' });

    const already = cal.sharedWith.find(s => s.user.toString() === userId);
    if (already) { already.permission = permission; }
    else { cal.sharedWith.push({ user: userId, permission }); }
    await cal.save();
    res.json({ message: 'Shared' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;