// utils/metrics.js
// Performance and health monitoring

const os = require('os');
const { logger } = require('../config/logger');
const { getCacheStats } = require('../config/redis');
const { getModelStatus } = require('../services/nlp.service');

class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
      },
      latency: {
        analyze: [],
        moderate: [],
        botAsk: [],
      },
      cache: {
        hits: 0,
        misses: 0,
      },
    };
    
    this.startTime = Date.now();
  }

  /**
   * Record request
   */
  recordRequest(success = true) {
    this.metrics.requests.total++;
    if (success) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.errors++;
    }
  }

  /**
   * Record latency
   */
  recordLatency(endpoint, duration) {
    if (this.metrics.latency[endpoint]) {
      this.metrics.latency[endpoint].push(duration);
      
      // Keep only last 100 measurements
      if (this.metrics.latency[endpoint].length > 100) {
        this.metrics.latency[endpoint].shift();
      }
    }
  }

  /**
   * Calculate average latency
   */
  getAverageLatency(endpoint) {
    const latencies = this.metrics.latency[endpoint];
    if (!latencies || latencies.length === 0) return 0;
    
    const sum = latencies.reduce((a, b) => a + b, 0);
    return Math.round(sum / latencies.length);
  }

  /**
   * Get 95th percentile latency
   */
  getP95Latency(endpoint) {
    const latencies = this.metrics.latency[endpoint];
    if (!latencies || latencies.length === 0) return 0;
    
    const sorted = [...latencies].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index];
  }

  /**
   * Get system metrics
   */
  getSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    
    return {
      cpu: {
        count: os.cpus().length,
        usage: os.loadavg()[0] / os.cpus().length * 100,
      },
      memory: {
        total: Math.round(os.totalmem() / 1024 / 1024),
        free: Math.round(os.freemem() / 1024 / 1024),
        used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
        processHeap: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        processTotal: Math.round(memoryUsage.rss / 1024 / 1024),
      },
      uptime: {
        system: Math.round(os.uptime()),
        process: Math.round(process.uptime()),
      },
    };
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics() {
    const system = this.getSystemMetrics();
    const cacheStats = getCacheStats();
    const modelStatus = getModelStatus();
    
    return {
      timestamp: new Date().toISOString(),
      service: {
        name: 'civix-nlp-service',
        version: '1.0.0',
        environment: process.env.NODE_ENV,
        uptime: Math.round(process.uptime()),
      },
      requests: {
        ...this.metrics.requests,
        errorRate: this.metrics.requests.total > 0
          ? (this.metrics.requests.errors / this.metrics.requests.total * 100).toFixed(2)
          : 0,
      },
      latency: {
        analyze: {
          avg: this.getAverageLatency('analyze'),
          p95: this.getP95Latency('analyze'),
        },
        moderate: {
          avg: this.getAverageLatency('moderate'),
          p95: this.getP95Latency('moderate'),
        },
        botAsk: {
          avg: this.getAverageLatency('botAsk'),
          p95: this.getP95Latency('botAsk'),
        },
      },
      cache: cacheStats,
      models: modelStatus,
      system,
      health: this.getHealthStatus(system, cacheStats),
    };
  }

  /**
   * Determine health status
   */
  getHealthStatus(system, cacheStats) {
    const issues = [];
    let status = 'healthy';
    
    // Check CPU usage
    if (system.cpu.usage > 80) {
      issues.push('High CPU usage');
      status = 'degraded';
    }
    
    // Check memory usage
    const memoryUsagePercent = (system.memory.used / system.memory.total) * 100;
    if (memoryUsagePercent > 90) {
      issues.push('Critical memory usage');
      status = 'unhealthy';
    } else if (memoryUsagePercent > 80) {
      issues.push('High memory usage');
      status = 'degraded';
    }
    
    // Check cache hit rate
    const hitRate = parseFloat(cacheStats.hitRate);
    if (hitRate < 70) {
      issues.push('Low cache hit rate');
      if (status === 'healthy') status = 'degraded';
    }
    
    // Check error rate
    const errorRate = this.metrics.requests.total > 0
      ? (this.metrics.requests.errors / this.metrics.requests.total * 100)
      : 0;
    if (errorRate > 5) {
      issues.push('High error rate');
      status = 'degraded';
    }
    
    return {
      status,
      issues,
    };
  }

  /**
   * Log metrics periodically
   */
  startPeriodicLogging(intervalMinutes = 5) {
    setInterval(() => {
      const metrics = this.getMetrics();
      
      logger.info('Periodic metrics report', {
        requests: metrics.requests,
        latency: metrics.latency,
        cache: metrics.cache,
        health: metrics.health,
        memory: `${metrics.system.memory.processHeap}MB`,
      });
      
      // Warn if unhealthy
      if (metrics.health.status !== 'healthy') {
        logger.warn('Service health degraded', {
          status: metrics.health.status,
          issues: metrics.health.issues,
        });
      }
      
    }, intervalMinutes * 60 * 1000);
    
    logger.info(`Metrics logging started (every ${intervalMinutes} minutes)`);
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
      },
      latency: {
        analyze: [],
        moderate: [],
        botAsk: [],
      },
      cache: {
        hits: 0,
        misses: 0,
      },
    };
    
    logger.info('Metrics reset');
  }
}

// Singleton instance
const metricsCollector = new MetricsCollector();

// Start periodic logging
metricsCollector.startPeriodicLogging(5);

module.exports = metricsCollector;