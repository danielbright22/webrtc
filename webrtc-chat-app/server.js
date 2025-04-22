const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));  // Serve HTML and frontend files from /public

let waitingUser = null;

// Helper function to emit current online users
function sendOnlineUsers() {
  const users = Array.from(io.sockets.sockets.keys());
  io.emit('userList', users);
}

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);
  sendOnlineUsers(); // Update user list for all clients

  // Matchmaking logic
  if (waitingUser) {
    const partner = waitingUser;
    waitingUser = null;

    socket.partner = partner;
    partner.partner = socket;

    socket.emit('matched', partner.id);
    partner.emit('matched', socket.id);
  } else {
    waitingUser = socket;
  }

  // Handle offer from client
  socket.on('offer', (data) => {
    if (socket.partner) {
      socket.partner.emit('offer', data);
    }
  });

  // Handle answer from client
  socket.on('answer', (data) => {
    if (socket.partner) {
      socket.partner.emit('answer', data);
    }
  });

  // Handle ICE candidate
  socket.on('candidate', (data) => {
    if (socket.partner) {
      socket.partner.emit('candidate', data);
    }
  });

  // Handle "Next" button logic
  socket.on('next', () => {
    if (socket.partner) {
      socket.partner.emit('disconnected');
      socket.partner.partner = null;
    }
    socket.partner = null;

    if (waitingUser === null) {
      waitingUser = socket;
    } else {
      const partner = waitingUser;
      waitingUser = null;

      socket.partner = partner;
      partner.partner = socket;

      socket.emit('matched', partner.id);
      partner.emit('matched', socket.id);
    }

    sendOnlineUsers(); // Update users list
  });

  // When user disconnects
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);

    if (socket.partner) {
      socket.partner.emit('disconnected');
      socket.partner.partner = null;
    }

    if (waitingUser === socket) {
      waitingUser = null;
    }

    sendOnlineUsers(); // Update users list
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
