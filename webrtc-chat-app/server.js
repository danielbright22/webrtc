require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const geoip = require('geoip-lite');

const app = express();
const server = http.createServer(app);

// Render-specific configuration
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "https://your-render-app.onrender.com",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  }
});

// Security middleware
app.set('trust proxy', 1); // Required for Render's proxy
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP'
}));

// Ban system with expiration
const bannedIPs = new Map();
const activeReports = new Map();

// Enhanced user tracking
const onlineUsers = new Map(); // socket.id -> { ip, country, joinedAt }
let waitingUser = null;

io.use((socket, next) => {
  // Get real IP on Render
  const ip = socket.request.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             socket.handshake.address;
  
  // Check bans
  const ban = bannedIPs.get(ip);
  if (ban && ban.expiresAt > Date.now()) {
    socket.emit('banned', { 
      reason: ban.reason,
      expiresAt: ban.expiresAt
    });
    return socket.disconnect();
  }
  
  // Geo-location
  const geo = geoip.lookup(ip) || {};
  socket.userData = {
    ip,
    country: geo.country,
    userAgent: socket.handshake.headers['user-agent']
  };
  
  next();
});

io.on('connection', (socket) => {
  console.log('New connection:', socket.id, socket.userData.ip);
  
  // Track user
  onlineUsers.set(socket.id, {
    ...socket.userData,
    connectedAt: new Date()
  });
  updateOnlineCount();

  // Pairing system (original logic preserved)
  if (waitingUser && waitingUser.id !== socket.id) {
    const partner = waitingUser;
    waitingUser = null;

    socket.partner = partner;
    partner.partner = socket;

    socket.emit('matched', { 
      id: partner.id, 
      isInitiator: false,
      country: partner.userData.country 
    });
    partner.emit('matched', { 
      id: socket.id, 
      isInitiator: true,
      country: socket.userData.country 
    });
  } else {
    waitingUser = socket;
    socket.emit('waiting');
  }

  // WebRTC signaling (original)
  socket.on('offer', (data) => {
    if (socket.partner) socket.partner.emit('offer', data);
  });

  socket.on('answer', (data) => {
    if (socket.partner) socket.partner.emit('answer', data);
  });

  socket.on('candidate', (data) => {
    if (socket.partner) socket.partner.emit('candidate', data);
  });

  // Next button handler (enhanced)
  socket.on('next', () => {
    if (socket.partner) {
      socket.partner.emit('disconnected');
      cleanupPartner(socket.partner);
    }
    cleanupPartner(socket);

    if (!waitingUser || waitingUser.id === socket.id) {
      waitingUser = socket;
      socket.emit('waiting');
    } else {
      const partner = waitingUser;
      waitingUser = null;

      socket.partner = partner;
      partner.partner = socket;

      socket.emit('matched', { 
        id: partner.id, 
        isInitiator: true,
        country: partner.userData.country 
      });
      partner.emit('matched', { 
        id: socket.id, 
        isInitiator: false,
        country: socket.userData.country 
      });
    }
  });

  // Moderation system
  socket.on('report', ({ reason, evidence }) => {
    if (!socket.partner) return;
    
    const reporterIP = socket.userData.ip;
    const offenderIP = socket.partner.userData.ip;
    
    // 24-hour ban
    bannedIPs.set(offenderIP, {
      reason: `${reason} (reported by ${reporterIP})`,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      reporter: reporterIP
    });
    
    // Track repeat offenders
    const reportCount = activeReports.get(offenderIP) || 0;
    activeReports.set(offenderIP, reportCount + 1);
    
    // Notify users
    socket.partner.emit('banned', {
      reason: "You were reported. Reason: " + reason
    });
    
    socket.emit('reportResult', {
      success: true,
      message: "User reported and banned"
    });
    
    // Force disconnect
    socket.partner.disconnect();
    socket.emit('next');
  });

  // Cleanup on disconnect (enhanced)
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    users = users.filter(user => user !== socket.id);
  });
});

// Start the server on your local IP address
server.listen(3000, '192.168.88.248', () => {
  console.log('Server running on http://192.168.88.248:3000');
});
