const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let waitingUser = null;
const onlineUsers = new Set();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  onlineUsers.add(socket.id);
  io.emit('update-users', Array.from(onlineUsers));

  if (waitingUser) {
    const partner = waitingUser;
    waitingUser = null;

    socket.partner = partner;
    partner.partner = socket;

    socket.emit('matched', { id: partner.id, isInitiator: true });
    partner.emit('matched', { id: socket.id, isInitiator: false });
  } else {
    waitingUser = socket;
  }

  socket.on('offer', (data) => {
    if (socket.partner) {
      socket.partner.emit('offer', data);
    }
  });

  socket.on('answer', (data) => {
    if (socket.partner) {
      socket.partner.emit('answer', data);
    }
  });

  socket.on('candidate', (data) => {
    if (socket.partner) {
      socket.partner.emit('candidate', data);
    }
  });

  socket.on('next', () => {
    if (socket.partner) {
      socket.partner.emit('disconnected');
      socket.partner.partner = null;
    }
    socket.partner = null;

    if (!waitingUser) {
      waitingUser = socket;
    } else {
      const partner = waitingUser;
      waitingUser = null;

      socket.partner = partner;
      partner.partner = socket;

      socket.emit('matched', { id: partner.id, isInitiator: true });
      partner.emit('matched', { id: socket.id, isInitiator: false });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    onlineUsers.delete(socket.id);
    io.emit('update-users', Array.from(onlineUsers));

    if (socket.partner) {
      socket.partner.emit('disconnected');
      socket.partner.partner = null;
    }

    if (waitingUser === socket) {
      waitingUser = null;
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
