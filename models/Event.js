const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: String, required: true },  // YYYY-MM-DD
  time: { type: String },  // HH:MM
  endTime: { type: String },
  isAllDay: { type: Boolean, default: false },
  details: { type: String },
  recurrence: {
    type: { type: String },  // 'daily', 'weekly', 'monthly'
    interval: { type: Number },
    until: { type: String }  // YYYY-MM-DD
  },
  color: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

module.exports = mongoose.model('Event', eventSchema);