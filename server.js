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

  // Create room
  socket.on('create', (roomId) => {
    console.log(`Room created with ID: ${roomId}`);
    rooms.set(roomId, { broadcaster: socket.id, viewers: [] });
    socket.join(roomId);
    socket.emit('created', roomId);
  });

  // Join room
  socket.on('join', (roomId) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      if (room.broadcaster) {
        socket.join(roomId);
        room.viewers.push(socket.id);
        socket.to(room.broadcaster).emit('viewer', socket.id);
        socket.emit('joined', roomId);
      } else {
        socket.emit('full', roomId);
      }
    } else {
      socket.emit('full', roomId);
    }
  });

  // Handle offer
  socket.on('offer', (offer, roomId, viewerId) => {
    socket.to(viewerId).emit('offer', offer, socket.id);
  });

  // Handle answer
  socket.on('answer', (answer, roomId, broadcasterId) => {
    socket.to(broadcasterId).emit('answer', answer, socket.id);
  });

  // Handle ICE candidate
  socket.on('ice-candidate', (candidate, roomId, recipientId) => {
    socket.to(recipientId).emit('ice-candidate', candidate, socket.id);
  });

  // Stop stream
  socket.on('stop', (roomId) => {
    if (rooms.has(roomId) && rooms.get(roomId).broadcaster === socket.id) {
      io.to(roomId).emit('stop');
      rooms.delete(roomId); // Remove the room
    }
  });

  // Exit room
  socket.on('exit', (roomId) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      if (room.broadcaster === socket.id) {
        io.to(roomId).emit('broadcaster-left');
        rooms.delete(roomId); // Remove the room
      } else {
        const index = room.viewers.indexOf(socket.id);
        if (index > -1) {
          room.viewers.splice(index, 1);
        }
        socket.leave(roomId);
        socket.to(roomId).emit('exit');
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      if (room.broadcaster === socket.id) {
        io.to(roomId).emit('broadcaster-left');
        rooms.delete(roomId); // Remove the room
      } else {
        const index = room.viewers.indexOf(socket.id);
        if (index > -1) {
          room.viewers.splice(index, 1);
        }
        if (room.viewers.length === 0 && room.broadcaster === null) {
          rooms.delete(roomId); // Remove room if empty
        }
      }
    });
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
