import express from 'express';
import Session from '../models/Session.js';
import User from '../models/User.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.get('/leaderboard', auth, async (req, res, next) => {
  try {
    const leaderboardData = await Session.aggregate([
      {
        $match: {
          sessionType: 'work'
        }
      },
      {
        $group: {
          _id: '$userId',
          totalFocusMinutes: { $sum: '$duration' },
          completedPomodoros: { $count: {} },
          lastActivity: { $max: '$completedAt' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          _id: 1,
          name: '$user.name',
          email: '$user.email',
          totalFocusMinutes: 1,
          completedPomodoros: 1,
          lastActivity: 1
        }
      },
      {
        $sort: { totalFocusMinutes: -1 }
      },
      {
        $limit: 50
      }
    ]);

    const usersWithStats = await Promise.all(
      leaderboardData.map(async (userData, index) => {
        const streak = await calculateUserStreak(userData._id);
        
        const totalSessions = await Session.countDocuments({ 
          userId: userData._id 
        });
        const productivityScore = totalSessions > 0 
          ? Math.min(100, Math.round((userData.completedPomodoros / totalSessions) * 100))
          : 0;

        return {
          ...userData,
          rank: index + 1,
          currentStreak: streak,
          productivityScore: productivityScore
        };
      })
    );

    res.json({
      success: true,
      data: {
        users: usersWithStats
      }
    });

  } catch (error) {
    next(error);
  }
});

async function calculateUserStreak(userId) {
  try {
    const sessions = await Session.find({ 
      userId: userId,
      sessionType: 'work'
    }).sort({ completedAt: -1 }).limit(100);

    if (sessions.length === 0) return 0;

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(23, 59, 59, 999);

    const uniqueDates = new Set();
    sessions.forEach(session => {
      const dateKey = session.completedAt.toDateString();
      uniqueDates.add(dateKey);
    });

    while (true) {
      const dateString = currentDate.toDateString();
      if (uniqueDates.has(dateString)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
        currentDate.setHours(23, 59, 59, 999);
      } else {
        break;
      }
    }

    return streak;
  } catch (error) {
    return 0;
  }
}

export default router;