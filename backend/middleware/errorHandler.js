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

  // Prevent internal file paths, stack traces, or DB exceptions from leaking to client
  if (statusCode >= 500 && (process.env.NODE_ENV === 'production' || /([A-Z]:\\|\/var\/|\/home\/|node_modules|at\s|TypeError:|SyntaxError:)/i.test(userMessage))) {
    userMessage = 'An internal system error occurred. Diagnostic details have been logged securely on the server.';
  }

  res.status(statusCode).json({
    success: false,
    message: userMessage,
    code: err.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  });
};

module.exports = errorHandler;
