const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Create an Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve the static files (HTML, JS) in the public directory
app.use(express.static('public'));

// Array to keep track of connected users
let users = [];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  users.push(socket.id);

  // Broadcast offer to the next user
  socket.on('offer', (offer) => {
    const recipient = users.find(user => user !== socket.id);
    if (recipient) {
      io.to(recipient).emit('offer', offer);
    }
  });

  // Send the answer back to the initiator
  socket.on('answer', (answer) => {
    const initiator = users.find(user => user !== socket.id);
    if (initiator) {
      io.to(initiator).emit('answer', answer);
    }
  });

  // Handle ICE candidates
  socket.on('candidate', (candidate) => {
    const recipient = users.find(user => user !== socket.id);
    if (recipient) {
      io.to(recipient).emit('candidate', candidate);
    }
  });

  // Handle next button for new connection
  socket.on('next', () => {
    console.log('User clicked Next. Finding a new partner...');
    const newUser = users.find(user => user !== socket.id);
    if (newUser) {
      io.to(newUser).emit('next');
    }
  });

  // Remove the user from the list when they disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    users = users.filter(user => user !== socket.id);
  });
});

// Start the server on your local IP address
server.listen(3000, '192.168.88.248', () => {
  console.log('Server running on http://192.168.88.248:3000');
});
