const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { isAuthenticated } = require('../middleware/auth');
const db = require('../middleware/db');

// Account Page Route
router.get('/', (req, res) => {
    if (req.session.token) {
      // Verify the token
      jwt.verify(req.session.token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          // Handle token expiration or invalid token
          res.redirect('/login');
        } else {
          // Render the account page with the user's name
          res.render('account', { user: decoded.username });
        }
      });
    } else {
      // Redirect to login if not authenticated
      res.redirect('/login');
    }
  });

// Logout Route
router.post('/logout', isAuthenticated, (req, res) => {
  const username = req.user; // Assuming `req.user` is set correctly
  req.session.destroy(err => {
    if (err) {
      console.error('Error during logout:', err);
      return res.status(500).send('Logout failed');
    }
    if (global.io) { // Ensure `io` is available
      global.io.emit('user disconnected', username);
    }
    res.redirect('/');
  });
});

  // Update Username Route
router.post('/update-username', isAuthenticated, async (req, res) => {
    const { newUsername } = req.body;
    try {
      await db.none('UPDATE users SET username = $1 WHERE username = $2', [newUsername, req.user]);
      // Update the username in the session token
      const token = jwt.sign({ username: newUsername }, process.env.JWT_SECRET, { expiresIn: '1h' });
      req.session.token = token;
      res.redirect('/account');
    } catch (error) {
      console.error('Error updating username:', error);
      res.send('Failed to update username');
    }
  });
    
  // Update Password Route
  router.post('/update-password', isAuthenticated, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
      const user = await db.oneOrNone('SELECT password FROM users WHERE username = $1', req.user);
      const match = await bcrypt.compare(currentPassword, user.password);
      if (match) {
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.none('UPDATE users SET password = $1 WHERE username = $2', [hashedNewPassword, req.user]);
        res.redirect('/account');
      } else {
        res.send('Current password is incorrect');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      res.send('Failed to update password');
    }
  });  
  
  // Account Deletion Route
  router.post('/delete-account', isAuthenticated, async (req, res) => {
    try {
      await db.none('DELETE FROM users WHERE username = $1', req.user);
      req.session.destroy(() => {
        res.redirect('/login');
      });
    } catch (error) {
      console.error('Error deleting account:', error);
      res.send('Failed to delete account');
    }
  });

  module.exports = router;