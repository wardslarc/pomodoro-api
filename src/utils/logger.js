// src/utils/logger.js - Serverless compatible
const logger = {
  info: (message, meta) => console.log('[INFO]', message, meta || ''),
  error: (message, meta) => console.error('[ERROR]', message, meta || ''),
  warn: (message, meta) => console.warn('[WARN]', message, meta || ''),
  debug: (message, meta) => console.debug('[DEBUG]', message, meta || '')
};

export default logger;