import express from 'express';
import Reflection from '../models/Reflection.js';
import Session from '../models/Session.js';
import { auth } from '../middleware/auth.js';
import { validateReflection } from '../middleware/validation.js';
import { getUserId } from '../utils/userUtils.js';

const router = express.Router();

// GET reflections with pagination
router.get('/', auth, async (req, res, next) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // STANDARDIZED: Use getUserId utility
    const userId = getUserId(req);

    const reflections = await Reflection.find({ userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('sessionId', 'title duration createdAt');

    const total = await Reflection.countDocuments({ userId });

    res.json({
      success: true,
      data: {
        reflections,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST reflection
router.post('/', auth, validateReflection, async (req, res, next) => {
  try {
    const { sessionId, learnings, createdAt } = req.body;
    
    // STANDARDIZED: Use getUserId utility
    const userId = getUserId(req);

    const isLocalSession = sessionId.startsWith('local-');
    
    if (!isLocalSession) {
      const session = await Session.findOne({
        _id: sessionId,
        userId
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }
    }

    const existingReflection = await Reflection.findOne({ 
      sessionId, 
      userId 
    });
    
    if (existingReflection) {
      return res.status(400).json({
        success: false,
        message: 'Reflection already exists for this session'
      });
    }

    const reflection = new Reflection({
      userId,
      sessionId,
      learnings,
      createdAt: createdAt ? new Date(createdAt) : new Date()
    });

    await reflection.save();

    res.status(201).json({
      success: true,
      data: {
        reflection
      },
      message: 'Reflection saved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET single reflection by ID
router.get('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const reflection = await Reflection.findOne({
      _id: id,
      userId
    }).populate('sessionId', 'title duration createdAt');

    if (!reflection) {
      return res.status(404).json({
        success: false,
        message: 'Reflection not found'
      });
    }

    res.json({
      success: true,
      data: {
        reflection
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;