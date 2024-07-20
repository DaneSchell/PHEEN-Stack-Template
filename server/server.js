// Main Requirements
require('dotenv').config();
const express = require('express');

// Require Auxiliaries
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Require Middleware
const { sessionConfig } = require('./middleware/auth');
const db = require('./middleware/db');
const rateLimiterMiddleware = require('./middleware/limiter');
const setupSocketIO = require('./middleware/socket');

// Require Routes
const indexRoute = require('./routes/index');
const registerRoute = require('./routes/register');
const loginRoute = require('./routes/login');
const accountRoute = require('./routes/account');
const dashboardRoute = require('./routes/dashboard');

// Initialize
const app = express();
const server = createServer(app);
const io = setupSocketIO(server);

// Expose io globally
global.io = io;

// Use Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet({
  hsts: false, // Disable HSTS for development
  contentSecurityPolicy: false, // Optionally disable Content Security Policy for development
}));
app.use(sessionConfig);
app.use(rateLimiterMiddleware);
app.use(express.static(path.join(__dirname, '../client/public')));

// Views
app.set('views', path.join(__dirname, '../client/views'));
app.set('view engine', 'ejs');

// Use Routes
app.use('/', indexRoute);
app.use('/register', registerRoute);
app.use('/login', loginRoute);
app.use('/account', accountRoute);
app.use('/dashboard', dashboardRoute);

const PORT = process.env.PORT;

// Database Check
db.one('SELECT $1 AS value', "Running on port 5432.")
  .then((data) => {
    console.log('DATABASE:', data.value)
  })
  .catch((error) => {
    console.log('ERROR:', error)
  });

// Server Accepting Connections
server.listen(PORT, async () => {
  console.log(`View the web app @ http://localhost:${PORT}/`);
});