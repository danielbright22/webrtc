const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));  // serve your HTML from "public" folder

let waitingUser = null;

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  if (waitingUser) {
    // Pair users
    const partner = waitingUser;
    waitingUser = null;

    socket.partner = partner;
    partner.partner = socket;

    socket.emit('matched', partner.id);
    partner.emit('matched', socket.id);
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
  });

  socket.on('disconnect', () => {
    if (socket.partner) {
      socket.partner.emit('disconnected');
      socket.partner.partner = null;
    }
    if (waitingUser === socket) {
      waitingUser = null;
    }
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
