const pgp = require('pg-promise')(/* options */);

// Set up the database connection
const db = pgp(`postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`);

// Export the database instance
module.exports = db;