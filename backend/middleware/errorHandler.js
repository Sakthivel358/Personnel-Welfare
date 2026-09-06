/**
 * Centralized Error Handler Middleware
 * Formats errors consistently and ensures no internal stack traces or secrets leak to the client.
 */
const errorHandler = (err, req, res, next) => {
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.stack || err.message);

  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  let userMessage = err.message || 'An unexpected internal error occurred. Please try again.';

  if (err.name === 'ValidationError') {
    userMessage = Object.values(err.errors || {})
      .map(e => e.message)
      .join(', ') || 'Validation error in submitted data.';
  } else if (err.code === 11000) {
    userMessage = 'A record with the specified unique identifier already exists.';
  }

  res.status(statusCode).json({
    success: false,
    message: userMessage,
    code: err.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  });
};

module.exports = errorHandler;
