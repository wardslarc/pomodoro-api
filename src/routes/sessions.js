import express from 'express';
import { validateSession } from '../middleware/validation.js';
import { auth } from '../middleware/auth.js';
import Session from '../models/Session.js';

const router = express.Router();

router.get('/', auth, async (req, res, next) => {
  try {
    const { limit = 100, page = 1 } = req.query;
    
    const sessions = await Session.find({ userId: req.user._id })
      .sort({ completedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Session.countDocuments({ userId: req.user._id });

    res.json({
      success: true,
      data: {
        sessions,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', auth, validateSession, async (req, res, next) => {
  try {
    const { sessionType, duration, completedAt } = req.body;

    const session = new Session({
      userId: req.user._id,
      sessionType,
      duration,
      completedAt: completedAt ? new Date(completedAt) : new Date()
    });

    await session.save();

    res.status(201).json({
      success: true,
      data: {
        session
      },
      message: 'Session saved successfully'
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const session = await Session.findOneAndDelete({
      _id: id,
      userId: req.user._id
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;