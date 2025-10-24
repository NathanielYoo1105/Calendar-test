const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Event = require('../models/Event'); // Path to models folder

const router = express.Router();

// Middleware to verify JWT
const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.split(' ')[1]; // Expect 'Bearer <token>'
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

// Get all events for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const events = await Event.find({ userId: req.user.id }).sort({ date: 1 });
    res.json(events);
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ message: 'Server error fetching events' });
  }
});

// Create event
router.post('/', authMiddleware, async (req, res) => {
  const { title, date, time, endTime, isAllDay, details, recurrence, color, location, sharedWith } = req.body;

  // Input validation
  if (!title || !date) {
    return res.status(400).json({ message: 'Title and date are required' });
  }
  if (time && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
    return res.status(400).json({ message: 'Time must be in HH:MM format' });
  }
  if (endTime && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(endTime)) {
    return res.status(400).json({ message: 'End time must be in HH:MM format' });
  }
  if (recurrence && recurrence.frequency && !['daily', 'weekly', 'monthly'].includes(recurrence.frequency)) {
    return res.status(400).json({ message: 'Recurrence frequency must be daily, weekly, or monthly' });
  }
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return res.status(400).json({ message: 'Color must be a valid hex code' });
  }
  if (sharedWith && !Array.isArray(sharedWith)) {
    return res.status(400).json({ message: 'sharedWith must be an array of user IDs' });
  }

  try {
    const eventData = {
      title: title.trim(),
      date: new Date(date),
      time,
      endTime,
      isAllDay: !!isAllDay,
      details: details ? details.trim() : '',
      location: location ? location.trim() : '',
      sharedWith: sharedWith || [],
      recurrence: recurrence ? {
        frequency: recurrence.frequency,
        interval: recurrence.interval || 1,
        until: recurrence.until ? new Date(recurrence.until) : undefined,
      } : undefined,
      color: color || '#000000',
      userId: req.user.id,
    };

    const event = new Event(eventData);
    await event.save();
    res.status(201).json(event);
  } catch (err) {
    console.error('Create event error:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error creating event' });
  }

  if (sharedWith) {
    const user = await User.findById(req.user.id).populate('friends');
    const friendIds = user.friends.map(f => f._id.toString());
    if (sharedWith.some(id => !friendIds.includes(id))) {
      return res.status(400).json({ message: 'Can only share with friends' });
    }
  }
});

// Update event
router.put('/:id', authMiddleware, async (req, res) => {
  const { title, date, time, endTime, isAllDay, details, recurrence, color, location, sharedWith } = req.body;

  // Input validation
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid event ID' });
  }
  if (title && title.length === 0) {
    return res.status(400).json({ message: 'Title cannot be empty' });
  }
  if (date && isNaN(new Date(date).getTime())) {
    return res.status(400).json({ message: 'Invalid date format' });
  }
  if (time && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
    return res.status(400).json({ message: 'Time must be in HH:MM format' });
  }
  if (endTime && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(endTime)) {
    return res.status(400).json({ message: 'End time must be in HH:MM format' });
  }
  if (recurrence && recurrence.frequency && !['daily', 'weekly', 'monthly'].includes(recurrence.frequency)) {
    return res.status(400).json({ message: 'Recurrence frequency must be daily, weekly, or monthly' });
  }
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return res.status(400).json({ message: 'Color must be a valid hex code' });
  }

  try {
    const updateData = {};
    if (title) updateData.title = title.trim();
    if (date) updateData.date = new Date(date);
    if (time) updateData.time = time;
    if (endTime) updateData.endTime = endTime;
    if (typeof isAllDay === 'boolean') updateData.isAllDay = isAllDay;
    if (details) updateData.details = details.trim();
    if (location !== undefined) updateData.location = location.trim();
    if (sharedWith) updateData.sharedWith = sharedWith;
    if (recurrence) {
      updateData.recurrence = {
        frequency: recurrence.frequency || undefined,
        interval: recurrence.interval || 1,
        until: recurrence.until ? new Date(recurrence.until) : undefined,
      };
    }
    if (color) updateData.color = color;

    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    if (!event) {
      return res.status(404).json({ message: 'Event not found or unauthorized' });
    }
    res.json(event);
  } catch (err) {
    console.error('Update event error:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error updating event' });
  }

  if (sharedWith) {
    const user = await User.findById(req.user.id).populate('friends');
    const friendIds = user.friends.map(f => f._id.toString());
    if (sharedWith.some(id => !friendIds.includes(id))) {
      return res.status(400).json({ message: 'Can only share with friends' });
    }
  }
});

// Delete event
router.delete('/:id', authMiddleware, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid event ID' });
  }

  try {
    const event = await Event.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!event) {
      return res.status(404).json({ message: 'Event not found or unauthorized' });
    }
    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ message: 'Server error deleting event' });
  }
});

// Get shared events
router.get('/shared', authMiddleware, async (req, res) => {
  try {
    const sharedEvents = await Event.find({ sharedWith: req.user.id })
      .populate('userId', 'username displayName')
      .sort({ date: 1 });
    res.json(sharedEvents);
  } catch (err) {
    console.error('Get shared events error:', err);
    res.status(500).json({ message: 'Server error fetching shared events' });
  }
});

module.exports = router;