/**
 * Wearable Telemetry Ingestion & Synchronization Controller
 * Validates, deduplicates, and manages authorized Tactical Smart Jacket and IoT sensor data.
 */

const db = require('../models/dbAdapter');
const auditService = require('../services/audit.service');

const AUTHORIZED_DEVICE_TYPES = [
  'TACTICAL_SMART_JACKET',
  'DEFENSE_IOT_BAND',
  'BLE_HEART_RATE_MONITOR',
  'SMART_WATCH',
  'TACTICAL_SENSOR'
];

const VALID_ACTIVITY_TYPES = [
  'MODERATE_PATROL',
  'STATIONARY_POST',
  'HIGH_MOBILITY_TACTICAL',
  'VEHICLE_TRANSIT',
  'RESTING'
];

const VALID_POSTURE_TYPES = [
  'NORMAL_MOBILITY',
  'PROLONGED_STANDING',
  'PROLONGED_SITTING',
  'IMMOBILE_FATIGUE',
  'LYING_REST'
];

/**
 * Validate incoming wearable telemetry against physiological ranges & structural constraints.
 * Strict validation ensures corrupted or fabricated packets are rejected BEFORE storage or ML inference.
 */
function validateWearableTelemetry(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Request body must be a valid JSON object.'] };
  }

  // 1. Device Authorization & Metadata Validation
  if (!data.deviceId || typeof data.deviceId !== 'string' || data.deviceId.trim().length < 3 || data.deviceId.trim().length > 64) {
    errors.push('deviceId must be a string between 3 and 64 characters.');
  } else if (!/^[a-zA-Z0-9_\-.:]+$/.test(data.deviceId.trim())) {
    errors.push('deviceId contains invalid characters (allowed: alphanumeric, hyphen, underscore, colon, period).');
  }

  const deviceType = (data.deviceType || 'TACTICAL_SMART_JACKET').toUpperCase();
  if (!AUTHORIZED_DEVICE_TYPES.includes(deviceType)) {
    errors.push(`deviceType must be one of: ${AUTHORIZED_DEVICE_TYPES.join(', ')}.`);
  }

  // Support telemetry nested under data.telemetry OR at root level of packet
  const telemetry = data.telemetry && typeof data.telemetry === 'object' ? data.telemetry : data;

  // 2. Physiological Biometric Range Checks
  // Resting Heart Rate: 30 - 220 BPM (Physiological human boundaries)
  if (telemetry.resting_heart_rate !== undefined && telemetry.resting_heart_rate !== null) {
    const rhr = Number(telemetry.resting_heart_rate);
    if (isNaN(rhr) || rhr < 30 || rhr > 220) {
      errors.push(`resting_heart_rate must be a valid number between 30 and 220 BPM (received: ${telemetry.resting_heart_rate}).`);
    }
  }

  // Heart Rate Variability (RMSSD): 5 - 250 ms
  if (telemetry.hrv_ms !== undefined && telemetry.hrv_ms !== null) {
    const hrv = Number(telemetry.hrv_ms);
    if (isNaN(hrv) || hrv < 5 || hrv > 250) {
      errors.push(`hrv_ms must be a valid number between 5 and 250 ms (received: ${telemetry.hrv_ms}).`);
    }
  }

  // Respiration Rate: 6 - 45 breaths/min
  if (telemetry.respiration_rate !== undefined && telemetry.respiration_rate !== null) {
    const resp = Number(telemetry.respiration_rate);
    if (isNaN(resp) || resp < 6 || resp > 45) {
      errors.push(`respiration_rate must be a valid number between 6 and 45 breaths/min (received: ${telemetry.respiration_rate}).`);
    }
  }

  // Skin / Body Temperature: 30.0 - 43.0 °C
  if (telemetry.skin_temperature_c !== undefined && telemetry.skin_temperature_c !== null) {
    const temp = Number(telemetry.skin_temperature_c);
    if (isNaN(temp) || temp < 30.0 || temp > 43.0) {
      errors.push(`skin_temperature_c must be a valid number between 30.0 and 43.0 °C (received: ${telemetry.skin_temperature_c}).`);
    }
  }

  // Fatigue / Physical Strain Index: 0 - 100
  if (telemetry.fatigue_physical_strain !== undefined && telemetry.fatigue_physical_strain !== null) {
    const strain = Number(telemetry.fatigue_physical_strain);
    if (isNaN(strain) || strain < 0 || strain > 100) {
      errors.push(`fatigue_physical_strain must be an integer or float between 0 and 100 (received: ${telemetry.fatigue_physical_strain}).`);
    }
  }

  // Activity pattern
  if (telemetry.activity_movement) {
    const act = String(telemetry.activity_movement).toUpperCase();
    if (!VALID_ACTIVITY_TYPES.includes(act)) {
      errors.push(`activity_movement must be one of: ${VALID_ACTIVITY_TYPES.join(', ')}.`);
    }
  }

  // Posture / Inactivity pattern
  if (telemetry.posture_inactivity) {
    const post = String(telemetry.posture_inactivity).toUpperCase();
    if (!VALID_POSTURE_TYPES.includes(post)) {
      errors.push(`posture_inactivity must be one of: ${VALID_POSTURE_TYPES.join(', ')}.`);
    }
  }

  // Battery Level (Optional): 0 - 100
  if (data.batteryLevel !== undefined && data.batteryLevel !== null) {
    const bat = Number(data.batteryLevel);
    if (isNaN(bat) || bat < 0 || bat > 100) {
      errors.push('batteryLevel must be between 0 and 100%.');
    }
  }

  // Signal Quality (Optional): 0 - 100
  if (data.signalQuality !== undefined && data.signalQuality !== null) {
    const sig = Number(data.signalQuality);
    if (isNaN(sig) || sig < 0 || sig > 100) {
      errors.push('signalQuality must be between 0 and 100%.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: {
      deviceId: data.deviceId ? String(data.deviceId).trim() : 'UNKNOWN_DEVICE',
      deviceType,
      idempotencyKey: data.idempotencyKey ? String(data.idempotencyKey).trim() : null,
      timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
      batteryLevel: data.batteryLevel != null ? Number(data.batteryLevel) : null,
      signalQuality: data.signalQuality != null ? Number(data.signalQuality) : null,
      telemetry: {
        resting_heart_rate: telemetry.resting_heart_rate != null ? Number(telemetry.resting_heart_rate) : null,
        hrv_ms: telemetry.hrv_ms != null ? Number(telemetry.hrv_ms) : null,
        respiration_rate: telemetry.respiration_rate != null ? Number(telemetry.respiration_rate) : null,
        skin_temperature_c: telemetry.skin_temperature_c != null ? Number(telemetry.skin_temperature_c) : null,
        fatigue_physical_strain: telemetry.fatigue_physical_strain != null ? Number(telemetry.fatigue_physical_strain) : null,
        activity_movement: telemetry.activity_movement ? String(telemetry.activity_movement).toUpperCase() : 'MODERATE_PATROL',
        posture_inactivity: telemetry.posture_inactivity ? String(telemetry.posture_inactivity).toUpperCase() : 'NORMAL_MOBILITY'
      }
    }
  };
}

/**
 * Ingest single authorized wearable telemetry packet.
 * Enforces validation and deduplication via idempotencyKey.
 */
const ingestWearableData = async (req, res, next) => {
  try {
    const validation = validateWearableTelemetry(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Wearable telemetry validation failed.',
        errors: validation.errors
      });
    }

    const { sanitized } = validation;

    // Idempotency check: prevent duplicate records
    if (sanitized.idempotencyKey) {
      const existing = await db.WearableData.findOne({
        userId: req.user._id,
        idempotencyKey: sanitized.idempotencyKey
      });

      if (existing) {
        return res.status(200).json({
          success: true,
          isDuplicate: true,
          message: 'Duplicate wearable telemetry packet acknowledged (idempotent deduplication).',
          data: existing
        });
      }
    }

    // Save to persistent database
    const newRecord = await db.WearableData.create({
      userId: req.user._id,
      personnelId: req.user.personnelId,
      deviceId: sanitized.deviceId,
      deviceType: sanitized.deviceType,
      idempotencyKey: sanitized.idempotencyKey || `wb-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      timestamp: sanitized.timestamp,
      batteryLevel: sanitized.batteryLevel,
      signalQuality: sanitized.signalQuality,
      telemetry: sanitized.telemetry,
      createdAt: new Date().toISOString()
    });

    return res.status(201).json({
      success: true,
      isDuplicate: false,
      message: 'Wearable telemetry successfully validated and ingested.',
      data: newRecord
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Synchronize batch of offline-buffered wearable records.
 * Deduplicates against existing records and verifies integrity.
 */
const syncWearableBatch = async (req, res, next) => {
  try {
    const rawItems = Array.isArray(req.body) ? req.body : (req.body.items || []);

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No wearable items provided for synchronization.'
      });
    }

    const synced = [];
    const duplicates = [];
    const rejected = [];

    // Cache existing keys for fast batch deduplication
    const existingRecords = await db.WearableData.find({ userId: req.user._id });
    const existingKeySet = new Set(existingRecords.map(r => r.idempotencyKey).filter(Boolean));

    for (const item of rawItems) {
      const validation = validateWearableTelemetry(item);
      if (!validation.valid) {
        rejected.push({ item, errors: validation.errors });
        continue;
      }

      const { sanitized } = validation;

      if (sanitized.idempotencyKey && existingKeySet.has(sanitized.idempotencyKey)) {
        duplicates.push({ idempotencyKey: sanitized.idempotencyKey, message: 'Already synchronized' });
        continue;
      }

      // Mark key in set to prevent intra-batch duplicates
      if (sanitized.idempotencyKey) {
        existingKeySet.add(sanitized.idempotencyKey);
      }

      const created = await db.WearableData.create({
        userId: req.user._id,
        personnelId: req.user.personnelId,
        deviceId: sanitized.deviceId,
        deviceType: sanitized.deviceType,
        idempotencyKey: sanitized.idempotencyKey || `sync-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        timestamp: sanitized.timestamp,
        batteryLevel: sanitized.batteryLevel,
        signalQuality: sanitized.signalQuality,
        telemetry: sanitized.telemetry,
        createdAt: new Date().toISOString()
      });

      synced.push(created);
    }

    // Audit log synchronization event
    if (synced.length > 0) {
      await auditService.log({
        action: 'WEARABLE_BATCH_SYNCED',
        userId: req.user._id,
        personnelId: req.user.personnelId,
        targetResource: 'WearableData',
        details: {
          syncedCount: synced.length,
          duplicateCount: duplicates.length,
          rejectedCount: rejected.length
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: `Wearable batch synchronized: ${synced.length} synced, ${duplicates.length} duplicate(s) prevented, ${rejected.length} rejected.`,
      syncedCount: synced.length,
      duplicateCount: duplicates.length,
      rejectedCount: rejected.length,
      synced,
      duplicates,
      rejected
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieve latest validated wearable telemetry for the current user.
 */
const getLatestWearableData = async (req, res, next) => {
  try {
    const records = await db.WearableData.find({ userId: req.user._id });
    if (records.length === 0) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No wearable telemetry on record for this personnel.'
      });
    }

    // Return most recent entry
    const latest = records[records.length - 1];
    return res.status(200).json({
      success: true,
      data: latest
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieve historical wearable telemetry series for trend analysis.
 */
const getWearableHistory = async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const records = await db.WearableData.find({ userId: req.user._id });
    const slice = records.slice(-limit);

    return res.status(200).json({
      success: true,
      count: slice.length,
      data: slice
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  validateWearableTelemetry,
  ingestWearableData,
  syncWearableBatch,
  getLatestWearableData,
  getWearableHistory
};
