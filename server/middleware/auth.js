const jwt = require('jsonwebtoken'); // Make sure to require jwt here
const session = require('express-session');
const db = require('./db');

const sessionConfig = session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using https
  });

// Check if user is Authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.token) {
    jwt.verify(req.session.token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        res.redirect('/login');
      } else {
        // Add the decoded username to the request object
        req.user = decoded.username;
        req.userRole = decoded.role;
        next();
      }
    });
  } else {
    res.redirect('/login');
  }
};

const isAdmin = async (req, res, next) => {
    if (!req.user) {
        return res.redirect('/login');
    }

    try {
        const user = await db.oneOrNone('SELECT role FROM users WHERE username = $1', [req.user]);
        if (user && user.role === 'admin') {
            next();
        } else {
            res.status(403).render('index', {
                user: req.user,
                page: 'dashboard',
                errors: [{ msg: 'Access denied. Admin privileges required.' }]
            });
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
        res.status(500).render('index', {
            user: req.user,
            page: 'dashboard',
            errors: [{ msg: 'Server error checking permissions.' }]
        });
    }
};

const canModifyUser = async (req, res, next) => {
    if (!req.user) {
        return res.redirect('/login');
    }

    try {
        const user = await db.oneOrNone('SELECT role FROM users WHERE username = $1', [req.user]);
        if (user && (user.role === 'admin' || req.user === req.params.username)) {
            next();
        } else {
            res.status(403).render('index', {
                user: req.user,
                page: 'dashboard',
                errors: [{ msg: 'Access denied. Insufficient privileges.' }]
            });
        }
    } catch (error) {
        console.error('Error checking user modification permissions:', error);
        res.status(500).render('index', {
            user: req.user,
            page: 'dashboard',
            errors: [{ msg: 'Server error checking permissions.' }]
        });
    }
};

module.exports = {
    sessionConfig,
    isAuthenticated,
    isAdmin,
    canModifyUser
  };
