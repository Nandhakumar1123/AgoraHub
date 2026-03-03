const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    return log;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'nlp-service.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    
    // Separate file for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5,
    }),
  ],
});

// Audit logger for compliance (immutable logs)
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      maxsize: 52428800, // 50MB
      maxFiles: 50, // Keep more audit logs
    }),
  ],
});

// Helper functions
const logRequest = (req, result) => {
  logger.info('API Request', {
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    communityId: req.body?.community_id,
    ip: req.ip,
    duration: result?.duration,
  });
};

const logAudit = (data) => {
  auditLogger.info('Audit Log', {
    ...data,
    timestamp: new Date().toISOString(),
  });
};

const logError = (error, context = {}) => {
  logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    ...context,
  });
};

const logPerformance = (operation, duration, metadata = {}) => {
  if (duration > 1000) {
    logger.warn('Slow operation', {
      operation,
      duration: `${duration}ms`,
      ...metadata,
    });
  } else {
    logger.debug('Performance metric', {
      operation,
      duration: `${duration}ms`,
      ...metadata,
    });
  }
};

module.exports = {
  logger,
  auditLogger,
  logRequest,
  logAudit,
  logError,
  logPerformance,
};