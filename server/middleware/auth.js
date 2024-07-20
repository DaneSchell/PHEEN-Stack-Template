const jwt = require('jsonwebtoken'); // Make sure to require jwt here
const session = require('express-session');

const sessionConfig = session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using https
  });

// Check if user is Authenticated
function isAuthenticated(req, res, next) {
  if (req.session.token) {
    jwt.verify(req.session.token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        res.redirect('/login');
      } else {
        // Add the decoded username to the request object
        req.user = decoded.username;
        next();
      }
    });
  } else {
    res.redirect('/login');
  }
}

module.exports = {
    sessionConfig,
    isAuthenticated
  };
