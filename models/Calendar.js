const mongoose = require('mongoose');

const calendarSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  color: { type: String, default: '#3788d8' }, // ADD THIS LINE
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  events: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
  sharedWith: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    permission: { type: String, enum: ['view', 'edit'], default: 'view' }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Calendar', calendarSchema);