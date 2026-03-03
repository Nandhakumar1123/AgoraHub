// utils/helpers.js
// Common utility functions for the NLP service

const crypto = require('crypto');
const { logger } = require('../config/logger');

/**
 * Generate unique hash from string
 */
function generateHash(text, algorithm = 'sha256', length = 16) {
  return crypto
    .createHash(algorithm)
    .update(text)
    .digest('hex')
    .substring(0, length);
}

/**
 * Generate secure random string
 */
function generateRandomString(length = 32) {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * Sleep/delay function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
async function retry(fn, options = {}) {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 2,
    onRetry = null,
  } = options;

  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts) {
        break;
      }
      
      const waitTime = delay * Math.pow(backoff, attempt - 1);
      
      if (onRetry) {
        onRetry(attempt, waitTime, error);
      }
      
      logger.warn('Retry attempt', {
        attempt,
        maxAttempts,
        waitTime,
        error: error.message,
      });
      
      await sleep(waitTime);
    }
  }
  
  throw lastError;
}

/**
 * Chunk array into smaller arrays
 */
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Deep clone object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  if (obj instanceof Object) {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text, maxLength = 100, suffix = '...') {
  if (!text || text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength - suffix.length).trim() + suffix;
}

/**
 * Calculate percentage
 */
function calculatePercentage(value, total, decimals = 2) {
  if (total === 0) return 0;
  return Number(((value / total) * 100).toFixed(decimals));
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Format milliseconds to human readable duration
 */
function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Sanitize filename
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-z0-9_\-\.]/gi, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
}

/**
 * Check if string is valid JSON
 */
function isValidJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Parse JSON safely
 */
function parseJSON(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch (e) {
    logger.warn('JSON parse error', { error: e.message });
    return defaultValue;
  }
}

/**
 * Check if email is valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if URL is valid
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch (e) {
    return null;
  }
}

/**
 * Debounce function
 */
function debounce(func, wait) {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
function throttle(func, limit) {
  let inThrottle;
  
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Remove duplicates from array
 */
function removeDuplicates(array) {
  return [...new Set(array)];
}

/**
 * Remove duplicates from array of objects by key
 */
function removeDuplicatesByKey(array, key) {
  const seen = new Set();
  return array.filter(item => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

/**
 * Group array by key
 */
function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {});
}

/**
 * Sort array of objects by key
 */
function sortBy(array, key, order = 'asc') {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Calculate average of array
 */
function average(array) {
  if (array.length === 0) return 0;
  return array.reduce((sum, val) => sum + val, 0) / array.length;
}

/**
 * Calculate median of array
 */
function median(array) {
  if (array.length === 0) return 0;
  
  const sorted = [...array].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  
  return sorted[middle];
}

/**
 * Get percentile value from array
 */
function percentile(array, p) {
  if (array.length === 0) return 0;
  
  const sorted = [...array].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;
  
  if (lower === upper) {
    return sorted[lower];
  }
  
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Capitalize first letter of string
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert string to title case
 */
function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => capitalize(word))
    .join(' ');
}

/**
 * Generate slug from string
 */
function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Validate Indian phone number
 */
function isValidIndianPhone(phone) {
  const phoneRegex = /^[6-9]\d{9}$/;
  const cleanPhone = phone.replace(/[\s\-\+]/g, '');
  
  if (cleanPhone.startsWith('91')) {
    return phoneRegex.test(cleanPhone.substring(2));
  }
  
  return phoneRegex.test(cleanPhone);
}

/**
 * Validate Aadhar number
 */
function isValidAadhar(aadhar) {
  const aadharRegex = /^\d{12}$/;
  const cleanAadhar = aadhar.replace(/[\s\-]/g, '');
  return aadharRegex.test(cleanAadhar);
}

/**
 * Mask sensitive data
 */
function maskData(value, type = 'default') {
  if (!value) return value;
  
  const str = String(value);
  
  switch (type) {
    case 'email':
      const [username, domain] = str.split('@');
      if (!domain) return str;
      return `${username[0]}${'*'.repeat(username.length - 1)}@${domain}`;
    
    case 'phone':
      if (str.length < 4) return str;
      return `${'*'.repeat(str.length - 4)}${str.slice(-4)}`;
    
    case 'aadhar':
      if (str.length !== 12) return str;
      return `${'*'.repeat(8)}${str.slice(-4)}`;
    
    case 'card':
      if (str.length < 4) return str;
      return `${'*'.repeat(str.length - 4)}${str.slice(-4)}`;
    
    default:
      if (str.length < 4) return '****';
      return `${str.substring(0, 2)}${'*'.repeat(str.length - 4)}${str.slice(-2)}`;
  }
}

/**
 * Time-based greeting
 */
function getGreeting() {
  const hour = new Date().getHours();
  
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Good night';
}

/**
 * Check if date is today
 */
function isToday(date) {
  const today = new Date();
  const checkDate = new Date(date);
  
  return checkDate.getDate() === today.getDate() &&
         checkDate.getMonth() === today.getMonth() &&
         checkDate.getFullYear() === today.getFullYear();
}

/**
 * Get time ago string
 */
function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1,
  };
  
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    
    if (interval >= 1) {
      return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
    }
  }
  
  return 'just now';
}

/**
 * Format date to readable string
 */
function formatDate(date, format = 'default') {
  const d = new Date(date);
  
  const options = {
    default: { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
    short: { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
    },
    long: { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
    },
    time: {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    },
  };
  
  return d.toLocaleString('en-US', options[format] || options.default);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  
  return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Unescape HTML special characters
 */
function unescapeHtml(text) {
  const map = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
  };
  
  return text.replace(/&amp;|&lt;|&gt;|&quot;|&#039;/g, entity => map[entity]);
}

/**
 * Generate UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Check if running in production
 */
function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

/**
 * Get environment variable with fallback
 */
function getEnv(key, defaultValue = null) {
  return process.env[key] || defaultValue;
}

module.exports = {
  // Crypto & Hashing
  generateHash,
  generateRandomString,
  generateUUID,
  
  // Async utilities
  sleep,
  retry,
  debounce,
  throttle,
  
  // Array utilities
  chunkArray,
  removeDuplicates,
  removeDuplicatesByKey,
  groupBy,
  sortBy,
  average,
  median,
  percentile,
  
  // String utilities
  truncateText,
  sanitizeFilename,
  capitalize,
  toTitleCase,
  slugify,
  escapeHtml,
  unescapeHtml,
  maskData,
  
  // Validation
  isValidJSON,
  isValidEmail,
  isValidUrl,
  isValidIndianPhone,
  isValidAadhar,
  isEmpty,
  
  // Parsing
  parseJSON,
  extractDomain,
  
  // Formatting
  formatBytes,
  formatDuration,
  formatDate,
  calculatePercentage,
  
  // Date utilities
  isToday,
  timeAgo,
  getGreeting,
  
  // Object utilities
  deepClone,
  
  // Environment
  isProduction,
  isDevelopment,
  getEnv,
};