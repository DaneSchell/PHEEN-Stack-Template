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
                res.render('index', { 
                    user: undefined,
                    page: 'auth',
                    errors: [],
                    authMode: 'login'
                });
            } else {
                res.redirect('/dashboard');
            }
        });
    } else {
        res.render('index', { 
            user: undefined,
            page: 'auth',
            errors: [],
            authMode: 'login'
        });
    }
});
  
// Login Page Form Submit Route
router.post('/', loginValidationRules(), async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.render('index', { 
            user: undefined,
            page: 'auth',
            errors: errors.array(),
            authMode: 'login'
        });
    }

    const { username, password } = req.body;
    console.log('Login attempt for username:', username);

    try {
        // Retrieve the user from the database
        const user = await db.oneOrNone('SELECT * FROM users WHERE username = $1', [username]);
        console.log('Database query result:', user);

        if (!user) {
            console.log('User not found in database');
            // Handle case where user is not found
            return res.render('index', { 
                user: undefined,
                page: 'auth',
                errors: [{ msg: 'User not found' }],
                authMode: 'login'
            });
        }

        const match = await bcrypt.compare(password, user.password);
        console.log('Password match result:', match);

        if (match) {
            // Create a token
            const token = jwt.sign({ 
                username: user.username,
                role: user.role 
            }, process.env.JWT_SECRET, { expiresIn: '1h' });

            // Store the token and username in the session
            req.session.token = token;
            req.session.username = user.username;

            // Redirect to the dashboard
            res.redirect('/dashboard');
        } else {
            // Handle case where password is incorrect
            res.render('index', { 
                user: undefined,
                page: 'auth',
                errors: [{ msg: 'Invalid password' }],
                authMode: 'login'
            });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.render('index', { 
            user: undefined,
            page: 'auth',
            errors: [{ msg: 'Login failed' }],
            authMode: 'login'
        });
    }
});

module.exports = router;
