const auditService = require('../services/audit.service');
const securityMonitoring = require('../services/securityMonitoring.service');

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      securityMonitoring.recordUnauthorizedAccess({ ip: req.ip, path: req.originalUrl, method: req.method });
      return res.status(401).json({
        success: false,
        message: 'Authentication required prior to authorization.',
        code: 'UNAUTHENTICATED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      securityMonitoring.recordAuthorizationFailure({
        ip: req.ip,
        userId: req.user._id,
        userRole: req.user.role,
        path: req.originalUrl || req.baseUrl,
        method: req.method,
        requiredRole: allowedRoles.join(', ')
      });

      auditService.log({
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        userId: req.user._id,
        personnelId: req.user.personnelId,
        targetResource: req.originalUrl || req.baseUrl,
        outcome: 'DENIED',
        ipAddress: req.ip,
        details: { attemptedRole: req.user.role, requiredRoles: allowedRoles, path: req.originalUrl }
      }).catch(() => {});

      return res.status(403).json({
        success: false,
        message: `Access denied. Authorized roles: ${allowedRoles.join(', ')}. Your role: ${req.user.role}`,
        code: 'FORBIDDEN_ROLE'
      });
    }

    next();
  };
};

module.exports = { authorizeRoles };
