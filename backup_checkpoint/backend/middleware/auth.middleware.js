const jwt = require('jsonwebtoken');
const db = require('../models/dbAdapter');

const JWT_SECRET = process.env.JWT_SECRET || 'sih26186_personnel_welfare_secure_jwt_secret_2026';

const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check HttpOnly cookie
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // 2. Check Authorization Bearer header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in to continue.',
        code: 'AUTH_REQUIRED'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Your session has expired. Please sign in again.',
          code: 'SESSION_EXPIRED'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication session. Please sign in again.',
        code: 'INVALID_TOKEN'
      });
    }

    // Lookup user in database
    const user = await db.Users.findById(decoded.id || decoded._id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authenticated account no longer exists. Please register or sign in again.',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact the welfare administrator.',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Attach user to request (exclude password)
    const { password, ...safeUser } = user;
    req.user = safeUser;
    next();
  } catch (error) {
    console.error('[Auth Middleware Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication service is temporarily unavailable. Please try again.',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

module.exports = { authenticate, JWT_SECRET };
