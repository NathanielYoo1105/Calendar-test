// models/Event.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 100 },
  date: { type: Date, required: true },
  time: { type: String, match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/ },
  endTime: { type: String, match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/ },
  isAllDay: { type: Boolean, default: false },
  details: { type: String, trim: true, maxlength: 500, default: '' },
  recurrence: {
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'] },
    interval: { type: Number, min: 1, default: 1 },
    until: { type: Date }
  },
  color: { type: String, match: /^#[0-9A-Fa-f]{6}$/, default: '#000000' },
  location: { type: String, trim: true, maxlength: 100, default: '' },

  calendar: { type: mongoose.Schema.Types.ObjectId, ref: 'Calendar', required: true },
  shareWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  
  // Task completion (NEW)
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
  pointsAwarded: { type: Number, default: 0 }
}, { timestamps: true });

eventSchema.index({ calendar: 1, date: 1 });
eventSchema.index({ shareWith: 1 });
eventSchema.index({ completed: 1 });

// Method to check if event is eligible for points
eventSchema.methods.isEligibleForPoints = function() {
  if (this.completed) return false; // Already completed
  
  const now = new Date();
  const createdAt = this.createdAt;
  const eventDateTime = this.getEventDateTime();
  
  // Must be created at least 4 hours in advance
  const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
  if (hoursSinceCreation < 4) return true;
  
  // Must be completed within 8 hours of event time
  const hoursAfterEvent = (now - eventDateTime) / (1000 * 60 * 60);
  if (hoursAfterEvent > 8) return false;
  
  // Must be completed on or after event time
  if (now < eventDateTime) return false;
  
  return true;
};

// Helper to get event date-time as Date object
eventSchema.methods.getEventDateTime = function() {
  const eventDate = new Date(this.date);
  
  if (this.isAllDay || !this.time) {
    eventDate.setHours(0, 0, 0, 0);
    return eventDate;
  }
  
  const [hours, minutes] = this.time.split(':').map(Number);
  eventDate.setHours(hours, minutes, 0, 0);
  return eventDate;
};

module.exports = mongoose.model('Event', eventSchema);