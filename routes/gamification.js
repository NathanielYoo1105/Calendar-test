// routes/gamification.js (NEW FILE)
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Event = require('../models/Event');
const User = require('../models/User');
const Calendar = require('../models/Calendar');

// Mark event as completed
router.post('/complete/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Verify user has access to this event's calendar
    const calendar = await Calendar.findById(event.calendar);
    if (!calendar) {
      return res.status(404).json({ message: 'Calendar not found' });
    }
    
    const isOwner = calendar.owner.toString() === req.user._id.toString();
    const hasAccess = calendar.sharedWith.some(
      s => s.user.toString() === req.user._id.toString()
    );
    
    if (!isOwner && !hasAccess) {
      return res.status(403).json({ message: 'No access to this event' });
    }
    
    // Check if already completed
    if (event.completed) {
      return res.status(400).json({ 
        message: 'Event already completed',
        pointsAwarded: 0
      });
    }
    
    // Check if eligible for points
    const isEligible = event.isEligibleForPoints();
    let pointsAwarded = 0;
    
    if (isEligible) {
      const user = await User.findById(req.user._id);
      
      // Get points for this task
      pointsAwarded = user.getTaskPoints();
      
      // Add points
      user.addPoints(pointsAwarded);
      
      // Update streak
      user.updateStreak();
      
      await user.save();
    }
    
    // Mark event as completed
    event.completed = true;
    event.completedAt = new Date();
    event.pointsAwarded = pointsAwarded;
    await event.save();
    
    // Get updated user stats
    const updatedUser = await User.findById(req.user._id).select('points streak dailyTasksCompleted');
    
    res.json({
      message: 'Event completed successfully',
      pointsAwarded,
      isEligible,
      userStats: {
        weeklyPoints: updatedUser.points.weeklyTotal,
        lifetimePoints: updatedUser.points.lifetimeTotal,
        currentStreak: updatedUser.streak.current,
        dailyTasksCompleted: updatedUser.dailyTasksCompleted.count
      }
    });
  } catch (e) {
    console.error('Complete event error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Uncomplete event (undo)
router.post('/uncomplete/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Verify user has access
    const calendar = await Calendar.findById(event.calendar);
    if (!calendar) {
      return res.status(404).json({ message: 'Calendar not found' });
    }
    
    const isOwner = calendar.owner.toString() === req.user._id.toString();
    if (!isOwner) {
      return res.status(403).json({ message: 'Only calendar owner can uncomplete events' });
    }
    
    if (!event.completed) {
      return res.status(400).json({ message: 'Event is not completed' });
    }
    
    // Remove points if they were awarded
    if (event.pointsAwarded > 0) {
      const user = await User.findById(req.user._id);
      user.points.lifetimeTotal = Math.max(0, user.points.lifetimeTotal - event.pointsAwarded);
      user.points.weeklyTotal = Math.max(0, user.points.weeklyTotal - event.pointsAwarded);
      await user.save();
    }
    
    // Uncomplete event
    event.completed = false;
    event.completedAt = null;
    event.pointsAwarded = 0;
    await event.save();
    
    const updatedUser = await User.findById(req.user._id).select('points streak');
    
    res.json({
      message: 'Event uncompleted successfully',
      userStats: {
        weeklyPoints: updatedUser.points.weeklyTotal,
        lifetimePoints: updatedUser.points.lifetimeTotal,
        currentStreak: updatedUser.streak.current
      }
    });
  } catch (e) {
    console.error('Uncomplete event error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Get user stats
router.get('/stats', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('points streak dailyTasksCompleted');
    
    // Check for weekly reset
    user.checkWeeklyReset();
    await user.save();
    
    res.json({
      weeklyPoints: user.points.weeklyTotal,
      lifetimePoints: user.points.lifetimeTotal,
      currentStreak: user.streak.current,
      dailyTasksCompleted: user.dailyTasksCompleted.count || 0,
      weekStartDate: user.points.weekStartDate
    });
  } catch (e) {
    console.error('Get stats error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Get weekly leaderboard (friends only)
router.get('/leaderboard', protect, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id).populate('friends', '_id');
    
    if (!currentUser.friends || currentUser.friends.length === 0) {
      return res.json([]);
    }
    
    const friendIds = currentUser.friends.map(f => f._id);
    friendIds.push(req.user._id); // Include current user
    
    // Get all friends with their weekly points
    const leaderboard = await User.find({ _id: { $in: friendIds } })
      .select('username displayName profileImage points')
      .lean();
    
    // Check for weekly reset and filter out stale data
    const now = new Date();
    const currentWeekStart = getStartOfWeek(now);
    
    const validLeaderboard = leaderboard.map(user => {
      // Initialize points structure if missing (for existing users)
      if (!user.points) {
        user.points = {
          weeklyTotal: 0,
          lifetimeTotal: 0,
          weekStartDate: currentWeekStart
        };
      }
      
      // If weekStartDate is missing or before current week, reset their weekly total
      if (!user.points.weekStartDate || new Date(user.points.weekStartDate) < currentWeekStart) {
        user.points.weeklyTotal = 0;
      }
      
      return {
        userId: user._id,
        username: user.username,
        displayName: user.displayName,
        profileImage: user.profileImage,
        weeklyPoints: user.points.weeklyTotal || 0,
        isCurrentUser: user._id.toString() === req.user._id.toString()
      };
    });
    
    // Sort by weekly points (descending)
    validLeaderboard.sort((a, b) => b.weeklyPoints - a.weeklyPoints);
    
    // Add rank
    validLeaderboard.forEach((user, index) => {
      user.rank = index + 1;
    });
    
    res.json(validLeaderboard);
  } catch (e) {
    console.error('Get leaderboard error:', e);
    res.status(500).json({ message: e.message });
  }
});

// Helper function
function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

module.exports = router;