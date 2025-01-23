const express = require('express');
const router = express.Router();

// Homepage Route
router.get('/', (req, res) => {
    const user = req.session.token ? req.session.username : undefined;
    res.render('index', { 
        user,
        page: user ? 'dashboard' : 'main',
        errors: []
    });
});

module.exports = router;