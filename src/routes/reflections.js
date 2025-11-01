import express from 'express';
import Reflection from '../models/Reflection.js';
import Session from '../models/Session.js';
import auth from '../middleware/auth.js';
import { validateReflection } from '../middleware/validation.js';

const router = express.Router();

// GET reflections with pagination
router.get('/', auth, async (req, res, next) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log('🔍 Fetching reflections:', {
      userId: req.user._id,
      limit,
      page,
      skip
    });

    const reflections = await Reflection.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('sessionId', 'title duration createdAt'); // Populate session details if needed

    const total = await Reflection.countDocuments({ userId: req.user._id });

    console.log('✅ Reflections fetched successfully:', {
      count: reflections.length,
      total,
      userId: req.user._id
    });

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
    console.error('❌ Error fetching reflections:', error);
    next(error);
  }
});

// GET single reflection by ID
router.get('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log('🔍 Fetching reflection:', {
      userId: req.user._id,
      reflectionId: id
    });

    const reflection = await Reflection.findOne({
      _id: id,
      userId: req.user._id
    }).populate('sessionId', 'title duration createdAt');

    if (!reflection) {
      console.log('❌ Reflection not found:', id);
      return res.status(404).json({
        success: false,
        message: 'Reflection not found'
      });
    }

    console.log('✅ Reflection found:', reflection._id);

    res.json({
      success: true,
      data: {
        reflection
      }
    });
  } catch (error) {
    console.error('❌ Error fetching reflection:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid reflection ID'
      });
    }
    
    next(error);
  }
});

// POST reflection (your existing code)
router.post('/', auth, validateReflection, async (req, res, next) => {
  try {
    const { sessionId, learnings, createdAt } = req.body;

    console.log('🔍 Creating reflection request:', {
      userId: req.user._id,
      sessionId,
      learningsLength: learnings?.length,
      createdAt
    });

    const isLocalSession = sessionId.startsWith('local-');
    
    if (!isLocalSession) {
      console.log('🔍 Checking session existence:', sessionId);
      const session = await Session.findOne({
        _id: sessionId,
        userId: req.user._id
      });

      if (!session) {
        console.log('❌ Session not found:', sessionId);
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }
      console.log('✅ Session found:', session._id);
    } else {
      console.log('ℹ️ Local session, skipping session validation');
    }

    // Check if reflection already exists for this session AND user
    console.log('🔍 Checking for existing reflection...');
    const existingReflection = await Reflection.findOne({ 
      sessionId, 
      userId: req.user._id 
    });
    
    if (existingReflection) {
      console.log('❌ Reflection already exists for this session and user:', {
        sessionId,
        userId: req.user._id,
        existingReflectionId: existingReflection._id
      });
      return res.status(400).json({
        success: false,
        message: 'Reflection already exists for this session'
      });
    }
    console.log('✅ No existing reflection found');

    console.log('🔍 Creating new reflection...');
    const reflection = new Reflection({
      userId: req.user._id,
      sessionId,
      learnings,
      createdAt: createdAt ? new Date(createdAt) : new Date()
    });

    console.log('🔍 Saving reflection to database...');
    await reflection.save();
    console.log('✅ Reflection saved successfully:', reflection._id);

    res.status(201).json({
      success: true,
      data: {
        reflection
      },
      message: 'Reflection saved successfully'
    });
  } catch (error) {
    console.error('❌ Error creating reflection:', error);
    
    // Check if it's a MongoDB duplicate key error
    if (error.code === 11000) {
      console.error('❌ MongoDB duplicate key error:', error.keyValue);
      return res.status(400).json({
        success: false,
        message: 'Reflection already exists for this session'
      });
    }
    
    // Check if it's a validation error
    if (error.name === 'ValidationError') {
      console.error('❌ Mongoose validation error:', error.errors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message,
          value: err.value
        }))
      });
    }
    
    next(error);
  }
});

export default router;