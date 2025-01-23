const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const db = require('../middleware/db');
const scraper = require('../services/scraper');

// Helper function to check if user is admin
async function isAdmin(username) {
    const user = await db.oneOrNone('SELECT role FROM users WHERE username = $1', username);
    return user && user.role === 'admin';
}

// Admin middleware
async function requireAdmin(req, res, next) {
    if (!await isAdmin(req.user)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// Get analytics dashboard
router.get('/analytics', isAuthenticated, requireAdmin, async (req, res) => {
    try {
        // Get cached insights
        const cachedInsights = await db.oneOrNone(`
            SELECT data FROM analytics_cache 
            WHERE analysis_type = 'daily_insights' 
            AND valid_until > NOW()
            ORDER BY created_at DESC 
            LIMIT 1
        `);

        // Get entity statistics
        const entityStats = await db.manyOrNone(`
            SELECT 
                entity_type,
                COUNT(*) as mention_count,
                COUNT(DISTINCT article_id) as article_count,
                array_agg(DISTINCT entity_name) as unique_entities
            FROM entity_mentions
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY entity_type
        `);

        // Get sentiment trends
        const sentimentTrends = await db.manyOrNone(`
            SELECT 
                date_trunc('hour', created_at) as hour,
                AVG(sentiment_score) as avg_sentiment,
                COUNT(*) as article_count
            FROM news_articles
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY date_trunc('hour', created_at)
            ORDER BY hour
        `);

        res.render('index', {
            user: { username: req.user, role: 'admin' },
            page: 'admin/analytics',
            insights: cachedInsights?.data || null,
            entityStats,
            sentimentTrends
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Get search terms
router.get('/search-terms', isAuthenticated, requireAdmin, async (req, res) => {
    try {
        const searchTerms = await db.manyOrNone('SELECT * FROM search_terms ORDER BY created_at DESC');
        res.render('index', {
            user: { username: req.user, role: 'admin' },
            page: 'admin/search-terms',
            searchTerms
        });
    } catch (error) {
        console.error('Error fetching search terms:', error);
        res.status(500).json({ error: 'Failed to fetch search terms' });
    }
});

// Add search term
router.post('/search-terms', isAuthenticated, requireAdmin, async (req, res) => {
    try {
        const { term, category } = req.body;
        const userId = await db.one('SELECT id FROM users WHERE username = $1', req.user);
        
        await db.none(
            'INSERT INTO search_terms (term, category, created_by) VALUES ($1, $2, $3)',
            [term, category, userId.id]
        );
        
        res.redirect('/admin/search-terms');
    } catch (error) {
        console.error('Error adding search term:', error);
        res.status(500).json({ error: 'Failed to add search term' });
    }
});

// Toggle search term
router.post('/search-terms/:id/toggle', isAuthenticated, requireAdmin, async (req, res) => {
    try {
        await db.none(
            'UPDATE search_terms SET is_active = NOT is_active WHERE id = $1',
            [req.params.id]
        );
        res.redirect('/admin/search-terms');
    } catch (error) {
        console.error('Error toggling search term:', error);
        res.status(500).json({ error: 'Failed to toggle search term' });
    }
});

// Delete search term
router.post('/search-terms/:id/delete', isAuthenticated, requireAdmin, async (req, res) => {
    try {
        await db.none('DELETE FROM search_terms WHERE id = $1', [req.params.id]);
        res.redirect('/admin/search-terms');
    } catch (error) {
        console.error('Error deleting search term:', error);
        res.status(500).json({ error: 'Failed to delete search term' });
    }
});

// Force refresh analytics
router.post('/analytics/refresh', isAuthenticated, requireAdmin, async (req, res) => {
    try {
        await scraper.generateInsights();
        res.redirect('/admin/analytics');
    } catch (error) {
        console.error('Error refreshing analytics:', error);
        res.status(500).json({ error: 'Failed to refresh analytics' });
    }
});

module.exports = router; 