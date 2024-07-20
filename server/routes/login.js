const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../middleware/db');

// Login Page Route
router.get('/', (req, res) => {
    if (req.session.token) {
      // Verify the token
      jwt.verify(req.session.token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          // If there's an error (e.g., token expired), show the login page
          res.render('login');
        } else {
          // If the token is valid, redirect to the account page
          res.redirect('/account');
        }
      });
    } else {
      // If there's no token, show the login page
      res.render('login');
    }
  });
  
  // Login Page Form Submit Route
  router.post('/', async (req, res) => {
    const { username, password } = req.body;
  
    try {
      // Retrieve the user from the database
      const user = await db.one('SELECT username, password FROM users WHERE username = $1', username);
      const match = await bcrypt.compare(password, user.password);
  
      if (match) {
        // Create a token
        const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
        // Store the token and username in the session
        req.session.token = token;
        req.session.username = user.username; // Store username in the session
  
        // Redirect to the account page
        res.redirect('/account');
      } else {
        res.redirect('/login?error=Login%20failed');
      }
    } catch (error) {
      console.error('Error logging in:', error);
      res.redirect('/login?error=Login%20failed');
    }
  });

  module.exports = router;