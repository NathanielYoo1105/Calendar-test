const express   = require('express');
const jwt       = require('jsonwebtoken');
const mongoose  = require('mongoose');
const Event     = require('../models/Event');
const Calendar  = require('../models/Calendar');
const auth      = require('../middleware/auth');
const router    = express.Router();

/* --------------------------------------------------------------
   Helper – can the requestor modify a calendar?
   -------------------------------------------------------------- */
async function canEditCalendar(calendarId, userId) {
  const cal = await Calendar.findById(calendarId);
  if (!cal) return false;
  if (cal.owner.toString() === userId) return true;
  return cal.sharedWith.some(s => s.user.toString() === userId && s.permission === 'edit');
}

/* --------------------------------------------------------------
   GET /api/events   → all events the user can see
   -------------------------------------------------------------- */
router.get('/', auth, async (req, res) => {
  try {
    // owned calendars
    const ownedCals = await Calendar.find({ owner: req.user.id }).select('_id');
    const ownedIds  = ownedCals.map(c=>c._id);

    // shared calendars (view permission is enough)
    const sharedCals = await Calendar.find({ 'sharedWith.user': req.user.id }).select('_id');
    const sharedIds  = sharedCals.map(c=>c._id);

    const events = await Event.find({
      calendar: { $in: [...ownedIds, ...sharedIds] }
    }).sort({ date: 1 });

    res.json(events);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/* --------------------------------------------------------------
   POST /api/events
   -------------------------------------------------------------- */
router.post('/', auth, async (req, res) => {
  const { calendarId, title, date, time, endTime, isAllDay,
          details, recurrence, color, location, sharedWith } = req.body;

  if (!calendarId || !title || !date) return res.status(400).json({ message: 'calendarId, title, date required' });

  const editable = await canEditCalendar(calendarId, req.user.id);
  if (!editable) return res.status(403).json({ message: 'No edit permission' });

  try {
    const event = new Event({
      calendar: calendarId,
      title, date: new Date(date), time, endTime,
      isAllDay: !!isAllDay, details, recurrence, color, location,
      sharedWith: sharedWith || []
    });
    await event.save();
    await Calendar.findByIdAndUpdate(calendarId, { $push: { events: event._id } });
    res.status(201).json(event);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/* --------------------------------------------------------------
   PUT /api/events/:id
   -------------------------------------------------------------- */
router.put('/:id', auth, async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ message: 'Not found' });

  const editable = await canEditCalendar(event.calendar, req.user.id);
  if (!editable) return res.status(403).json({ message: 'No edit permission' });

  const updates = { ...req.body };
  if (updates.date) updates.date = new Date(updates.date);
  try {
    const updated = await Event.findByIdAndUpdate(req.params.id, updates, { new:true, runValidators:true });
    res.json(updated);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/* --------------------------------------------------------------
   DELETE /api/events/:id
   -------------------------------------------------------------- */
router.delete('/:id', auth, async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ message: 'Not found' });

  const editable = await canEditCalendar(event.calendar, req.user.id);
  if (!editable) return res.status(403).json({ message: 'No edit permission' });

  await Event.deleteOne({ _id: req.params.id });
  await Calendar.findByIdAndUpdate(event.calendar, { $pull: { events: req.params.id } });
  res.json({ message: 'Deleted' });
});

/* --------------------------------------------------------------
   GET /api/events/shared   (events shared directly with you)
   -------------------------------------------------------------- */
router.get('/shared', auth, async (req, res) => {
  const events = await Event.find({ sharedWith: req.user.id })
                 .populate('calendar', 'name')
                 .sort({ date: 1 });
  res.json(events);
});

module.exports = router;