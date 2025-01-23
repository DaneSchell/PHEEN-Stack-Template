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
const adminRoute = require('./routes/admin');
const scraperRoute = require('./routes/scraper');
const { router: chatRouter, initSocketHandlers } = require('./routes/chat');

// Initialize
const app = express();
const server = createServer(app);
const io = setupSocketIO(server);

// Expose io globally
global.io = io;

// Initialize Services
const scraper = require('./services/scraper');
scraper.io = io; // Pass socket.io instance to scraper

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

// Static Files
app.use('/js', express.static(path.join(__dirname, '../client/js')));
app.use('/views', express.static(path.join(__dirname, '../client/views')));
app.use('/uploads', express.static(path.join(__dirname, '../client/uploads')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../client/uploads');
if (!require('fs').existsSync(uploadsDir)) {
    require('fs').mkdirSync(uploadsDir, { recursive: true });
}

// Views
app.set('views', path.join(__dirname, '../client/views'));
app.set('view engine', 'ejs');

// Use Routes
app.use('/', indexRoute);
app.use('/register', registerRoute);
app.use('/login', loginRoute);
app.use('/account', accountRoute);
app.use('/dashboard', dashboardRoute);
app.use('/admin', adminRoute);
app.use('/scraper', scraperRoute);
app.use('/chat', chatRouter);
app.use('/uploads', express.static('uploads'));

// Start news scraping service
const SCRAPE_INTERVAL = process.env.SCRAPE_INTERVAL || 1800000; // Default to 30 minutes

// Function to run scraping cycle
async function runScrapingCycle() {
    try {
        console.log('Starting news scraping cycle...');
        await scraper.scrapeAndAnalyze();
        await scraper.generateInsights();
        console.log('News scraping and analysis completed');
    } catch (error) {
        console.error('Error in news scraping cycle:', error);
    }
}

// Run initial scrape after a short delay to ensure database connection is ready
setTimeout(() => {
    runScrapingCycle().catch(error => {
        console.error('Error in initial news scraping:', error);
    });
}, 5000);

// Set up periodic scraping
setInterval(runScrapingCycle, SCRAPE_INTERVAL);

// Start Server
const PORT = process.env.PORT || 9000;
server.listen(PORT, () => {
    console.log(`\nView the web app @ http://localhost:${PORT}/`);
    console.log('DATABASE: Running on port 5432.');
});

// Initialize socket handlers
initSocketHandlers(io);