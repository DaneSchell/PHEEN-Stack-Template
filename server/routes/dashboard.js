const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const db = require('../middleware/db');
const multer = require('multer');
const path = require('path');

// Set up multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join('/app/client/public/uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Dashboard Page Route
router.get('/', isAuthenticated, (req, res) => {
  res.render('dashboard', { user: req.user });
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

module.exports = router;
