# Quick Start - Backend Improvements

## Installation & Setup

### 1. Install New Dependencies
```bash
cd pomodoro-api
npm install ioredis  # For caching
```

### 2. Configure Environment
```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your settings
# Make sure to set:
# - REDIS_URL (optional, defaults to localhost:6379)
# - JWT_SECRET (must be 32+ characters)
# - MONGODB_URI
```

### 3. Start Redis (Optional but Recommended)
```bash
# Using Docker (easiest)
docker run -d -p 6379:6379 redis:latest

# Or locally
redis-server

# Or skip if you don't need caching
```

### 4. Start the Server
```bash
npm run dev
```

## Testing the Improvements

### 1. Check Health Status
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "success": true,
  "message": "API is running",
  "environment": "development",
  "database": "connected",
  "uptime": 123.45,
  "nodeVersion": "v18.x.x"
}
```

### 2. View Metrics (Development Only)
```bash
curl http://localhost:5000/api/metrics
```

### 3. Test Authentication with Better Logging
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

### 4. Test Caching
```bash
# First request (hits database)
curl http://localhost:5000/api/settings

# Second request within 5 minutes (hits cache)
curl http://localhost:5000/api/settings

# Check metrics to see cache impact
curl http://localhost:5000/api/metrics
```

### 5. Monitor Performance
```bash
# Make several requests
for i in {1..10}; do
  curl http://localhost:5000/api/health
  sleep 0.5
done

# View metrics
curl http://localhost:5000/api/metrics
```

## Updating Your Controllers

### Old Pattern (Still Works)
```javascript
export const getReflections = async (req, res, next) => {
  try {
    const reflections = await Reflection.find();
    res.json({ success: true, data: reflections });
  } catch (error) {
    next(error);
  }
};
```

### New Pattern (Recommended)
```javascript
import asyncHandler from '../middleware/asyncHandler.js';
import ApiResponse from '../utils/apiResponse.js';

export const getReflections = asyncHandler(async (req, res) => {
  const reflections = await Reflection.find();
  res.json(ApiResponse.success('Reflections retrieved', reflections));
});
```

## Key Features to Use

### 1. Async Handler (Cleaner Error Handling)
```javascript
// Automatically catches and logs errors
export const myEndpoint = asyncHandler(async (req, res) => {
  const data = await someAsyncOperation(); // Errors auto-caught
  res.json(ApiResponse.success('Success', data));
});
```

### 2. Standardized Responses
```javascript
// All responses now consistent
res.json(ApiResponse.success('Created', newItem));
res.status(400).json(ApiResponse.error('Invalid input'));
res.status(404).json(ApiResponse.notFound('User'));
res.status(401).json(ApiResponse.unauthorized());
```

### 3. Automatic Caching
```javascript
// These routes are automatically cached for 5 minutes
GET /api/settings
GET /api/reflections

// Invalidate cache after updates
import { invalidateRelatedCaches } from '../middleware/caching.js';
await invalidateRelatedCaches(['/api/reflections/*']);
```

### 4. Performance Monitoring
```javascript
// Automatic in dev environment
// View at: http://localhost:5000/api/metrics
// Shows: response times, error rates, endpoint usage
```

### 5. Enhanced Logging
```javascript
// All operations automatically logged
// Check logs for:
// - Slow requests (>2s in dev, >1s in prod)
// - Validation errors
// - Security events
// - Performance metrics
```

## Logs Location

Logs are stored in:
- Console: Real-time output during development
- Files: `logs/combined.log` (if configured)

View recent logs:
```bash
tail -f logs/combined.log
```

## Monitoring Dashboard Commands

### View All Metrics
```bash
curl http://localhost:5000/api/metrics | jq
```

### Monitor Specific Endpoint
```bash
# Make requests to your endpoint
curl http://localhost:5000/api/your-endpoint

# Check metrics
curl http://localhost:5000/api/metrics | jq '.data.endpoints | .["POST /api/your-endpoint"]'
```

### Watch Metrics in Real-Time
```bash
# Every 2 seconds
watch -n 2 'curl -s http://localhost:5000/api/metrics | jq'
```

## Troubleshooting

### Redis Connection Issues
```bash
# If Redis fails, the app continues without caching
# Check logs for: "Redis initialization failed"

# To verify Redis is running:
redis-cli ping
# Should return: PONG
```

### Slow Response Times
```bash
# Check metrics endpoint
curl http://localhost:5000/api/metrics

# Look for endpoints with high avgDuration
# Add indexes to MongoDB for frequently queried fields
```

### Memory Leaks
```bash
# Check metrics endpoint
curl http://localhost:5000/api/metrics

# Look at memory delta values
# If increasing, investigate queries
```

## Performance Optimization Tips

1. **Use Caching**: Settings and reflections are cached automatically
2. **Add Database Indexes**: For frequently sorted/filtered fields
3. **Monitor Metrics**: Review `/api/metrics` regularly
4. **Pagination**: Add limit/offset to large data queries
5. **Batch Operations**: Group multiple DB operations

## Next Steps

1. ✅ Update other controllers with `asyncHandler`
2. ✅ Add validation to all routes
3. ✅ Review metrics regularly
4. ✅ Monitor logs for errors
5. ✅ Optimize slow queries

## Support

If something breaks:
1. Check logs: `tail -f logs/combined.log`
2. Test health: `curl http://localhost:5000/api/health`
3. View metrics: `curl http://localhost:5000/api/metrics`
4. Check validation: Look for "Validation error" in logs

## Documentation Files

- **IMPROVEMENTS.md**: Detailed explanation of all changes
- **.env.example**: Configuration template
- **api/index.js**: Main application setup
- **src/middleware/**: New middleware files

Happy coding! 🚀
