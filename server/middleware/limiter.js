const RateLimiterFlexible = require('rate-limiter-flexible');

// Rate Limiter configuration
const opts = {
  points: 100, // Number of points
  duration: 60, // Per second
  blockDuration: 60 * 60 // Block for 1 hour, if exceeding points
};

const rateLimiter = new RateLimiterFlexible.RateLimiterMemory(opts);

// Middleware function for rate limiting
function rateLimiterMiddleware(req, res, next) {
  rateLimiter.consume(req.ip)
    .then(() => {
      next();
    })
    .catch(() => {
      res.status(429).send('Too Many Requests');
    });
}

module.exports = rateLimiterMiddleware;
