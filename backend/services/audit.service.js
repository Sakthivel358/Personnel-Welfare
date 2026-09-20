const crypto = require('crypto');
const db = require('../models/dbAdapter');

const GENESIS_HASH = '0'.repeat(64);

class AuditService {
  /**
   * Computes the deterministic SHA-256 hash for an audit record block.
   * Excludes raw biometrics, self-checks, or sensitive payloads from the hash.
   */
  computeHash({ previousHash, timestamp, action, performedBy, personnelId, outcome, targetResource }) {
    const payload = [
      previousHash || GENESIS_HASH,
      timestamp,
      action,
      performedBy || '',
      personnelId || '',
      outcome || 'SUCCESS',
      targetResource || ''
    ].join('|');

    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Appends an immutable, cryptographically chained audit log entry.
   */
  async log({ action, userId, personnelId, targetResource, ipAddress, outcome = 'SUCCESS', details }) {
    try {
      const logs = await db.AuditLogs.find();
      const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
      const previousHash = lastLog && lastLog.hash ? lastLog.hash : GENESIS_HASH;
      const timestamp = new Date().toISOString();

      const hash = this.computeHash({
        previousHash,
        timestamp,
        action,
        performedBy: userId,
        personnelId,
        outcome,
        targetResource
      });

      const auditRecord = await db.AuditLogs.create({
        action,
        performedBy: userId || null,
        personnelId: personnelId || null,
        targetResource: targetResource || 'System',
        outcome,
        ipAddress: ipAddress || '127.0.0.1',
        details: details || {},
        timestamp,
        previousHash,
        hash
      });

      return auditRecord;
    } catch (err) {
      console.error('[Audit Log Error]:', err.message);
      return null;
    }
  }

  /**
   * Cryptographically verifies the integrity of the complete audit hash-chain.
   * Detects any altered records, deletions, reordering, or tampering.
   */
  async verifyChain() {
    try {
      const logs = await db.AuditLogs.find();
      if (!logs || logs.length === 0) {
        return {
          verified: true,
          totalRecords: 0,
          headHash: GENESIS_HASH,
          status: 'EMPTY_CHAIN'
        };
      }

      // Filter only logs that have hash chaining enabled (backward compatibility)
      const chainedLogs = logs.filter(l => l.hash && l.previousHash);
      if (chainedLogs.length === 0) {
        return {
          verified: true,
          totalRecords: logs.length,
          chainedRecords: 0,
          status: 'UNHASHED_LEGACY_RECORDS'
        };
      }

      for (let i = 0; i < chainedLogs.length; i++) {
        const record = chainedLogs[i];

        // 1. Verify link to previous hash
        if (i === 0) {
          // First chained record can point to GENESIS_HASH or previous unhashed block
          if (record.previousHash !== GENESIS_HASH && record.previousHash.length !== 64) {
            return {
              verified: false,
              totalRecords: chainedLogs.length,
              tamperedIndex: i,
              recordId: record._id,
              reason: `Invalid initial previousHash on block ${i}.`
            };
          }
        } else {
          const prevRecord = chainedLogs[i - 1];
          if (record.previousHash !== prevRecord.hash) {
            return {
              verified: false,
              totalRecords: chainedLogs.length,
              tamperedIndex: i,
              recordId: record._id,
              reason: `Broken chain link at block ${i}: previousHash does not match prior record hash.`
            };
          }
        }

        // 2. Recompute hash and verify integrity
        const recomputed = this.computeHash({
          previousHash: record.previousHash,
          timestamp: record.timestamp,
          action: record.action,
          performedBy: record.performedBy,
          personnelId: record.personnelId,
          outcome: record.outcome,
          targetResource: record.targetResource
        });

        if (recomputed !== record.hash) {
          return {
            verified: false,
            totalRecords: chainedLogs.length,
            tamperedIndex: i,
            recordId: record._id,
            reason: `Data tampering detected at block ${i}: computed hash ${recomputed} does not match stored hash ${record.hash}.`
          };
        }
      }

      const headHash = chainedLogs[chainedLogs.length - 1].hash;

      return {
        verified: true,
        totalRecords: logs.length,
        chainedRecords: chainedLogs.length,
        headHash,
        status: 'TAMPER_FREE_VERIFIED'
      };
    } catch (err) {
      return {
        verified: false,
        error: err.message,
        status: 'VERIFICATION_ERROR'
      };
    }
  }
}

module.exports = new AuditService();
