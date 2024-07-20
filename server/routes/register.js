const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../middleware/db');

// Register Page Route
router.get('/', (req, res) => {
  if (req.session.token) {
    jwt.verify(req.session.token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        res.render('register');
      } else {
        res.redirect('/account');
      }
    });
  } else {
    res.render('register');
  }
});

  // Register Page Form Submit Route
  router.post('/', async (req, res) => {
    const { username, password } = req.body;
  
    // Check if password is defined
    if (typeof password === 'undefined') {
      console.error('Password is undefined.');
      return res.send('Registration failed: No password provided.');
    }
  
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
    
      // Store the username and hashedPassword in your database
      await db.none('INSERT INTO users(username, password) VALUES($1, $2)', [username, hashedPassword]);
      // After storing the user, redirect to the login page
      res.redirect('/login');
    } catch (error) {
      console.error('Error registering new user:', error);
      res.redirect('/register?error=Registration%20failed');
    }
  });

  module.exports = router;