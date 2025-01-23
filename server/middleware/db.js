const pgp = require('pg-promise')();

// Database connection string
const connection = {
    host: process.env.DB_HOST || 'db',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_DATABASE || 'mydatabase',
    user: process.env.DB_USER || 'myuser',
    password: process.env.DB_PASSWORD || 'mypassword'
};

console.log('Attempting to connect to database with:', {
    ...connection,
    password: '[REDACTED]'
});

// Create the database instance
const db = pgp(connection);

// Function to test connection with retries
const connectWithRetry = async (retries = 5, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const obj = await db.connect();
            console.log('Database connection successful');
            obj.done(); // success, release the connection
            return true;
        } catch (error) {
            console.error(`Connection attempt ${i + 1} failed:`, error.message || error);
            if (i < retries - 1) {
                console.log(`Retrying in ${delay/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw new Error('Failed to connect to database after multiple attempts');
};

// Initialize connection
connectWithRetry()
    .catch(error => {
        console.error('ERROR:', error.message || error);
        process.exit(1); // Exit if we can't connect to the database
    });

module.exports = db;