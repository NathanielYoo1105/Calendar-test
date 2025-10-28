// controllers/calendarController.js
const Calendar = require('../models/Calendar');
const User = require('../models/User');

const getCalendars = async (req, res) => {
  try {
    const owned = await Calendar.find({ owner: req.user._id })
      .populate('sharedWith.user', 'username displayName profileImage')
      .select('-events');
    const shared = await Calendar.find({ 'sharedWith.user': req.user._id })
      .populate('owner', 'username displayName profileImage')
      .populate('sharedWith.user', 'username displayName profileImage')
      .select('-events');
    res.json({ owned, shared });
  } catch (err) {
    console.error('Get calendars error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const createCalendar = async (req, res) => {
  const { name, color, description } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });

  try {
    const calendar = await Calendar.create({
      name,
      color: color || '#3788d8',
      description: description || '',
      owner: req.user._id
    });
    await User.findByIdAndUpdate(req.user._id, { $push: { calendars: calendar._id } });
    res.status(201).json(calendar);
  } catch (err) {
    console.error('Create calendar error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateCalendar = async (req, res) => {
  const { calendarId } = req.params;
  const { name, color, description } = req.body;

  try {
    const calendar = await Calendar.findOne({ _id: calendarId, owner: req.user._id });
    if (!calendar) return res.status(404).json({ message: 'Calendar not found' });

    if (name) calendar.name = name;
    if (color) calendar.color = color;
    if (description !== undefined) calendar.description = description;

    await calendar.save();
    res.json(calendar);
  } catch (err) {
    console.error('Update calendar error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteCalendar = async (req, res) => {
  const { calendarId } = req.params;

  try {
    const calendar = await Calendar.findOne({ _id: calendarId, owner: req.user._id });
    if (!calendar) return res.status(404).json({ message: 'Calendar not found' });

    // Remove from user's calendars
    await User.findByIdAndUpdate(req.user._id, { $pull: { calendars: calendarId } });
    
    // Delete the calendar (this will also delete associated events due to cascade)
    await Calendar.findByIdAndDelete(calendarId);
    
    res.json({ message: 'Calendar deleted' });
  } catch (err) {
    console.error('Delete calendar error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// NEW: Share calendar with friends
const shareCalendar = async (req, res) => {
  const { calendarId } = req.params;
  const { friendIds, permission = 'view' } = req.body;
  
  if (!friendIds || !Array.isArray(friendIds) || friendIds.length === 0) {
    return res.status(400).json({ message: 'friendIds array is required' });
  }

  try {
    const calendar = await Calendar.findOne({ _id: calendarId, owner: req.user._id });
    if (!calendar) {
      return res.status(404).json({ message: 'Calendar not found or you are not the owner' });
    }

    // Get current user's friends to validate
    const currentUser = await User.findById(req.user._id).populate('friends', '_id');
    const friendIdStrings = currentUser.friends.map(f => f._id.toString());

    // Track results
    const results = {
      shared: [],
      alreadyShared: [],
      notFriends: [],
      notFound: []
    };

    for (const friendId of friendIds) {
      // Check if user exists
      const friend = await User.findById(friendId);
      if (!friend) {
        results.notFound.push(friendId);
        continue;
      }

      // Check if they're actually friends
      if (!friendIdStrings.includes(friendId)) {
        results.notFriends.push(friendId);
        continue;
      }

      // Check if already shared
      const alreadyShared = calendar.sharedWith.some(
        s => s.user.toString() === friendId
      );
      
      if (alreadyShared) {
        results.alreadyShared.push(friendId);
        continue;
      }

      // Share the calendar
      calendar.sharedWith.push({ user: friendId, permission });
      results.shared.push(friendId);
    }

    await calendar.save();

    res.json({
      message: 'Calendar sharing updated',
      results
    });
  } catch (err) {
    console.error('Share calendar error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// NEW: Unshare calendar from specific users
const unshareCalendar = async (req, res) => {
  const { calendarId } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'userId is required' });
  }

  try {
    const calendar = await Calendar.findOne({ _id: calendarId, owner: req.user._id });
    if (!calendar) {
      return res.status(404).json({ message: 'Calendar not found or you are not the owner' });
    }

    const beforeLength = calendar.sharedWith.length;
    calendar.sharedWith = calendar.sharedWith.filter(
      s => s.user.toString() !== userId
    );

    if (calendar.sharedWith.length === beforeLength) {
      return res.status(404).json({ message: 'User not found in shared list' });
    }

    await calendar.save();
    res.json({ message: 'Calendar unshared successfully' });
  } catch (err) {
    console.error('Unshare calendar error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// NEW: Get calendar sharing details
const getCalendarSharing = async (req, res) => {
  const { calendarId } = req.params;

  try {
    const calendar = await Calendar.findOne({ _id: calendarId, owner: req.user._id })
      .populate('sharedWith.user', 'username displayName profileImage');
    
    if (!calendar) {
      return res.status(404).json({ message: 'Calendar not found or you are not the owner' });
    }

    res.json({
      calendarName: calendar.name,
      sharedWith: calendar.sharedWith
    });
  } catch (err) {
    console.error('Get calendar sharing error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { 
  getCalendars, 
  createCalendar, 
  updateCalendar, 
  deleteCalendar, 
  shareCalendar,
  unshareCalendar,
  getCalendarSharing
};