const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String, required: true, unique: true, trim: true,
    minlength: 3, maxlength: 50
  },
  password: { type: String, required: true, minlength: 6 },
  email:    { type: String, trim: true, lowercase: true,
              match: /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, sparse: true },
  displayName: { type: String, trim: true, maxlength: 50,
                 default: function () { return this.username; } },
  bio:         { type: String, trim: true, maxlength: 200, default: '' },
  profileImage:{ type: String, default: '' },

  // ---------- NEW ----------
  calendars:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Calendar' }],

  // friend system (already in your code)
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: []
  }],
  friendRequests: [{
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status:   { type: String, enum: ['pending','accepted','rejected'], default:'pending' }
  }]
}, { timestamps: true });

userSchema.index({ username: 1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});
userSchema.methods.comparePassword = async function (c) { return bcrypt.compare(c,this.password); };
userSchema.set('toJSON', { transform: (doc,ret)=>{ delete ret.password; return ret; }});

module.exports = mongoose.model('User', userSchema);