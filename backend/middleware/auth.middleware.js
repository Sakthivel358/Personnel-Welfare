const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../models/dbAdapter');
const auditService = require('../services/audit.service');
const securityMonitoring = require('../services/securityMonitoring.service');

const JWT_SECRET = process.env.JWT_SECRET || 'sih26186_personnel_welfare_secure_jwt_secret_2026';

const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check Authorization Bearer header (explicit client token)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // 2. Fallback to HttpOnly cookie
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token === '' || token === 'null' || token === 'undefined') {
      token = null;
    }

    if (!token) {
      securityMonitoring.recordUnauthorizedAccess({ ip: req.ip, path: req.originalUrl, method: req.method });
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
      securityMonitoring.recordUnauthorizedAccess({ ip: req.ip, path: req.originalUrl, method: req.method });
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
      securityMonitoring.recordSuspiciousAuth({ ip: req.ip, reason: 'Token with non-existent user presented', targetResource: req.originalUrl });
      return res.status(401).json({
        success: false,
        message: 'Authenticated account no longer exists. Please register or sign in again.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if token was invalidated by an explicit logout
    const isRevoked = await db.RevokedTokens.findOne({ token });
    if (isRevoked) {
      securityMonitoring.recordSuspiciousAuth({ ip: req.ip, reason: 'Revoked session token presented after logout', targetResource: req.originalUrl });
      auditService.log({
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        userId: user ? user._id : null,
        personnelId: user ? user.personnelId : null,
        targetResource: req.originalUrl || 'Auth',
        outcome: 'DENIED',
        ipAddress: req.ip,
        details: { reason: 'Revoked session token presented' }
      }).catch(() => {});

      return res.status(401).json({
        success: false,
        message: 'Your session was ended by logout. Please log in again.',
        code: 'SESSION_REVOKED'
      });
    }

    if (user.isActive === false) {
      securityMonitoring.recordSuspiciousAuth({ ip: req.ip, reason: 'Deactivated account access attempt', targetResource: req.originalUrl });
      auditService.log({
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        userId: user._id,
        personnelId: user.personnelId,
        targetResource: req.originalUrl || 'Auth',
        outcome: 'DENIED',
        ipAddress: req.ip,
        details: { reason: 'Deactivated account access attempt' }
      }).catch(() => {});

      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact the welfare administrator.',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Sliding Session Renewal during active use:
    // If token has less than 12 hours remaining, extend session transparently
    const nowSec = Math.floor(Date.now() / 1000);
    if (decoded.exp && (decoded.exp - nowSec < 12 * 3600)) {
      try {
        const renewedToken = jwt.sign(
          {
            id: user._id,
            personnelId: user.personnelId,
            email: user.email,
            role: user.role,
            jti: crypto.randomBytes(16).toString('hex')
          },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        res.setHeader('X-Renewed-Token', renewedToken);
        res.cookie('token', renewedToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 24 * 60 * 60 * 1000
        });
      } catch (_) {}
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
