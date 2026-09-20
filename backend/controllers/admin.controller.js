const db = require('../models/dbAdapter');
const { getDBStatus } = require('../config/db');
const mlClient = require('../services/mlClient.service');
const auditService = require('../services/audit.service');

const getSystemMetrics = async (req, res, next) => {
  try {
    const usersCount = await db.Users.countDocuments();
    const personnelCount = await db.Personnel.countDocuments();
    const checkInsCount = await db.CheckIns.countDocuments();
    const predictionsCount = await db.Predictions.countDocuments();
    const alertsCount = await db.Alerts.countDocuments();
    const supportRequestsCount = await db.SupportRequests.countDocuments();
    const followUpsCount = await db.FollowUps.countDocuments();
    const auditLogsCount = await db.AuditLogs.countDocuments();

    const dbStatus = getDBStatus();
    const mlHealth = await mlClient.checkHealth();

    return res.status(200).json({
      success: true,
      data: {
        systemStatus: {
          nodeBackend: 'Operational (Express 4.x)',
          database: dbStatus,
          mlService: mlHealth
        },
        counts: {
          users: usersCount,
          personnel: personnelCount,
          checkIns: checkInsCount,
          predictions: predictionsCount,
          alerts: alertsCount,
          supportRequests: supportRequestsCount,
          followUps: followUpsCount,
          auditLogs: auditLogsCount
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

const getAuditLogs = async (req, res, next) => {
  try {
    const logs = await db.AuditLogs.find();
    return res.status(200).json({
      success: true,
      data: logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 100)
    });
  } catch (err) {
    next(err);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const users = await db.Users.find();
    const safeUsers = users.map(u => {
      const { password, ...rest } = u;
      return rest;
    });
    return res.status(200).json({ success: true, data: safeUsers });
  } catch (err) {
    next(err);
  }
};

const getWelfareResources = async (req, res, next) => {
  try {
    const resources = await db.WelfareResources.find();
    return res.status(200).json({ success: true, data: resources });
  } catch (err) {
    next(err);
  }
};

const createWelfareResource = async (req, res, next) => {
  try {
    const { title, category, description, contactNumber, helplineHours } = req.body;
    const resource = await db.WelfareResources.create({
      title,
      category,
      description,
      contactNumber,
      helplineHours: helplineHours || '24x7 Available',
      isConfidential: true,
      isActive: true
    });
    return res.status(201).json({ success: true, data: resource });
  } catch (err) {
    next(err);
  }
};

const verifyAuditChain = async (req, res, next) => {
  try {
    const result = await auditService.verifyChain();
    await auditService.log({
      action: 'SECURITY_AUDIT_CHAIN_VERIFIED',
      userId: req.user._id,
      personnelId: req.user.personnelId,
      targetResource: 'AuditLogs',
      outcome: result.verified ? 'SUCCESS' : 'TAMPER_DETECTED',
      ipAddress: req.ip,
      details: { verified: result.verified, totalRecords: result.totalRecords, status: result.status }
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSystemMetrics,
  getAuditLogs,
  getAllUsers,
  getWelfareResources,
  createWelfareResource,
  verifyAuditChain
};

