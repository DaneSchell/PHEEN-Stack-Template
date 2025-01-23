const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { isAuthenticated } = require('../middleware/auth');
const db = require('../middleware/db');
const { validationResult } = require('express-validator');
const { updateUsernameValidationRules, updatePasswordValidationRules, updateEmailValidationRules } = require('../middleware/validation');

// Helper function to check if user is admin
async function isAdmin(username) {
    const user = await db.oneOrNone('SELECT role FROM users WHERE username = $1', username);
    return user && user.role === 'admin';
}

// Account Page Route
router.get('/', isAuthenticated, async (req, res) => {
    if (req.session.token) {
        jwt.verify(req.session.token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                res.redirect('/login');
            } else {
                const user = await db.oneOrNone('SELECT username, role, email FROM users WHERE username = $1', decoded.username);
                res.render('index', { 
                    user: user, 
                    page: 'account',
                    errors: [] 
                });
            }
        });
    } else {
        res.redirect('/login');
    }
});

// Update Username Route with Validation (Admin only)
router.post('/update-username', isAuthenticated, updateUsernameValidationRules(), async (req, res) => {
    if (!await isAdmin(req.user)) {
        return res.render('index', { 
            user: { username: req.user }, 
            page: 'account',
            errors: [{ msg: 'Unauthorized: Admin access required' }] 
        });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('index', { 
            user: { username: req.user }, 
            page: 'account',
            errors: errors.array() 
        });
    }

    const { newUsername } = req.body;

    try {
        await db.none('UPDATE users SET username = $1 WHERE username = $2', [newUsername, req.user]);
        const token = jwt.sign({ username: newUsername }, process.env.JWT_SECRET, { expiresIn: '1h' });
        req.session.token = token;
        res.redirect('/account');
    } catch (error) {
        console.error('Error updating username:', error);
        res.render('index', { 
            user: { username: req.user }, 
            page: 'account',
            errors: [{ msg: 'Failed to update username' }] 
        });
    }
});

// Update Email Route with Validation
router.post('/update-email', isAuthenticated, updateEmailValidationRules(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('index', { 
            user: { username: req.user }, 
            page: 'account',
            errors: errors.array() 
        });
    }

    const { newEmail } = req.body;

    try {
        await db.none('UPDATE users SET email = $1 WHERE username = $2', [newEmail, req.user]);
        res.redirect('/account');
    } catch (error) {
        console.error('Error updating email:', error);
        res.render('index', { 
            user: { username: req.user }, 
            page: 'account',
            errors: [{ msg: 'Failed to update email' }] 
        });
    }
});

// Update Password Route with Validation
router.post('/update-password', isAuthenticated, updatePasswordValidationRules(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('index', { 
            user: { username: req.user }, 
            page: 'account',
            errors: errors.array() 
        });
    }

    const { currentPassword, newPassword } = req.body;

    try {
        const user = await db.oneOrNone('SELECT password FROM users WHERE username = $1', req.user);
        const match = await bcrypt.compare(currentPassword, user.password);
        if (match) {
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            await db.none('UPDATE users SET password = $1 WHERE username = $2', [hashedNewPassword, req.user]);
            res.redirect('/account');
        } else {
            res.render('index', { 
                user: { username: req.user }, 
                page: 'account',
                errors: [{ msg: 'Current password is incorrect' }] 
            });
        }
    } catch (error) {
        console.error('Error updating password:', error);
        res.render('index', { 
            user: { username: req.user }, 
            page: 'account',
            errors: [{ msg: 'Failed to update password' }] 
        });
    }
});

// Delete Account Route (Admin only)
router.post('/delete-account', isAuthenticated, async (req, res) => {
    if (!await isAdmin(req.user)) {
        return res.render('index', { 
            user: { username: req.user }, 
            page: 'account',
            errors: [{ msg: 'Unauthorized: Admin access required' }] 
        });
    }

    const usernameFromSession = req.user;

    try {
        await db.none('DELETE FROM users WHERE username = $1', usernameFromSession);
        req.session.destroy(() => {
            res.redirect('/login');
        });
    } catch (error) {
        console.error('Error deleting account:', error);
        res.render('index', { 
            user: { username: req.user }, 
            page: 'account',
            errors: [{ msg: 'Failed to delete account' }] 
        });
    }
});

// Logout Route
router.post('/logout', isAuthenticated, (req, res) => {
    const username = req.user;
    req.session.destroy(err => {
        if (err) {
            console.error('Error during logout:', err);
            return res.status(500).send('Logout failed');
        }
        if (global.io) {
            global.io.emit('user disconnected', username);
        }
        res.redirect('/');
    });
});

module.exports = router;
