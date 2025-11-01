import express from 'express';
import Reflection from '../models/Reflection.js';
import Session from '../models/Session.js';
import auth from '../middleware/auth.js';
import { validateReflection } from '../middleware/validation.js';

const router = express.Router();

router.post('/', auth, validateReflection, async (req, res, next) => {
  try {
    const { sessionId, learnings, createdAt } = req.body;

    const session = await Session.findOne({
      _id: sessionId,
      userId: req.user._id
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    const existingReflection = await Reflection.findOne({ sessionId });
    if (existingReflection) {
      return res.status(400).json({
        success: false,
        message: 'Reflection already exists for this session'
      });
    }

    const reflection = new Reflection({
      userId: req.user._id,
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

router.get('/', auth, async (req, res, next) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    
    const reflections = await Reflection.find({ userId: req.user._id })
      .populate('sessionId', 'sessionType duration completedAt')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Reflection.countDocuments({ userId: req.user._id });

    res.json({
      success: true,
      data: {
        reflections,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/session/:sessionId', auth, async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const reflection = await Reflection.findOne({
      sessionId,
      userId: req.user._id
    }).populate('sessionId', 'sessionType duration completedAt');

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

router.put('/:id', auth, validateReflection, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { learnings } = req.body;

    const reflection = await Reflection.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { learnings, updatedAt: new Date() },
      { new: true }
    );

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
      },
      message: 'Reflection updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const reflection = await Reflection.findOneAndDelete({
      _id: id,
      userId: req.user._id
    });

    if (!reflection) {
      return res.status(404).json({
        success: false,
        message: 'Reflection not found'
      });
    }

    res.json({
      success: true,
      message: 'Reflection deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;