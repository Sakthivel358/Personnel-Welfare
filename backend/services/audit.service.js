const db = require('../models/dbAdapter');

class AuditService {
  async log({ action, userId, personnelId, targetResource, ipAddress, details }) {
    try {
      await db.AuditLogs.create({
        action,
        performedBy: userId,
        personnelId,
        targetResource,
        ipAddress: ipAddress || '127.0.0.1',
        details: details || {},
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('[Audit Log Error]:', err.message);
    }
  }
}

module.exports = new AuditService();
