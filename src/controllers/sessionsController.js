import Session from '../models/Session.js';

const getUserSessions = async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: 'Error fetching sessions'
    });
  }
};

const createSession = async (req, res) => {
  try {
    const { sessionType, duration, completedAt } = req.body;

    if (!sessionType || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Session type and duration are required'
      });
    }

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
    res.status(500).json({
      success: false,
      message: 'Error creating session'
    });
  }
};

const deleteSession = async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: 'Error deleting session'
    });
  }
};

export {
  getUserSessions,
  createSession,
  deleteSession
};