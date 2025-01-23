const { body, validationResult } = require('express-validator');
const { Server } = require('socket.io');
const db = require('./db');

function setupSocketIO(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:9000",
      methods: ["GET", "POST"]
    }
  });

  // Socket.IO Chat
  io.on('connection', (socket) => {
    console.log('a user connected');

    // Emit a limited number of previous messages to the newly connected user
    db.many('SELECT id, username, message FROM messages ORDER BY timestamp DESC LIMIT 50')
      .then(messages => {
        socket.emit('previous messages', messages.reverse());
      })
      .catch(error => {
        console.error('Error fetching previous messages:', error);
    });

    socket.on('user connected', (username) => {
      socket.username = username;
      io.emit('user connected', username);
    });

    socket.on('chat message', async (msg) => {
      // Validate message on the server side
      if (typeof msg.username !== 'string' || typeof msg.message !== 'string' ||
          msg.message.length === 0 || msg.message.length > 500) {
        console.error('Invalid message:', msg);
        return;
      }

      try {
        // Save the message to the database and get the ID
        const result = await db.one(
          'INSERT INTO messages(username, message) VALUES($1, $2) RETURNING id',
          [msg.username, msg.message]
        );

        // Emit the message with its ID
        io.emit('chat message', {
          id: result.id,
          username: msg.username,
          message: msg.message
        });
      } catch (error) {
        console.error('Error saving message:', error);
      }
    });

    socket.on('disconnect', () => {
      if (socket.username) {
        console.log(`${socket.username} disconnected`);
        io.emit('user disconnected', socket.username);
      }
    });
  });

  return io;
}

module.exports = setupSocketIO;
