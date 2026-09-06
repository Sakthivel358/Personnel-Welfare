/**
 * Role-Based Access Control (RBAC) Middleware
 * Enforces access restriction based on user roles (PERSONNEL, WELFARE_OFFICER, ADMIN)
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required prior to authorization.',
        code: 'UNAUTHENTICATED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
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
