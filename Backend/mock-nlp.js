// Mock NLP service for testing when models fail to load
// This provides basic functionality without requiring model downloads

const mockNlpService = {
  analyzeText: async (text) => {
    console.log('🔄 Mock NLP: Analyzing text:', text.substring(0, 50) + '...');

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

// Export for testing
module.exports = mockNlpService;

// Quick test
if (require.main === module) {
  mockNlpService.analyzeText("This is a wonderful positive message!")
    .then(result => console.log('✅ Mock result:', JSON.stringify(result, null, 2)))
    .catch(err => console.error('❌ Mock error:', err));
}