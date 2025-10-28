// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  email: { type: String, trim: true, lowercase: true },
  
  // Profile
  displayName: { type: String, trim: true },
  bio: { type: String, trim: true, maxlength: 200 },
  profileImage: { type: String },
  
  // Relationships
  calendars: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Calendar' }],
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  // Gamification (NEW)
  points: {
    lifetimeTotal: { type: Number, default: 0 },
    weeklyTotal: { type: Number, default: 0 },
    weekStartDate: { type: Date, default: () => getStartOfWeek(new Date()) }
  },
  
  streak: {
    current: { type: Number, default: 0 },
    lastCompletionDate: { type: Date }
  },
  
  dailyTasksCompleted: {
    date: { type: Date },
    count: { type: Number, default: 0 }
  }
}, { timestamps: true });

// Helper function to get start of week (Monday)
function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

// Method to reset weekly points if needed
userSchema.methods.checkWeeklyReset = function() {
  const now = new Date();
  const weekStart = getStartOfWeek(now);
  
  if (!this.points.weekStartDate || this.points.weekStartDate < weekStart) {
    this.points.weeklyTotal = 0;
    this.points.weekStartDate = weekStart;
    return true;
  }
  return false;
};

// Method to check and update streak
userSchema.methods.updateStreak = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (!this.streak.lastCompletionDate) {
    // First completion ever
    this.streak.current = 1;
    this.streak.lastCompletionDate = today;
    return;
  }
  
  const lastCompletion = new Date(this.streak.lastCompletionDate);
  lastCompletion.setHours(0, 0, 0, 0);
  
  const daysDiff = Math.floor((today - lastCompletion) / (1000 * 60 * 60 * 24));
  
  if (daysDiff === 0) {
    // Already completed today, don't update
    return;
  } else if (daysDiff === 1) {
    // Consecutive day
    this.streak.current += 1;
    this.streak.lastCompletionDate = today;
  } else {
    // Streak broken
    this.streak.current = 1;
    this.streak.lastCompletionDate = today;
  }
};

// Method to get points for task completion
userSchema.methods.getTaskPoints = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Check if we need to reset daily count
  if (!this.dailyTasksCompleted.date || 
      new Date(this.dailyTasksCompleted.date).setHours(0,0,0,0) < today.getTime()) {
    this.dailyTasksCompleted.date = today;
    this.dailyTasksCompleted.count = 0;
  }
  
  this.dailyTasksCompleted.count += 1;
  
  // Calculate points based on daily task count
  if (this.dailyTasksCompleted.count === 1) {
    return 3;
  } else if (this.dailyTasksCompleted.count <= 3) {
    return 2;
  } else {
    return 1;
  }
};

// Method to add points
userSchema.methods.addPoints = function(points) {
  this.checkWeeklyReset();
  this.points.lifetimeTotal += points;
  this.points.weeklyTotal += points;
};

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const bcrypt = require('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  const bcrypt = require('bcryptjs');
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);