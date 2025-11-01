import { createLogger, format, transports } from 'winston';
import config from '../config/env.js';

const logFormat = format.combine(
  format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  format.errors({ stack: true }),
  format.json()
);

const developmentFormat = format.combine(
  format.colorize(),
  format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
  })
);

const logger = createLogger({
  level: config.logLevel,
  format: logFormat,
  defaultMeta: { service: 'pomodoro-api' },
  transports: [
    new transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

if (config.env !== 'production') {
  logger.add(new transports.Console({
    format: developmentFormat,
  }));
}

if (config.env === 'production') {
  logger.add(new transports.Console({
    format: logFormat,
  }));
}

logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

export default logger;