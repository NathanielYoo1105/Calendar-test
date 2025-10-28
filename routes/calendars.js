// routes/calendars.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
  getCalendars, 
  createCalendar, 
  updateCalendar, 
  deleteCalendar, 
  shareCalendar,
  unshareCalendar,
  getCalendarSharing
} = require('../controllers/calendarController');

// Get all calendars (owned + shared)
router.get('/', protect, getCalendars);

// Create new calendar
router.post('/', protect, createCalendar);

// Update calendar
router.put('/:calendarId', protect, updateCalendar);

// Delete calendar
router.delete('/:calendarId', protect, deleteCalendar);

// Share calendar with friends (NEW)
router.post('/:calendarId/share', protect, shareCalendar);

// Unshare calendar from user (NEW)
router.delete('/:calendarId/share', protect, unshareCalendar);

// Get calendar sharing details (NEW)
router.get('/:calendarId/sharing', protect, getCalendarSharing);

module.exports = router;