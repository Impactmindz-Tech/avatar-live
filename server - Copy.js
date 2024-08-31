const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Serve the Socket.io client file
app.get('/socket.io/socket.io.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'socket.io', 'client-dist', 'socket.io.js'));
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('A user connected');

  // Test event to check server-client communication
  socket.on('test', (message) => {
    console.log(`Received test message: ${message}`);
    socket.emit('test-reply', 'Server connection is working');
  });


  // lisiting create room 1
  socket.on('create', (roomId) => {
    console.log(`Room created with ID: ${roomId}`);
    rooms.set(roomId, socket.id);
    socket.join(roomId);
    socket.emit('created', roomId);
  });



  // join logic

  socket.on('join', (roomId) => {
    if (rooms.has(roomId)) {
      socket.join(roomId);
      socket.to(rooms.get(roomId)).emit('viewer', socket.id);
      socket.emit('joined', roomId);
    } else {
      socket.emit('full', roomId);
    }
  });





  
  socket.on('offer', (offer, roomId, viewerId) => {
    socket.to(viewerId).emit('offer', offer, socket.id);
  });

  socket.on('answer', (answer, roomId, broadcasterId) => {
    socket.to(broadcasterId).emit('answer', answer, socket.id);
  });

  socket.on('ice-candidate', (candidate, roomId, recipientId) => {
    socket.to(recipientId).emit('ice-candidate', candidate, socket.id);
  });

  socket.on('disconnect', () => {
    rooms.forEach((value, key) => {
      if (value === socket.id) {
        rooms.delete(key);
        io.to(key).emit('broadcaster-left');
      }
    });
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
