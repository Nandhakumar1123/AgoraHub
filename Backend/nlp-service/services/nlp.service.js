const { pipeline } = require('@xenova/transformers');
const LanguageDetect = require('langdetect');
const { getModelCacheKey, getCache, setCache } = require('../config/redis');
const { logger, logPerformance } = require('../config/logger');

// Fallback mock service for when models fail to load
const mockNlpService = {
  analyzeText: async (text) => {
    logger.warn('Using mock NLP service - models failed to load');

    // Simple mock analysis based on keywords
    const positiveWords = ['good', 'great', 'excellent', 'wonderful', 'amazing', 'love', 'like', 'happy', 'positive', 'awesome'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'sad', 'negative', 'horrible', 'worst', 'angry'];

    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

    let sentiment, toxicity;

    if (positiveCount > negativeCount) {
      sentiment = { label: 'POSITIVE', score: 0.85 };
      toxicity = { label: 'non-toxic', score: 0.15 };
    } else if (negativeCount > positiveCount) {
      sentiment = { label: 'NEGATIVE', score: 0.75 };
      toxicity = { label: 'toxic', score: 0.65 };
    } else {
      sentiment = { label: 'NEUTRAL', score: 0.60 };
      toxicity = { label: 'non-toxic', score: 0.25 };
    }

    // Mock language detection
    const language = lowerText.includes('hello') || lowerText.includes('world') ? 'en' : 'unknown';

    return {
      sentiment,
      toxicity,
      safe: toxicity.label === 'non-toxic',
      language
    };
  }
};

// Model instances (lazy loaded)
let sentimentPipeline = null;
let toxicityPipeline = null;
let multilingualSentimentPipeline = null;

// Model loading status
const modelStatus = {
  sentiment: 'not_loaded',
  toxicity: 'not_loaded',
  multilingual: 'not_loaded',
};

/**
 * Initialize sentiment analysis model
 */
async function initSentimentModel() {
  if (sentimentPipeline) return sentimentPipeline;
  
  const startTime = Date.now();
  logger.info('Loading sentiment analysis model...');
  
  try {
    modelStatus.sentiment = 'loading';
    
    sentimentPipeline = await pipeline(
      'sentiment-analysis',
      'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
      { 
        quantized: true,
        progress_callback: (progress) => {
          if (progress.status === 'progress') {
            logger.debug('Sentiment model download progress', {
              file: progress.file,
              progress: `${progress.progress}%`,
            });
          }
        },
      }
    );
    
    modelStatus.sentiment = 'loaded';
    const duration = Date.now() - startTime;
    logPerformance('Sentiment model initialization', duration);
    
    logger.info('✅ Sentiment analysis model loaded', { duration: `${duration}ms` });
    
    return sentimentPipeline;
  } catch (error) {
    modelStatus.sentiment = 'error';
    logger.error('Failed to load sentiment model', { error: error.message });
    throw error;
  }
}

/**
 * Initialize toxicity detection model
 */
async function initToxicityModel() {
  if (toxicityPipeline) return toxicityPipeline;
  
  const startTime = Date.now();
  logger.info('Loading toxicity detection model...');
  
  try {
    modelStatus.toxicity = 'loading';
    
    toxicityPipeline = await pipeline(
      'text-classification',
      'Xenova/toxic-bert',
      { 
        quantized: true,
        progress_callback: (progress) => {
          if (progress.status === 'progress') {
            logger.debug('Toxicity model download progress', {
              file: progress.file,
              progress: `${progress.progress}%`,
            });
          }
        },
      }
    );
    
    modelStatus.toxicity = 'loaded';
    const duration = Date.now() - startTime;
    logPerformance('Toxicity model initialization', duration);
    
    logger.info('✅ Toxicity detection model loaded', { duration: `${duration}ms` });
    
    return toxicityPipeline;
  } catch (error) {
    modelStatus.toxicity = 'error';
    logger.error('Failed to load toxicity model', { error: error.message });
    throw error;
  }
}

/**
 * Initialize multilingual sentiment model
 */
async function initMultilingualModel() {
  if (multilingualSentimentPipeline) return multilingualSentimentPipeline;
  
  const startTime = Date.now();
  logger.info('Loading multilingual sentiment model...');
  
  try {
    modelStatus.multilingual = 'loading';
    
    multilingualSentimentPipeline = await pipeline(
      'sentiment-analysis',
      'Xenova/bert-base-multilingual-uncased-sentiment',
      { quantized: true }
    );
    
    modelStatus.multilingual = 'loaded';
    const duration = Date.now() - startTime;
    logPerformance('Multilingual model initialization', duration);
    
    logger.info('✅ Multilingual sentiment model loaded', { duration: `${duration}ms` });
    
    return multilingualSentimentPipeline;
  } catch (error) {
    modelStatus.multilingual = 'error';
    logger.error('Failed to load multilingual model', { error: error.message });
    throw error;
  }
}

/**
 * Detect language of text
 */
function detectLanguage(text) {
  try {
    const languages = LanguageDetect.detect(text, 1);
    return languages.length > 0 ? languages[0].lang : 'en';
  } catch (error) {
    logger.warn('Language detection failed, defaulting to English', {
      error: error.message,
    });
    return 'en';
  }
}

/**
 * Analyze sentiment with caching
 */
async function analyzeSentiment(text, language = 'en') {
  const cacheKey = getModelCacheKey(text, 'sentiment');
  
  // Check cache first
  const cached = await getCache(cacheKey);
  if (cached) {
    logger.debug('Sentiment cache hit');
    return cached;
  }
  
  const startTime = Date.now();
  
  try {
    let pipeline;
    
    if (language === 'en') {
      pipeline = await initSentimentModel();
    } else {
      pipeline = await initMultilingualModel();
    }
    
    const result = await pipeline(text.substring(0, 512)); // Limit to 512 chars for model
    
    const sentiment = {
      label: result[0].label,
      score: result[0].score,
      language,
    };
    
    // Cache result
    await setCache(cacheKey, sentiment, 3600); // 1 hour TTL
    
    const duration = Date.now() - startTime;
    logPerformance('Sentiment analysis', duration, { language });
    
    return sentiment;
  } catch (error) {
    logger.error('Sentiment analysis error', { error: error.message });
    throw error;
  }
}

/**
 * Detect toxicity with caching
 */
async function analyzeToxicity(text) {
  const cacheKey = getModelCacheKey(text, 'toxicity');
  
  // Check cache first
  const cached = await getCache(cacheKey);
  if (cached) {
    logger.debug('Toxicity cache hit');
    return cached;
  }
  
  const startTime = Date.now();
  
  try {
    const pipeline = await initToxicityModel();
    
    const result = await pipeline(text.substring(0, 512));
    
    const toxicity = {
      label: result[0].label,
      score: result[0].score,
      isToxic: result[0].label.toLowerCase() === 'toxic' && result[0].score > 0.5,
    };
    
    // Cache result
    await setCache(cacheKey, toxicity, 3600); // 1 hour TTL
    
    const duration = Date.now() - startTime;
    logPerformance('Toxicity detection', duration);
    
    return toxicity;
  } catch (error) {
    logger.error('Toxicity detection error', { error: error.message });
    throw error;
  }
}

/**
 * Full NLP analysis pipeline
 */
async function analyzeText(text) {
  const startTime = Date.now();

  try {
    // Detect language
    const language = detectLanguage(text);

    // Run sentiment and toxicity in parallel
    const [sentiment, toxicity] = await Promise.all([
      analyzeSentiment(text, language),
      analyzeToxicity(text),
    ]);

    const duration = Date.now() - startTime;
    logPerformance('Full NLP analysis', duration);

    return {
      sentiment,
      toxicity,
      language,
      safe: !toxicity.isToxic,
      metadata: {
        textLength: text.length,
        processingTime: duration,
      },
    };
  } catch (error) {
    logger.warn('Real NLP models failed, falling back to mock service', { error: error.message });

    // Fallback to mock service
    try {
      const mockResult = await mockNlpService.analyzeText(text);
      const duration = Date.now() - startTime;

      logger.info('Mock NLP analysis completed', { duration: `${duration}ms` });

      return {
        ...mockResult,
        metadata: {
          textLength: text.length,
          processingTime: duration,
          usingMock: true,
        },
      };
    } catch (mockError) {
      logger.error('Both real and mock NLP analysis failed', {
        realError: error.message,
        mockError: mockError.message
      });
      throw new Error('NLP analysis unavailable');
    }
  }
}

/**
 * Get model status
 */
function getModelStatus() {
  return {
    ...modelStatus,
    memoryUsage: process.memoryUsage(),
  };
}

/**
 * Preload all models (optional warmup)
 */
async function preloadModels() {
  logger.info('Preloading NLP models...');
  
  try {
    await Promise.all([
      initSentimentModel(),
      initToxicityModel(),
    ]);
    
    logger.info('✅ All NLP models preloaded');
  } catch (error) {
    logger.error('Model preloading failed', { error: error.message });
  }
}

module.exports = {
  analyzeSentiment,
  analyzeToxicity,
  analyzeText,
  detectLanguage,
  getModelStatus,
  preloadModels,
};