const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const db = require('../middleware/db');
const multer = require('multer');
const path = require('path');

// Set up multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join('/app/client/uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Dashboard Page Route
router.get('/', isAuthenticated, async (req, res) => {
    try {
        let data = {
            user: req.user,
            userRole: req.userRole,
            page: 'dashboard',
            errors: []
        };

        // If admin, fetch all users
        if (req.userRole === 'admin') {
            const users = await db.manyOrNone('SELECT id, username, email, role FROM users ORDER BY created_at DESC');
            data.users = users;
        }

        res.render('index', data);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.render('index', {
            user: req.user,
            userRole: req.userRole,
            page: 'dashboard',
            errors: [{ msg: 'Error loading dashboard' }]
        });
    }
});

// Older Messages Route
router.get('/older-messages', isAuthenticated, async (req, res) => {
  console.log('GET /older-messages route hit');
  const oldestMessageId = req.query.oldestMessageId;

  try {
    let query = 'SELECT id, username, message FROM messages';
    const params = [];

    if (oldestMessageId && !isNaN(parseInt(oldestMessageId))) {
      query += ' WHERE id < $1';
      params.push(parseInt(oldestMessageId));
    }

    query += ' ORDER BY id DESC LIMIT 25';

    const olderMessages = await db.any(query, params);
    res.json(olderMessages.reverse());
  } catch (error) {
    console.error('Error fetching older messages:', error);
    res.status(500).json({ error: 'Failed to fetch older messages' });
  }
});

// Image Upload Route
router.post('/upload-image', isAuthenticated, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, fileUrl });
});

// Admin Routes
router.post('/admin/users/:username/delete', isAdmin, async (req, res) => {
    try {
        const { username } = req.params;
        
        // Prevent admin from deleting themselves
        if (username === req.user) {
            return res.status(400).json({ error: 'Cannot delete your own admin account' });
        }

        await db.none('DELETE FROM users WHERE username = $1', [username]);
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

router.post('/admin/users/update', isAdmin, async (req, res) => {
    try {
        const { username, email, role } = req.body;
        
        // Prevent admin from modifying their own role
        if (username === req.user && role !== 'admin') {
            return res.status(400).json({ error: 'Cannot modify your own admin role' });
        }

        await db.none('UPDATE users SET email = $1, role = $2 WHERE username = $3', [email, role, username]);
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

module.exports = router;
