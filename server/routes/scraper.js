const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const db = require('../middleware/db');

// Get scraper status page
router.get('/', isAuthenticated, async (req, res) => {
    try {
        // Get recent scraping results
        const scrapingResults = await db.manyOrNone(`
            SELECT * FROM scraping_results 
            ORDER BY timestamp DESC 
            LIMIT 20
        `);

        res.render('index', {
            user: { username: req.user },
            page: 'scraper',
            scrapingResults
        });
    } catch (error) {
        console.error('Error fetching scraper status:', error);
        res.status(500).json({ error: 'Failed to fetch scraper status' });
    }
});

module.exports = router; 