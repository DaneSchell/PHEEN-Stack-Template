const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../middleware/db');
const { validationResult } = require('express-validator');
const { registrationValidationRules } = require('../middleware/validation');

// Register Page Route
router.get('/', (req, res) => {
    if (req.session.token) {
        jwt.verify(req.session.token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                res.render('index', { 
                    user: undefined,
                    page: 'auth',
                    errors: [],
                    authMode: 'register'
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
            authMode: 'register'
        });
    }
});

// Register Page Form Submit Route
router.post('/', registrationValidationRules(), async (req, res) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        return res.render('index', { 
            user: undefined,
            page: 'auth',
            errors: errors.array(),
            authMode: 'register'
        });
    }

    const { username, email, password, confirmPassword } = req.body;

    // Check if passwords match
    if (password !== confirmPassword) {
        return res.render('index', { 
            user: undefined,
            page: 'auth',
            errors: [{ msg: 'Passwords do not match' }],
            authMode: 'register'
        });
    }

    try {
        // Check if username already exists
        const existingUser = await db.oneOrNone('SELECT username FROM users WHERE username = $1', [username]);
        if (existingUser) {
            return res.render('index', { 
                user: undefined,
                page: 'auth',
                errors: [{ msg: 'Username already exists' }],
                authMode: 'register'
            });
        }

        // Check if email already exists
        const existingEmail = await db.oneOrNone('SELECT email FROM users WHERE email = $1', [email]);
        if (existingEmail) {
            return res.render('index', { 
                user: undefined,
                page: 'auth',
                errors: [{ msg: 'Email already registered' }],
                authMode: 'register'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Store user with email
        await db.none('INSERT INTO users(username, email, password) VALUES($1, $2, $3)', 
            [username, email, hashedPassword]
        );

        // After storing the user, redirect to login page
        res.redirect('/login');
    } catch (error) {
        console.error('Error registering new user:', error);
        res.render('index', {
            user: undefined,
            page: 'auth',
            errors: [{ msg: 'Registration failed. Please try again.' }],
            authMode: 'register'
        });
    }
});

module.exports = router;
