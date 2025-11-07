import express from 'express';
import Post from '../models/Post.js';
import Reflection from '../models/Reflection.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Simple auth middleware to avoid circular dependencies
const auth = async (req, res, next) => {
  try {
    const { verifyToken } = await import('../utils/auth.js');
    const User = await import('../models/User.js').then(m => m.default);
    
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is invalid. User not found.'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token is invalid.'
    });
  }
};

// Get all public posts with pagination
router.get('/posts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ isPublic: true })
      .populate('userId', 'name email')
      .populate('comments.userId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPosts = await Post.countDocuments({ isPublic: true });

    res.json({
      success: true,
      data: {
        posts,
        pagination: {
          current: page,
          pages: Math.ceil(totalPosts / limit),
          total: totalPosts
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching posts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch posts'
    });
  }
});

// Create a post from reflection
router.post('/posts', auth, async (req, res) => {
  try {
    const { reflectionId, isPublic = true } = req.body;

    // Find the reflection
    const reflection = await Reflection.findById(reflectionId);
    if (!reflection) {
      return res.status(404).json({
        success: false,
        message: 'Reflection not found'
      });
    }

    // Check if user owns the reflection
    if (reflection.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to share this reflection'
      });
    }

    // Check if post already exists for this reflection
    const existingPost = await Post.findOne({ reflectionId });
    if (existingPost) {
      return res.status(400).json({
        success: false,
        message: 'This reflection has already been shared'
      });
    }

    // Extract tags from learnings
    const tags = extractTags(reflection.learnings);

    // Create post
    const post = new Post({
      reflectionId: reflection._id,
      learnings: reflection.learnings,
      sessionId: reflection.sessionId,
      userId: req.user.id,
      isPublic,
      tags
    });

    await post.save();
    
    // Populate user data for response
    await post.populate('userId', 'name email');
    await post.populate('comments.userId', 'name');

    logger.info('Post created successfully', { postId: post._id, userId: req.user.id });

    res.status(201).json({
      success: true,
      data: { post }
    });
  } catch (error) {
    logger.error('Error creating post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create post'
    });
  }
});

// Like/unlike a post
router.post('/posts/:postId/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const userId = req.user.id;
    const likeIndex = post.likes.indexOf(userId);

    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1);
    } else {
      // Like
      post.likes.push(userId);
    }

    await post.save();

    res.json({
      success: true,
      data: { 
        likes: post.likes,
        likesCount: post.likes.length
      }
    });
  } catch (error) {
    logger.error('Error liking post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to like post'
    });
  }
});

// Add comment to post
router.post('/posts/:postId/comment', auth, async (req, res) => {
  try {
    const { text } = req.body;
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required'
      });
    }

    if (text.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Comment must be less than 500 characters'
      });
    }

    const comment = {
      userId: req.user.id,
      text: text.trim(),
      createdAt: new Date()
    };

    post.comments.push(comment);
    await post.save();

    // Populate the new comment's user data
    await post.populate('comments.userId', 'name');

    const newComment = post.comments[post.comments.length - 1];

    logger.info('Comment added to post', { 
      postId: post._id, 
      userId: req.user.id,
      commentId: newComment._id 
    });

    res.json({
      success: true,
      data: { comment: newComment }
    });
  } catch (error) {
    logger.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment'
    });
  }
});

// Get user's posts
router.get('/me/posts', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ userId: req.user.id })
      .populate('userId', 'name email')
      .populate('comments.userId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPosts = await Post.countDocuments({ userId: req.user.id });

    res.json({
      success: true,
      data: {
        posts,
        pagination: {
          current: page,
          pages: Math.ceil(totalPosts / limit),
          total: totalPosts
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching user posts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user posts'
    });
  }
});

// Delete a post
router.delete('/posts/:postId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if user owns the post
    if (post.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this post'
      });
    }

    await Post.findByIdAndDelete(req.params.postId);

    logger.info('Post deleted', { postId: post._id, userId: req.user.id });

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete post'
    });
  }
});

// Helper function to extract tags from text
function extractTags(text) {
  const commonTags = ['focus', 'distraction', 'productivity', 'learning', 'challenge', 'break', 'flow', 'motivation', 'progress', 'achievement'];
  const foundTags = [];
  
  const words = text.toLowerCase().split(/\s+/);
  commonTags.forEach(tag => {
    if (words.some(word => word.includes(tag))) {
      foundTags.push(tag);
    }
  });
  
  return foundTags.slice(0, 3); // Limit to 3 tags
}

export default router;