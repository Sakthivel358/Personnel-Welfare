/**
 * HRMS Integration Controller
 * Exposes RESTful endpoints for simulated Armed Forces & CAPF HRMS feeds.
 * All responses are clearly marked as simulated.
 */

const hrmsService = require('../services/hrms.service');
const auditService = require('../services/audit.service');
const securityMonitoring = require('../services/securityMonitoring.service');

const getStatus = async (req, res, next) => {
  try {
    const status = hrmsService.getHRMSStatus();
    return res.status(200).json({
      success: true,
      data: status
    });
  } catch (err) {
    next(err);
  }
};

const getMyRecord = async (req, res, next) => {
  try {
    const personnelId = req.user.personnelId;
    if (!personnelId) {
      return res.status(400).json({
        success: false,
        message: 'No personnel ID associated with current user session.'
      });
    }

    const dossier = await hrmsService.getPersonnelRecord(personnelId);

    await auditService.log({
      action: 'SENSITIVE_RECORD_ACCESS',
      userId: req.user._id,
      personnelId,
      targetResource: 'HRMS_MY_RECORD',
      outcome: 'SUCCESS',
      ipAddress: req.ip,
      details: { recordType: 'HRMS_SERVICE_DOSSIER' }
    });

    return res.status(200).json({
      success: true,
      isSimulated: true,
      mockDisclaimer: hrmsService.mockDisclaimer,
      data: dossier
    });
  } catch (err) {
    next(err);
  }
};

const getPersonnelRecord = async (req, res, next) => {
  try {
    const targetId = req.params.id;

    // RBAC: PERSONNEL role can only view their own HRMS record
    if (req.user.role === 'PERSONNEL' && req.user.personnelId !== targetId) {
      securityMonitoring.recordSuspiciousDataAccess({
        ip: req.ip,
        userId: req.user._id,
        userRole: req.user.role,
        targetResource: 'HRMS_RECORD',
        attemptedId: targetId,
        reason: 'IDOR unauthorized personnel record attempt'
      });

      await auditService.log({
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        userId: req.user._id,
        personnelId: req.user.personnelId,
        targetResource: `HRMS_RECORD:${targetId}`,
        outcome: 'DENIED',
        ipAddress: req.ip,
        details: { reason: 'IDOR unauthorized personnel record attempt', targetId }
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied. You may only view your own HRMS record.'
      });
    }

    const dossier = await hrmsService.getPersonnelRecord(targetId);

    await auditService.log({
      action: 'SENSITIVE_RECORD_ACCESS',
      userId: req.user._id,
      personnelId: targetId,
      targetResource: `HRMS_RECORD:${targetId}`,
      outcome: 'SUCCESS',
      ipAddress: req.ip,
      details: { recordType: 'HRMS_PERSONNEL_DOSSIER', viewedByRole: req.user.role }
    });

    return res.status(200).json({
      success: true,
      isSimulated: true,
      mockDisclaimer: hrmsService.mockDisclaimer,
      data: dossier
    });
  } catch (err) {
    next(err);
  }
};

const getCategoryData = async (req, res, next) => {
  try {
    const category = req.params.category;
    let targetId = req.query.personnelId || req.user.personnelId;

    if (req.user.role === 'PERSONNEL') {
      targetId = req.user.personnelId;
    }

    const categoryData = await hrmsService.getCategoryData(category, targetId);
    return res.status(200).json({
      success: true,
      isSimulated: true,
      mockDisclaimer: hrmsService.mockDisclaimer,
      data: categoryData
    });
  } catch (err) {
    next(err);
  }
};

const syncHRMS = async (req, res, next) => {
  try {
    let targetId = req.body.personnelId || req.user.personnelId;

    if (req.user.role === 'PERSONNEL') {
      targetId = req.user.personnelId;
    }

    const result = await hrmsService.syncPersonnelFromHRMS(targetId, req.user._id);
    return res.status(200).json({
      success: true,
      isSimulated: true,
      mockDisclaimer: hrmsService.mockDisclaimer,
      message: result.message,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStatus,
  getMyRecord,
  getPersonnelRecord,
  getCategoryData,
  syncHRMS
};
