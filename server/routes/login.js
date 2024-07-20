const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../middleware/db');
const { validationResult } = require('express-validator');
const { loginValidationRules } = require('../middleware/validation');

// Login Page Route
router.get('/', (req, res) => {
    if (req.session.token) {
        jwt.verify(req.session.token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                res.render('login', { errors: [] });
            } else {
                res.redirect('/account');
            }
        });
    } else {
        res.render('login', { errors: [] });
    }
});
  
// Login Page Form Submit Route
router.post('/', loginValidationRules(), async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.render('login', { errors: errors.array() });
    }

    const { username, password } = req.body;

    try {
        // Retrieve the user from the database
        const user = await db.oneOrNone('SELECT username, password FROM users WHERE username = $1', username);

        if (!user) {
            // Handle case where user is not found
            return res.render('login', { errors: [{ msg: 'Invalid username or password' }] });
        }

        const match = await bcrypt.compare(password, user.password);

        if (match) {
            // Create a token
            const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });

            // Store the token and username in the session
            req.session.token = token;
            req.session.username = user.username;

            // Redirect to the account page
            res.redirect('/account');
        } else {
            // Handle case where password is incorrect
            res.render('login', { errors: [{ msg: 'Invalid username or password' }] });
        }
    } catch (error) {
        console.error('Error logging in:', error);
        res.render('login', { errors: [{ msg: 'Login failed' }] });
    }
});

module.exports = router;
