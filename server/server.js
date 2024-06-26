require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const pgp = require('pg-promise')(/* options */);
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const RateLimiterFlexible = require('rate-limiter-flexible');
// Socket IO
const { createServer } = require('http');
const { Server } = require('socket.io');

const db = pgp(`postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`);
const PORT = process.env.PORT;
const IO_PORT = process.env.IO_PORT;
const app  = express();
// Socket IO
const server = createServer(app);
const io = new Server(server);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());

app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using https
}));

// Rate Limiter
const opts = {
  points: 100, // Number of points
  duration: 60, // Per second
  blockDuration: 60 * 60 // Block for 1 day, if exceeding points
};
const rateLimiter = new RateLimiterFlexible.RateLimiterMemory(opts);
app.use((req, res, next) => {
  rateLimiter.consume(req.ip)
    .then(() => {
      next();
    })
    .catch(() => {
      res.status(429).send('Too Many Requests');
    });
});

app.use(express.static(path.join(__dirname, '../client/public')));

app.set('views', path.join(__dirname, '../client/views'));
app.set('view engine', 'ejs');

// Database Check
db.one('SELECT $1 AS value', "Running on port 5432.")
  .then((data) => {
    console.log('DATABASE:', data.value)
  })
  .catch((error) => {
    console.log('ERROR:', error)
  })

// Homepage Route
app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

// Register Page Route
app.get('/register', (req, res) => {
  if (req.session.token) {
    // Verify the token
    jwt.verify(req.session.token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        // If there's an error (e.g., token expired), show the register page
        res.render('register');
      } else {
        // If the token is valid, redirect to the account page
        res.redirect('/account');
      }
    });
  } else {
    // If there's no token, show the register page
    res.render('register');
  }
});

// Register Page Form Submit Route
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // Check if password is defined
  if (typeof password === 'undefined') {
    console.error('Password is undefined.');
    return res.send('Registration failed: No password provided.');
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
  
    // Store the username and hashedPassword in your database
    await db.none('INSERT INTO users(username, password) VALUES($1, $2)', [username, hashedPassword]);
    // After storing the user, redirect to the login page
    res.redirect('/login');
  } catch (error) {
    console.error('Error registering new user:', error);
    res.redirect('/register?error=Registration%20failed');
  }
});
  
// Login Page Route
app.get('/login', (req, res) => {
  if (req.session.token) {
    // Verify the token
    jwt.verify(req.session.token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        // If there's an error (e.g., token expired), show the login page
        res.render('login');
      } else {
        // If the token is valid, redirect to the account page
        res.redirect('/account');
      }
    });
  } else {
    // If there's no token, show the login page
    res.render('login');
  }
});

// Login Page Form Submit Route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Retrieve the user from the database
    const user = await db.one('SELECT username, password FROM users WHERE username = $1', username);
    const match = await bcrypt.compare(password, user.password);

    if (match) {
      // Create a token
      const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });

      // Store the token and username in the session
      req.session.token = token;
      req.session.username = user.username; // Store username in the session

      // Redirect to the account page
      res.redirect('/account');
    } else {
      res.redirect('/login?error=Login%20failed');
    }
  } catch (error) {
    console.error('Error logging in:', error);
    res.redirect('/login?error=Login%20failed');
  }
});

// Account Page Route
app.get('/account', (req, res) => {
  if (req.session.token) {
    // Verify the token
    jwt.verify(req.session.token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        // Handle token expiration or invalid token
        res.redirect('/login');
      } else {
        // Render the account page with the user's name
        res.render('account', { user: decoded.username });
      }
    });
  } else {
    // Redirect to login if not authenticated
    res.redirect('/login');
  }
});

// Logout Route
app.post('/logout', (req, res) => {
  const username = req.session.username; // Retrieve username from the session
  req.session.destroy(err => {
    if (err) {
      console.error('Error during logout:', err);
      return res.send('Logout failed');
    }
    io.emit('user disconnected', username);
    res.redirect('/');
  });
});

// Check if user is Authenticated
function isAuthenticated(req, res, next) {
  if (req.session.token) {
    jwt.verify(req.session.token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        res.redirect('/login');
      } else {
        // Add the decoded username to the request object
        req.user = decoded.username;
        next();
      }
    });
  } else {
    res.redirect('/login');
  }
};

// Update Username Route
app.post('/update-username', isAuthenticated, async (req, res) => {
  const { newUsername } = req.body;
  try {
    await db.none('UPDATE users SET username = $1 WHERE username = $2', [newUsername, req.user]);
    // Update the username in the session token
    const token = jwt.sign({ username: newUsername }, process.env.JWT_SECRET, { expiresIn: '1h' });
    req.session.token = token;
    res.redirect('/account');
  } catch (error) {
    console.error('Error updating username:', error);
    res.send('Failed to update username');
  }
});
  
// Update Password Route
app.post('/update-password', isAuthenticated, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await db.oneOrNone('SELECT password FROM users WHERE username = $1', req.user);
    const match = await bcrypt.compare(currentPassword, user.password);
    if (match) {
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await db.none('UPDATE users SET password = $1 WHERE username = $2', [hashedNewPassword, req.user]);
      res.redirect('/account');
    } else {
      res.send('Current password is incorrect');
    }
  } catch (error) {
    console.error('Error updating password:', error);
    res.send('Failed to update password');
  }
});  

// Account Deletion Route
app.post('/delete-account', isAuthenticated, async (req, res) => {
  try {
    await db.none('DELETE FROM users WHERE username = $1', req.user);
    req.session.destroy(() => {
      res.redirect('/login');
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.send('Failed to delete account');
  }
});

// Dashboard Page Route
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.render('dashboard', { user: req.user });
});

// Socket IO Chat
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

// Older Messages Route
app.get('/older-messages', isAuthenticated, async (req, res) => {
  const oldestMessageId = req.query.oldestMessageId;

  try {
    let query = 'SELECT id, username, message FROM messages';
    const params = [];

    if (oldestMessageId && !isNaN(parseInt(oldestMessageId))) {
      query += ' WHERE id < $1';
      params.push(parseInt(oldestMessageId));
    }

    query += ' ORDER BY id DESC LIMIT 25';

    const olderMessages = await db.any(query, params);
    res.json(olderMessages.reverse());
  } catch (error) {
    console.error('Error fetching older messages:', error);
    res.status(500).json({ error: 'Failed to fetch older messages' });
  }
});

// Server Accepting Connections
server.listen(PORT, async () => {
  console.log(`SOCKETIO: Running on port ${IO_PORT}.`);
  console.log(`SERVER: Running on port ${PORT}.`);
});