import logger from '../utils/logger.js';

/**
 * Performance monitoring middleware
 * Tracks response times and logs slow requests
 */
export const performanceMonitor = (slowRequestThreshold = 1000) => {
  return (req, res, next) => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    // Capture original end function
    const originalEnd = res.end.bind(res);
    
    res.end = function (...args) {
      const duration = Date.now() - startTime;
      const memoryUsed = (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024; // MB

      const requestMetrics = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        memoryDelta: `${memoryUsed.toFixed(2)}MB`,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      };

      // Log slow requests
      if (duration > slowRequestThreshold) {
        logger.warn('Slow request detected', {
          ...requestMetrics,
          threshold: `${slowRequestThreshold}ms`
        });
      } else if (res.statusCode >= 400) {
        // Log all errors
        logger.error('Request error', requestMetrics);
      } else {
        // Log successful requests in debug mode
        logger.debug('Request completed', requestMetrics);
      }

      // Attach metrics to res for potential use
      res.metrics = requestMetrics;

      return originalEnd(...args);
    };

    next();
  };
};

/**
 * Request logger middleware - logs all incoming requests
 */
export const requestLogger = (req, res, next) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  next();
};

/**
 * API usage metrics - track endpoint usage
 */
export class ApiMetrics {
  constructor() {
    this.metrics = {};
  }

  recordRequest(endpoint, statusCode, duration) {
    if (!this.metrics[endpoint]) {
      this.metrics[endpoint] = {
        total: 0,
        successful: 0,
        failed: 0,
        avgDuration: 0,
        totalDuration: 0,
        errors: {}
      };
    }

    const metric = this.metrics[endpoint];
    metric.total++;
    
    if (statusCode < 400) {
      metric.successful++;
    } else {
      metric.failed++;
      metric.errors[statusCode] = (metric.errors[statusCode] || 0) + 1;
    }

    metric.totalDuration += duration;
    metric.avgDuration = metric.totalDuration / metric.total;
  }

  getMetrics(endpoint = null) {
    if (endpoint) {
      return this.metrics[endpoint] || null;
    }
    return this.metrics;
  }

  clearMetrics(endpoint = null) {
    if (endpoint) {
      delete this.metrics[endpoint];
    } else {
      this.metrics = {};
    }
  }

  getSummary() {
    let totalRequests = 0;
    let totalErrors = 0;
    let avgDuration = 0;
    let totalDuration = 0;

    for (const endpoint in this.metrics) {
      const metric = this.metrics[endpoint];
      totalRequests += metric.total;
      totalErrors += metric.failed;
      totalDuration += metric.totalDuration;
    }

    avgDuration = totalRequests > 0 ? totalDuration / totalRequests : 0;

    return {
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) + '%' : '0%',
      avgDuration: `${avgDuration.toFixed(2)}ms`,
      endpoints: Object.keys(this.metrics).length
    };
  }
}

export const apiMetrics = new ApiMetrics();

/**
 * Metrics collector middleware
 */
export const metricsCollector = (req, res, next) => {
  const startTime = Date.now();
  const originalEnd = res.end.bind(res);

  res.end = function (...args) {
    const duration = Date.now() - startTime;
    const endpoint = `${req.method} ${req.baseUrl}${req.path}`;
    
    apiMetrics.recordRequest(endpoint, res.statusCode, duration);
    
    return originalEnd(...args);
  };

  next();
};

export default {
  performanceMonitor,
  requestLogger,
  ApiMetrics,
  apiMetrics,
  metricsCollector
};
