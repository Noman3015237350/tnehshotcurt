const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory storage
const urlDatabase = new Map();
const apiKeyDatabase = new Map();

// Helper function to validate URL
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// Helper function to validate API Key
function isValidApiKey(apiKey) {
  return apiKeyDatabase.has(apiKey);
}

// ==================== API ENDPOINTS ====================

/**
 * Endpoint 1: Create API Key
 * GET /api/create-key
 */
app.get('/api/create-key', (req, res) => {
  const newApiKey = nanoid(32);
  apiKeyDatabase.set(newApiKey, {
    createdAt: new Date(),
    requests: 0,
    isActive: true
  });
  
  res.json({
    success: true,
    message: 'API key created successfully',
    api_key: newApiKey,
    note: 'Save this key. Use it with /api/apikey=&url= endpoint'
  });
});

/**
 * Endpoint 2: Create Short URL with API Key
 * GET /api/apikey=&url=
 * Example: /api/apikey?apikey=YOUR_API_KEY&url=https://google.com
 */
app.get('/api/apikey', (req, res) => {
  const apiKey = req.query.apikey;
  const originalUrl = req.query.url;
  
  // Validate API Key
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key is required. Use /api/create-key to get one.'
    });
  }
  
  if (!isValidApiKey(apiKey)) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key. Please get a valid key from /api/create-key'
    });
  }
  
  // Validate URL
  if (!originalUrl) {
    return res.status(400).json({
      success: false,
      error: 'URL parameter is required. Usage: /api/apikey?apikey=YOUR_KEY&url=YOUR_URL'
    });
  }
  
  if (!isValidUrl(originalUrl)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid URL format. Please include http:// or https://'
    });
  }
  
  // Generate short key (6 characters)
  const shortKey = nanoid(6);
  const shortUrl = `${req.protocol}://${req.get('host')}/api/${shortKey}`;
  
  // Store in database
  urlDatabase.set(shortKey, {
    originalUrl: originalUrl,
    createdAt: new Date(),
    clicks: 0,
    apiKey: apiKey
  });
  
  // Update API key request count
  const apiKeyData = apiKeyDatabase.get(apiKey);
  apiKeyData.requests += 1;
  apiKeyDatabase.set(apiKey, apiKeyData);
  
  res.json({
    success: true,
    original_url: originalUrl,
    short_url: shortUrl,
    short_key: shortKey,
    message: 'URL shortened successfully'
  });
});

/**
 * Endpoint 3: Check URL Stats by Key
 * GET /api/check=&key=
 * Example: /api/check?key=abc123
 */
app.get('/api/check', (req, res) => {
  const shortKey = req.query.key;
  
  if (!shortKey) {
    return res.status(400).json({
      success: false,
      error: 'Key parameter is required. Usage: /api/check?key=YOUR_SHORT_KEY'
    });
  }
  
  const urlData = urlDatabase.get(shortKey);
  
  if (!urlData) {
    return res.status(404).json({
      success: false,
      error: 'Short URL key not found'
    });
  }
  
  res.json({
    success: true,
    original_url: urlData.originalUrl,
    created_at: urlData.createdAt,
    total_clicks: urlData.clicks,
    short_key: shortKey
  });
});

/**
 * Redirect endpoint: Visit short URL
 * GET /api/:shortKey
 */
app.get('/api/:shortKey', (req, res) => {
  const shortKey = req.params.shortKey;
  const urlData = urlDatabase.get(shortKey);
  
  if (!urlData) {
    return res.status(404).json({
      success: false,
      error: 'Short URL not found'
    });
  }
  
  // Increment click count
  urlData.clicks += 1;
  urlDatabase.set(shortKey, urlData);
  
  // Redirect to original URL
  res.redirect(urlData.originalUrl);
});

/**
 * Root endpoint - API Information
 */
app.get('/', (req, res) => {
  res.json({
    name: 'TNEH Shortcut URL API',
    version: '1.0.0',
    description: 'A simple URL shortener service',
    endpoints: {
      create_api_key: {
        method: 'GET',
        url: '/api/create-key',
        description: 'Get a new API key for authentication'
      },
      create_short_url: {
        method: 'GET',
        url: '/api/apikey?apikey=YOUR_KEY&url=YOUR_URL',
        example: '/api/apikey?apikey=abc123&url=https://google.com',
        description: 'Create a shortened URL using your API key'
      },
      check_url_stats: {
        method: 'GET',
        url: '/api/check?key=YOUR_SHORT_KEY',
        example: '/api/check?key=abc123',
        description: 'Get statistics for a shortened URL'
      },
      redirect: {
        method: 'GET',
        url: '/api/:shortKey',
        description: 'Redirect to the original URL'
      }
    },
    status: 'active',
    documentation: 'Use /api/create-key to start'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found. Check / for available endpoints'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 TNEH Shortcut URL API is running on port ${PORT}`);
  console.log(`📝 Available endpoints:`);
  console.log(`   GET /api/create-key`);
  console.log(`   GET /api/apikey?apikey=YOUR_KEY&url=YOUR_URL`);
  console.log(`   GET /api/check?key=YOUR_SHORT_KEY`);
  console.log(`   GET /api/:shortKey`);
});

module.exports = app;
