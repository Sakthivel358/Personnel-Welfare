const crypto = require('crypto');
const db = require('../models/dbAdapter');

// Sensitive field keys that must NEVER be logged or stored in security alerts
const SENSITIVE_FORBIDDEN_KEYS = new Set([
  'password', 'passwords', 'token', 'tokens', 'accessToken', 'refreshToken',
  'jwt', 'key', 'keys', 'encryptionKey', 'secret', 'adminSecret',
  'pss_responses', 'wellnessInfo', 'notes', 'medical', 'clinical',
  'resting_heart_rate', 'hrv_ms', 'respiration_rate', 'skin_temperature_c',
  'workload_hours', 'recovery_sleep_hours', 'biometrics'
]);

class SecurityMonitoringService {
  constructor() {
    // In-memory sliding windows for rate tracking
    this.loginFailures = new Map(); // key: ip or identifier -> array of timestamps
    this.unauthAccess = new Map();  // key: ip -> array of timestamps
    this.authFailures = new Map();  // key: ip or userId -> array of timestamps
    this.burstTracking = new Map(); // key: ip -> array of timestamps
  }

  /**
   * Deep sanitization to ensure zero exposure of passwords, tokens, keys,
   * biometrics, or sensitive personal/welfare information.
   */
  sanitizeMetadata(meta = {}) {
    if (!meta || typeof meta !== 'object') return {};
    const clean = {};
    for (const [key, val] of Object.entries(meta)) {
      if (SENSITIVE_FORBIDDEN_KEYS.has(key.toLowerCase())) continue;
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        clean[key] = this.sanitizeMetadata(val);
      } else if (typeof val === 'string') {
        // Strip any embedded JWT-like tokens or potential passwords
        if (val.length > 150 && /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/.test(val)) {
          clean[key] = '[REDACTED_TOKEN]';
        } else {
          clean[key] = val;
        }
      } else {
        clean[key] = val;
      }
    }
    return clean;
  }

  /**
   * Creates a structured, sanitized security alert for authorized Admin/security personnel.
   */
  async createSecurityAlert({ type, severity = 'MEDIUM', description, ipAddress, targetResource, metadata = {} }) {
    try {
      const sanitizedMeta = this.sanitizeMetadata(metadata);
      const timestamp = new Date().toISOString();
      const alertId = `SEC-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      const alertRecord = await db.SecurityAlerts.create({
        alertId,
        type,
        severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity) ? severity : 'MEDIUM',
        description,
        ipAddress: ipAddress || '127.0.0.1',
        targetResource: targetResource || 'System',
        metadata: sanitizedMeta,
        status: 'ACTIVE',
        timestamp
      });

      // Dispatch non-sensitive notification to Admin role
      try {
        const adminUsers = await db.Users.find({ role: 'ADMIN' });
        for (const admin of adminUsers) {
          await db.Notifications.create({
            userId: admin._id,
            title: `Security Alert: ${type.replace(/_/g, ' ')}`,
            message: description,
            type: 'SECURITY_ALERT',
            severity: severity.toLowerCase(),
            link: '/admin.html#audit-section',
            isRead: false,
            createdAt: timestamp
          });
        }
      } catch (_) {}

      return alertRecord;
    } catch (err) {
      console.error('[Security Monitoring Error]:', err.message);
      return null;
    }
  }

  /**
   * 1. Repeated failed logins tracking (threshold: >= 3 within 10 minutes)
   */
  async recordFailedLogin({ ip, identifier, reason }) {
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const ipKey = String(ip || 'unknown');

    const history = (this.loginFailures.get(ipKey) || []).filter(ts => now - ts < windowMs);
    history.push(now);
    this.loginFailures.set(ipKey, history);

    if (history.length >= 3) {
      const sanitizedIdentifier = identifier ? String(identifier).slice(0, 10) + '***' : 'Unknown';
      await this.createSecurityAlert({
        type: 'REPEATED_FAILED_LOGINS',
        severity: history.length >= 5 ? 'CRITICAL' : 'HIGH',
        description: `Multiple failed authentication attempts (${history.length}) detected from IP ${ipKey}.`,
        ipAddress: ipKey,
        targetResource: 'Authentication',
        metadata: {
          attemptCount: history.length,
          identifierMasked: sanitizedIdentifier,
          reason: reason || 'Invalid credentials'
        }
      });
    }
  }

  /**
   * 2. Suspicious authentication activity (e.g., deactivated account, malformed auth token, injection probes)
   */
  async recordSuspiciousAuth({ ip, reason, targetResource = 'Auth', metadata = {} }) {
    await this.createSecurityAlert({
      type: 'SUSPICIOUS_AUTH_ACTIVITY',
      severity: 'HIGH',
      description: `Suspicious authentication activity detected: ${reason}`,
      ipAddress: ip || '127.0.0.1',
      targetResource,
      metadata
    });
  }

  /**
   * 3. Unauthorized API access (401 unauthenticated requests)
   */
  async recordUnauthorizedAccess({ ip, path, method = 'GET' }) {
    const now = Date.now();
    const windowMs = 5 * 60 * 1000;
    const ipKey = String(ip || 'unknown');

    const history = (this.unauthAccess.get(ipKey) || []).filter(ts => now - ts < windowMs);
    history.push(now);
    this.unauthAccess.set(ipKey, history);

    if (history.length >= 3) {
      await this.createSecurityAlert({
        type: 'UNAUTHORIZED_API_ACCESS',
        severity: 'MEDIUM',
        description: `Repeated unauthorized requests (${history.length}) to protected API endpoint ${path} without valid credentials.`,
        ipAddress: ipKey,
        targetResource: path,
        metadata: { path, method, count: history.length }
      });
    }
  }

  /**
   * 4. Repeated authorization failures (403 forbidden / RBAC failures)
   */
  async recordAuthorizationFailure({ ip, userId, userRole, path, method = 'GET', requiredRole }) {
    const now = Date.now();
    const windowMs = 5 * 60 * 1000;
    const key = String(ip || userId || 'unknown');

    const history = (this.authFailures.get(key) || []).filter(ts => now - ts < windowMs);
    history.push(now);
    this.authFailures.set(key, history);

    if (history.length >= 2) {
      await this.createSecurityAlert({
        type: 'REPEATED_AUTHORIZATION_FAILURES',
        severity: 'HIGH',
        description: `User role '${userRole || 'ANONYMOUS'}' triggered repeated authorization failures (${history.length}) attempting to access restricted resource ${path}.`,
        ipAddress: ip || '127.0.0.1',
        targetResource: path,
        metadata: {
          userRole: userRole || 'UNKNOWN',
          requiredRole: requiredRole || 'RESTRICTED',
          path,
          method,
          failureCount: history.length
        }
      });
    }
  }

  /**
   * 5. Abnormal request bursts (rate-limit triggers)
   */
  async recordRequestBurst({ ip, path, count }) {
    await this.createSecurityAlert({
      type: 'ABNORMAL_REQUEST_BURSTS',
      severity: 'MEDIUM',
      description: `Rate limit threshold exceeded by IP ${ip || '127.0.0.1'} on endpoint ${path || 'API'}. Potential burst traffic or automated scanning.`,
      ipAddress: ip || '127.0.0.1',
      targetResource: path || 'API Gateway',
      metadata: { requestCount: count }
    });
  }

  /**
   * 6. Suspicious data-access attempts (IDOR attempts)
   */
  async recordSuspiciousDataAccess({ ip, userId, userRole, targetResource, attemptedId, reason }) {
    await this.createSecurityAlert({
      type: 'SUSPICIOUS_DATA_ACCESS',
      severity: 'CRITICAL',
      description: `Potential unauthorized object reference (IDOR) attempt blocked. User attempted to access unauthorized record ${targetResource}:${attemptedId || 'record'}.`,
      ipAddress: ip || '127.0.0.1',
      targetResource: targetResource || 'Dossier',
      metadata: {
        attemptedResource: targetResource,
        attemptedId: attemptedId ? String(attemptedId).slice(0, 8) + '***' : 'REDACTED',
        userRole: userRole || 'PERSONNEL',
        reason: reason || 'Access denied by IDOR security guardrail'
      }
    });
  }

  /**
   * 7. Security configuration changes (role alterations, consent changes, audit verification tampering)
   */
  async recordSecurityConfigChange({ ip, userId, userRole, action, targetResource, details = {} }) {
    await this.createSecurityAlert({
      type: 'SECURITY_CONFIG_CHANGES',
      severity: 'HIGH',
      description: `Security configuration modification detected: ${action} on ${targetResource}.`,
      ipAddress: ip || '127.0.0.1',
      targetResource,
      metadata: {
        action,
        modifiedByRole: userRole || 'ADMIN',
        ...details
      }
    });
  }

  /**
   * Fetch all security alerts for authorized admin/security dashboard.
   */
  async getSecurityAlerts(limit = 100) {
    try {
      const alerts = await db.SecurityAlerts.find();
      return alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
    } catch (err) {
      console.error('[Get Security Alerts Error]:', err.message);
      return [];
    }
  }

  /**
   * Aggregate metrics for security monitoring dashboard.
   */
  async getSecurityMetrics() {
    try {
      const alerts = await db.SecurityAlerts.find();
      const byType = {};
      const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

      for (const a of alerts) {
        byType[a.type] = (byType[a.type] || 0) + 1;
        if (bySeverity[a.severity] !== undefined) {
          bySeverity[a.severity]++;
        }
      }

      return {
        totalAlerts: alerts.length,
        activeAlerts: alerts.filter(a => a.status === 'ACTIVE').length,
        byType,
        bySeverity,
        lastAlertTimestamp: alerts.length > 0 ? alerts[alerts.length - 1].timestamp : null
      };
    } catch (err) {
      console.error('[Get Security Metrics Error]:', err.message);
      return { totalAlerts: 0, activeAlerts: 0, byType: {}, bySeverity: {} };
    }
  }
}

module.exports = new SecurityMonitoringService();
