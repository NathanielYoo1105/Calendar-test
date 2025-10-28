// routes/events.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Event = require('../models/Event');
const Calendar = require('../models/Calendar');

// FIX: Convert ObjectIds to strings for comparison
const canEditCalendar = async (calendarId, userId) => {
  const cal = await Calendar.findById(calendarId);
  if (!cal) return false;
  
  // Convert both to strings for comparison
  const userIdStr = userId.toString();
  const ownerIdStr = cal.owner.toString();
  
  // Check if user is owner
  if (ownerIdStr === userIdStr) return true;
  
  // Check if user has edit permission
  return cal.sharedWith.some(s => s.user.toString() === userIdStr && s.permission === 'edit');
};

router.get('/', protect, async (req, res) => {
  try {
    const ownedCals = await Calendar.find({ owner: req.user._id }).select('_id');
    const sharedCals = await Calendar.find({ 'sharedWith.user': req.user._id }).select('_id');
    const calendarIds = [...ownedCals, ...sharedCals].map(c => c._id);

    const events = await Event.find({ calendar: { $in: calendarIds } }).sort({ date: 1 });
    res.json(events);
  } catch (e) {
    console.error('Get events error:', e);
    res.status(500).json({ message: e.message });
  }
});

router.post('/', protect, async (req, res) => {
  const { calendarId, title, date, time, endTime, isAllDay, details, recurrence, color, location, shareWith } = req.body;
  
  if (!calendarId || !title || !date) {
    return res.status(400).json({ message: 'calendarId, title, and date are required' });
  }

  try {
    // Check edit permission
    const hasPermission = await canEditCalendar(calendarId, req.user._id);
    if (!hasPermission) {
      return res.status(403).json({ message: 'No edit permission for this calendar' });
    }

    // Create event
    const event = await Event.create({
      calendar: calendarId,
      title,
      date: new Date(date),
      time: time || null,
      endTime: endTime || null,
      isAllDay: !!isAllDay,
      details: details || '',
      recurrence: recurrence || undefined,
      color: color || '#4caf50',
      location: location || '',
      shareWith: shareWith || []
    });

    // Add event to calendar
    await Calendar.findByIdAndUpdate(calendarId, { $push: { events: event._id } });
    
    res.status(201).json(event);
  } catch (e) {
    console.error('Create event error:', e);
    res.status(500).json({ message: e.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check edit permission
    const hasPermission = await canEditCalendar(event.calendar, req.user._id);
    if (!hasPermission) {
      return res.status(403).json({ message: 'No edit permission for this calendar' });
    }

    // Prepare updates
    const updates = { ...req.body };
    if (updates.date) updates.date = new Date(updates.date);
    
    // Remove fields that shouldn't be updated
    delete updates._id;
    delete updates.calendar;

    const updated = await Event.findByIdAndUpdate(
      req.params.id, 
      updates, 
      { new: true, runValidators: true }
    );
    
    res.json(updated);
  } catch (e) {
    console.error('Update event error:', e);
    res.status(500).json({ message: e.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check edit permission
    const hasPermission = await canEditCalendar(event.calendar, req.user._id);
    if (!hasPermission) {
      return res.status(403).json({ message: 'No edit permission for this calendar' });
    }

    // Delete event
    await Event.deleteOne({ _id: req.params.id });
    
    // Remove from calendar
    await Calendar.findByIdAndUpdate(event.calendar, { $pull: { events: req.params.id } });
    
    res.json({ message: 'Event deleted successfully' });
  } catch (e) {
    console.error('Delete event error:', e);
    res.status(500).json({ message: e.message });
  }
});

router.get('/shared', protect, async (req, res) => {
  try {
    const events = await Event.find({ shareWith: req.user._id })
      .populate('calendar', 'name color')
      .sort({ date: 1 });
    res.json(events);
  } catch (e) {
    console.error('Get shared events error:', e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;