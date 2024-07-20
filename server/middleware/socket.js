const { body, validationResult } = require('express-validator');
const { Server } = require('socket.io');
const db = require('./db');

function setupSocketIO(server) {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:9000", // Adjust as needed
      methods: ["GET", "POST"]
    }
  });

  // Socket.IO Chat
  io.on('connection', (socket) => {
    console.log('a user connected');

    // Emit a limited number of previous messages to the newly connected user
    db.many('SELECT username, message FROM messages ORDER BY timestamp DESC LIMIT 50') // Adjust the LIMIT based on your preference
      .then(messages => {
        socket.emit('previous messages', messages.reverse()); // Reverse to show oldest messages first
      })
      .catch(error => {
        console.error('Error fetching previous messages:', error);
    });

    socket.on('user connected', (username) => {
      socket.username = username;
      io.emit('user connected', username);
    });

    socket.on('chat message', (msg) => {
      // Validate message on the server side
      if (typeof msg.username !== 'string' || typeof msg.message !== 'string' ||
          msg.message.length === 0 || msg.message.length > 500) {
        console.error('Invalid message:', msg);
        return;
      }

      io.emit('chat message', msg);

      // Save the message to the database
      db.none('INSERT INTO messages(username, message) VALUES($1, $2)', [msg.username, msg.message])
        .catch(error => {
          console.error('Error saving message:', error);
        });
    });

    socket.on('disconnect', () => {
      if (socket.username) {
        console.log(`${socket.username} disconnected`); // Log the username disconnecting
        socket.broadcast.emit('user disconnected', socket.username);
      } else {
        console.log('user disconnected'); // Fallback log if username is not set
      }
    });
  });

  return io;
}

module.exports = setupSocketIO;
