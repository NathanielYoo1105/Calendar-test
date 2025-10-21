const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    minlength: [1, 'Title must be at least 1 character'],
    maxlength: [100, 'Title cannot exceed 100 characters'],
  },
  date: {
    type: Date,
    required: [true, 'Event date is required'],
  },
  time: {
    type: String,
    match: [/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format'],
  },
  endTime: {
    type: String,
    match: [/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:MM format'],
  },
  isAllDay: {
    type: Boolean,
    default: false,
  },
  details: {
    type: String,
    trim: true,
    maxlength: [500, 'Details cannot exceed 500 characters'],
    default: '',
  },
  recurrence: {
    frequency: {
      type: String,
      enum: {
        values: ['daily', 'weekly', 'monthly'],
        message: '{VALUE} is not a valid recurrence frequency',
      },
    },
    interval: {
      type: Number,
      min: [1, 'Interval must be at least 1'],
      default: 1,
    },
    until: {
      type: Date,
    },
  },
  color: {
    type: String,
    match: [/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code (e.g., #FF0000)'],
    default: '#000000',
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  location: {
    type: String,
    trim: true,
    maxlength: [100, 'Location cannot exceed 100 characters'],
    default: '',
  },
}, {
  timestamps: true,
  validateModifiedOnly: false, // For Mongoose 8.x compatibility
});

// Index for efficient queries by user and date
eventSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('Event', eventSchema);