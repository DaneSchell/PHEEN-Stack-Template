const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const db = require('../middleware/db');

// Temporary route to generate hash
router.get('/generate-hash', async (req, res) => {
    const password = 'Admin123!';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    console.log('Generated hash for Admin123!:', hash);
    res.send('Hash generated - check console');
});

// Login route
router.post('/login', [
    check('username').trim().notEmpty(),
    check('password').trim().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.render('index', { 
                user: undefined, 
                page: 'auth', 
                errors: errors.array(),
                authMode: 'login' 
            });
        }

        const { username, password } = req.body;
        console.log('Login attempt for:', username);

        // Query the database for the user
        const user = await db.oneOrNone('SELECT * FROM users WHERE username = $1', [username]);
        console.log('Database query result:', user ? 'User found' : 'User not found');

        if (!user) {
            console.log('User not found in database');
            return res.render('index', {
                user: undefined,
                page: 'auth',
                errors: [{ msg: 'User not found' }],
                authMode: 'login'
            });
        }

        // Compare passwords
        const match = await bcrypt.compare(password, user.password);
        console.log('Password match result:', match);

        if (!match) {
            console.log('Password does not match');
            return res.render('index', {
                user: undefined,
                page: 'auth',
                errors: [{ msg: 'Invalid credentials' }],
                authMode: 'login'
            });
        }

        // Create JWT token
        const token = jwt.sign(
            { 
                id: user.id,
                username: user.username,
                role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Set cookie and redirect
        res.cookie('token', token, { httpOnly: true });
        console.log('Login successful, redirecting to dashboard');
        res.redirect('/dashboard');

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

// Register route
router.post('/register', [
    check('username').trim().notEmpty(),
    check('email').trim().isEmail(),
    check('password').trim().isLength({ min: 6 }),
    check('confirmPassword').trim().custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error('Passwords do not match');
        }
        return true;
    })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('index', {
                user: undefined,
                page: 'auth',
                errors: errors.array(),
                authMode: 'register'
            });
        }

        const { username, email, password } = req.body;

        // Check if username or email already exists
        const existingUser = await db.oneOrNone('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (existingUser) {
            return res.render('index', {
                user: undefined,
                page: 'auth',
                errors: [{ msg: 'Username or email already exists' }],
                authMode: 'register'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert new user
        const newUser = await db.one(
            'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *',
            [username, email, hashedPassword, 'user']
        );

        // Create JWT token
        const token = jwt.sign(
            { 
                id: newUser.id,
                username: newUser.username,
                role: newUser.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Set cookie and redirect
        res.cookie('token', token, { httpOnly: true });
        res.redirect('/dashboard');

    } catch (error) {
        console.error('Registration error:', error);
        res.render('index', {
            user: undefined,
            page: 'auth',
            errors: [{ msg: 'Registration failed' }],
            authMode: 'register'
        });
    }
});

// Logout route
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

module.exports = router; 