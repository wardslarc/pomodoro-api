# Migration Guide - Updating Existing Controllers

## Overview
This guide helps you update your existing controllers to use the new improvements with minimal effort.

## Step 1: Add AsyncHandler Import

**Before:**
```javascript
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
```

**After:**
```javascript
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import asyncHandler from '../middleware/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';
import logger from '../utils/logger.js';
```

## Step 2: Convert Controllers

### Simple Controllers (No Error Handling)

**Before:**
```javascript
export const getUsers = async (req, res, next) => {
  const users = await User.find();
  res.json({
    success: true,
    data: users
  });
};
```

**After:**
```javascript
export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find();
  res.json(ApiResponse.success('Users retrieved', users));
});
```

### Controllers with Try-Catch

**Before:**
```javascript
export const createUser = async (req, res, next) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json({
      success: true,
      message: 'User created',
      data: user
    });
  } catch (error) {
    next(error);
  }
};
```

**After:**
```javascript
export const createUser = asyncHandler(async (req, res) => {
  const user = await User.create(req.body);
  logger.info('User created', { userId: user._id });
  res.status(201).json(ApiResponse.success('User created', user));
});
```

### Controllers with Error Responses

**Before:**
```javascript
export const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    
    res.json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};
```

**After:**
```javascript
export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    logger.warn('Update attempted on non-existent user', { userId: req.params.id });
    return res.status(404).json(ApiResponse.notFound('User'));
  }
  
  const updatedUser = await User.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  
  logger.info('User updated', { userId: updatedUser._id });
  res.json(ApiResponse.success('User updated', updatedUser));
});
```

### Controllers with Multiple Validations

**Before:**
```javascript
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete admin users'
      });
    }
    
    await User.findByIdAndDelete(req.params.id);
    res.json({
      success: true,
      message: 'User deleted'
    });
  } catch (error) {
    next(error);
  }
};
```

**After:**
```javascript
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    logger.warn('Delete attempted on non-existent user', { userId: req.params.id });
    return res.status(404).json(ApiResponse.notFound('User'));
  }
  
  if (user.role === 'admin') {
    logger.warn('Delete attempted on admin user', { userId: user._id });
    return res.status(403).json(ApiResponse.forbidden('Cannot delete admin users'));
  }
  
  await User.findByIdAndDelete(req.params.id);
  logger.info('User deleted', { userId: user._id });
  
  res.json(ApiResponse.success('User deleted'));
});
```

## Step 3: Update Routes with Validation

### Add Validators to Routes

**Before:**
```javascript
// routes/users.js
router.post('/', userController.createUser);
```

**After:**
```javascript
// routes/users.js
import { validators, handleValidationErrors } from '../middleware/validation.js';

router.post('/', 
  validators.createUser(),
  handleValidationErrors,
  userController.createUser
);
```

### Create Validators for Your Controllers

**Add to validation.js:**
```javascript
export const validators = {
  // ... existing validators ...
  
  createUser: () => [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ min: 2 })
      .withMessage('Name must be at least 2 characters'),
    body('email')
      .isEmail()
      .withMessage('Valid email required')
      .normalizeEmail(),
    body('role')
      .optional()
      .isIn(['user', 'admin'])
      .withMessage('Invalid role')
  ],
  
  updateUser: () => [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2 })
      .withMessage('Name must be at least 2 characters'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('Valid email required')
  ]
};
```

## Step 4: Add Cache Invalidation

When modifying data, invalidate related caches:

```javascript
import { invalidateRelatedCaches } from '../middleware/caching.js';

export const createUser = asyncHandler(async (req, res) => {
  const user = await User.create(req.body);
  
  // Invalidate user-related caches
  await invalidateRelatedCaches(['/api/users/*', '/api/users']);
  
  logger.info('User created', { userId: user._id });
  res.status(201).json(ApiResponse.success('User created', user));
});

export const updateUser = asyncHandler(async (req, res) => {
  const updatedUser = await User.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  
  // Invalidate caches
  await invalidateRelatedCaches(['/api/users/*', `/api/users/${req.params.id}`]);
  
  logger.info('User updated', { userId: updatedUser._id });
  res.json(ApiResponse.success('User updated', updatedUser));
});
```

## Step 5: Update Pagination

Add pagination helper to list endpoints:

**Before:**
```javascript
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find();
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};
```

**After:**
```javascript
import { getPaginationParams } from '../middleware/validation.js';

export const getUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  
  const [users, total] = await Promise.all([
    User.find().skip(skip).limit(limit),
    User.countDocuments()
  ]);
  
  res.json(ApiResponse.paginated('Users retrieved', users, {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit)
  }));
});
```

## Migration Checklist

For each controller file:

- [ ] Add imports (asyncHandler, ApiResponse, logger)
- [ ] Wrap all export functions with `asyncHandler`
- [ ] Remove try-catch blocks
- [ ] Update response format to use ApiResponse
- [ ] Add logging for important operations
- [ ] Add cache invalidation for mutations
- [ ] Add route validation
- [ ] Test all endpoints

## Priority Order (Recommended)

1. ✅ **Auth Controller** - Already updated, use as reference
2. ✅ **Session Controller** - High traffic, benefits from caching
3. ✅ **Reflection Controller** - Frequently accessed
4. ⏳ **Settings Controller** - Already has caching
5. ⏳ **User Controller** - Moderate priority
6. ⏳ **Social Controller** - Lower priority

## Testing Your Updates

After updating a controller:

```bash
# 1. Start the server
npm run dev

# 2. Test the endpoint
curl http://localhost:5000/api/your-endpoint

# 3. Check logs for proper logging
# Should see: timestamp, level, message, context

# 4. Check metrics
curl http://localhost:5000/api/metrics

# 5. Verify validation (if added)
curl -X POST http://localhost:5000/api/your-endpoint \
  -H "Content-Type: application/json" \
  -d '{}' # Empty body to trigger validation error
```

## Common Patterns

### Pattern 1: CRUD Operations
```javascript
// Create
export const create = asyncHandler(async (req, res) => {
  const item = await Model.create(req.body);
  await invalidateRelatedCaches(['/api/items/*']);
  logger.info('Item created', { itemId: item._id });
  res.status(201).json(ApiResponse.success('Item created', item));
});

// Read
export const getById = asyncHandler(async (req, res) => {
  const item = await Model.findById(req.params.id);
  if (!item) return res.status(404).json(ApiResponse.notFound('Item'));
  res.json(ApiResponse.success('Item retrieved', item));
});

// Update
export const update = asyncHandler(async (req, res) => {
  const item = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!item) return res.status(404).json(ApiResponse.notFound('Item'));
  await invalidateRelatedCaches(['/api/items/*']);
  logger.info('Item updated', { itemId: item._id });
  res.json(ApiResponse.success('Item updated', item));
});

// Delete
export const delete = asyncHandler(async (req, res) => {
  const item = await Model.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json(ApiResponse.notFound('Item'));
  await invalidateRelatedCaches(['/api/items/*']);
  logger.info('Item deleted', { itemId: item._id });
  res.json(ApiResponse.success('Item deleted'));
});
```

### Pattern 2: Complex Operations with Validation
```javascript
export const complexOperation = asyncHandler(async (req, res) => {
  // Validate business logic
  const user = await User.findById(req.user.id);
  if (!user.isPremium) {
    logger.warn('Premium feature access denied', { userId: user._id });
    return res.status(403).json(ApiResponse.forbidden('Premium feature required'));
  }
  
  // Perform operation
  const result = await SomeModel.create({...});
  
  // Invalidate caches
  await invalidateRelatedCaches(['/api/some/*']);
  
  // Log and respond
  logger.info('Operation completed', { userId: user._id, resultId: result._id });
  res.json(ApiResponse.success('Operation completed', result));
});
```

## Rollback if Issues Occur

If an updated controller causes issues:

1. Remove asyncHandler wrapper
2. Add back try-catch blocks
3. Use old response format
4. Restart server

The improvements are **fully compatible** with existing code, so you can migrate gradually.

## Support

If you have questions during migration:
1. Review IMPROVEMENTS.md for detailed explanations
2. Check auth controller as reference (already migrated)
3. Look at tests for usage examples
4. Check logs for error details

Happy migrating! 🚀
