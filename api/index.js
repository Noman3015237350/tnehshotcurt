const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Main TinyURL API endpoint
const TINYURL_API = 'https://tinyurl.com/api-create.php';

// Store for custom keys (in production, use a database)
const urlStore = new Map();

// Create short URL with custom key
app.get('/api/create-key', async (req, res) => {
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
    // Import fetch dynamically
    const fetch = (await import('node-fetch')).default;
    
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
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to create short URL: ' + error.message });
  }
});

// Check key exists
app.get('/api/check', (req, res) => {
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
app.get('/api/apikey', async (req, res) => {
  const { apikey, url } = req.query;
  
  if (!apikey || !url) {
    return res.status(400).json({ error: 'apikey and url parameters are required' });
  }
  
  // For demo, accept any apikey
  try {
    const fetch = (await import('node-fetch')).default;
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
app.get('/:key', (req, res) => {
  const { key } = req.params;
  const data = urlStore.get(key);
  
  if (data && data.originalUrl) {
    res.redirect(data.originalUrl);
  } else {
    res.status(404).send('Short URL not found');
  }
});

// Home page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 TNEH Shortcut URL API running on port ${PORT}`);
  console.log(`📡 API Endpoints:`);
  console.log(`   - GET /api/create-key?url=&key=`);
  console.log(`   - GET /api/check?key=`);
  console.log(`   - GET /api/apikey?apikey=&url=`);
  console.log(`   - GET /:key for redirect`);
});
