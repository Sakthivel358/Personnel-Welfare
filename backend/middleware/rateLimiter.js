/**
 * Lightweight In-Memory Sliding-Window Rate Limiter Middleware
 * Protects critical endpoints against brute-force attacks and denial-of-service abuse.
 */

const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000; // default 15 minutes
  const maxRequests = options.maxRequests || 100; // default 100 requests per window
  const message = options.message || 'Too many requests from this IP. Please try again later.';
  const hits = new Map(); // key -> [timestamp, timestamp, ...]

  // Periodic cleanup of expired records every 5 minutes
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits.entries()) {
      const valid = timestamps.filter(t => now - t < windowMs);
      if (valid.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, valid);
      }
    }
  }, 5 * 60 * 1000);

  if (cleanupTimer.unref) {
    cleanupTimer.unref(); // Prevent node process from hanging on test completion
  }

  const rateLimiterMiddleware = (req, res, next) => {
    // Allow bypassing if explicitly opted out via test header or environment flag
    if (req.headers['x-bypass-rate-limit'] === 'true' && process.env.NODE_ENV !== 'production') {
      return next();
    }

    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                     req.socket?.remoteAddress ||
                     req.ip ||
                     'unknown-client';
    const key = `${clientIp}:${req.baseUrl || ''}`;
    const now = Date.now();

    const clientTimestamps = hits.get(key) || [];
    const validTimestamps = clientTimestamps.filter(t => now - t < windowMs);

    if (validTimestamps.length >= maxRequests) {
      const oldestInWindow = validTimestamps[0];
      const retryAfterSeconds = Math.ceil((windowMs - (now - oldestInWindow)) / 1000);
      res.setHeader('Retry-After', String(Math.max(retryAfterSeconds, 1)));
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(Math.ceil((oldestInWindow + windowMs) / 1000)));

      return res.status(429).json({
        success: false,
        message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.max(retryAfterSeconds, 1)
      });
    }

    validTimestamps.push(now);
    hits.set(key, validTimestamps);

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(maxRequests - validTimestamps.length));

    next();
  };

  // Helper method to reset limiter state (useful in automated testing)
  rateLimiterMiddleware.reset = () => {
    hits.clear();
  };

  return rateLimiterMiddleware;
};

// Standard Auth Rate Limiter (Login, Register, Password Verification)
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
});

module.exports = {
  createRateLimiter,
  authLimiter
};
