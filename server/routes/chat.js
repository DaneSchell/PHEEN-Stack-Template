const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    }
});

// Store messages in memory (replace with database in production)
let messages = [];

// Get messages with pagination
router.get('/messages', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = 20;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    const paginatedMessages = messages.slice(start, end);
    res.json(paginatedMessages);
});

// Handle image uploads
router.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ url: imageUrl });
});

// Socket.io event handlers
const initSocketHandlers = (io) => {
    io.on('connection', (socket) => {
        socket.on('user connected', (username) => {
            socket.username = username;
            const message = {
                username: 'System',
                message: `${username} has joined the chat`,
                type: 'system',
                timestamp: new Date()
            };
            messages.push(message);
            io.emit('chat message', message);
        });

        socket.on('chat message', (msg) => {
            const message = {
                ...msg,
                timestamp: new Date()
            };
            messages.push(message);
            io.emit('chat message', message);
        });

        socket.on('disconnect', () => {
            if (socket.username) {
                const message = {
                    username: 'System',
                    message: `${socket.username} has left the chat`,
                    type: 'system',
                    timestamp: new Date()
                };
                messages.push(message);
                io.emit('chat message', message);
            }
        });
    });
};

module.exports = { router, initSocketHandlers }; 