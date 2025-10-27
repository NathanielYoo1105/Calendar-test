// models/Event.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title:      { type: String, required: true, trim: true, maxlength: 100 },
  date:       { type: Date, required: true },
  time:       { type: String, match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/ },
  endTime:    { type: String, match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/ },
  isAllDay:   { type: Boolean, default: false },
  details:    { type: String, trim: true, maxlength: 500, default: '' },
  recurrence: { frequency: { type: String, enum: { values: ['daily', 'weekly', 'monthly'], message: '{VALUE} is not a valid recurrence frequency', }, }, interval: { type: Number, min: [1, 'Interval must be at least 1'], default: 1, }, until: { type: Date, }, },
  color:      { type: String, match: /^#[0-9A-Fa-f]{6}$/, default: '#000000' },
  location:   { type: String, trim: true, maxlength: 100, default: '' },

  // ---------- NEW ----------
  calendar:   { type: mongoose.Schema.Types.ObjectId, ref: 'Calendar', required: true },

  // keep old sharing field (still useful for quick “share with friends”)
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }]
}, { timestamps: true });

eventSchema.index({ calendar: 1, date: 1 });
eventSchema.index({ sharedWith: 1 });

module.exports = mongoose.model('Event', eventSchema);