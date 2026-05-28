const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// Main TinyURL API
const TINYURL_API = 'https://tinyurl.com/api-create.php';

// Store for custom keys (in production, use a database)
const urlStore = new Map();

// Create short URL with custom key
router.get('/create-key', async (req, res) => {
  const { url, key } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  if (!key) {
    return res.status(400).json({ error: 'Key parameter is required' });
  }
  
  // Check if key already exists
  if (urlStore.has(key)) {
    return res.status(409).json({ error: 'Key already exists' });
  }
  
  try {
    // Create short URL using TinyURL
    const tinyUrlResponse = await fetch(`${TINYURL_API}?url=${encodeURIComponent(url)}`);
    const shortUrl = await tinyUrlResponse.text();
    
    // Store mapping
    urlStore.set(key, { originalUrl: url, shortUrl, createdAt: new Date() });
    
    res.json({
      success: true,
      key,
      originalUrl: url,
      shortUrl,
      customUrl: `https://tnehshotcurt.onrender.com/${key}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create short URL' });
  }
});

// Check key exists
router.get('/check', async (req, res) => {
  const { key } = req.query;
  
  if (!key) {
    return res.status(400).json({ error: 'Key parameter is required' });
  }
  
  const exists = urlStore.has(key);
  const data = urlStore.get(key);
  
  res.json({
    exists,
    key,
    ...(data && { originalUrl: data.originalUrl, createdAt: data.createdAt })
  });
});

// Get URL by API key (simplified - no auth for demo)
router.get('/apikey', async (req, res) => {
  const { apikey, url } = req.query;
  
  if (!apikey || !url) {
    return res.status(400).json({ error: 'apikey and url parameters are required' });
  }
  
  // For demo, accept any apikey
  try {
    const tinyUrlResponse = await fetch(`${TINYURL_API}?url=${encodeURIComponent(url)}`);
    const shortUrl = await tinyUrlResponse.text();
    
    res.json({
      success: true,
      originalUrl: url,
      shortUrl,
      apikey
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create short URL' });
  }
});

// Redirect endpoint
router.get('/:key', (req, res) => {
  const { key } = req.params;
  const data = urlStore.get(key);
  
  if (data && data.originalUrl) {
    res.redirect(data.originalUrl);
  } else {
    res.status(404).send('Short URL not found');
  }
});

module.exports = router;
