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
    if (req.user) {
      await auditService.log({
        action: 'SENSITIVE_RECORD_ACCESS',
        userId: req.user._id,
        personnelId: req.user.personnelId,
        targetResource: 'AuditLogs',
        outcome: 'SUCCESS',
        ipAddress: req.ip,
        details: { recordType: 'SYSTEM_AUDIT_TRAIL', returnedCount: Math.min(logs.length, 100) }
      });
    }
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
    if (req.user) {
      await auditService.log({
        action: 'SENSITIVE_RECORD_ACCESS',
        userId: req.user._id,
        personnelId: req.user.personnelId,
        targetResource: 'Users',
        outcome: 'SUCCESS',
        ipAddress: req.ip,
        details: { recordType: 'USER_DIRECTORY', totalUsers: users.length }
      });
    }
    return res.status(200).json({ success: true, data: safeUsers });
  } catch (err) {
    next(err);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const allowedRoles = ['PERSONNEL', 'WELFARE_OFFICER', 'ADMIN'];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role specified. Allowed roles: ${allowedRoles.join(', ')}`
      });
    }

    const user = await db.Users.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.'
      });
    }

    const previousRole = user.role;
    const updatedUser = await db.Users.findByIdAndUpdate(id, { role });

    await auditService.log({
      action: 'ROLE_PERMISSION_CHANGE',
      userId: req.user._id,
      personnelId: user.personnelId,
      targetResource: `User:${id}`,
      outcome: 'SUCCESS',
      ipAddress: req.ip,
      details: {
        targetUserId: id,
        targetPersonnelId: user.personnelId,
        previousRole,
        newRole: role,
        changedBy: req.user.role
      }
    });

    const { password, ...safeUser } = updatedUser;
    return res.status(200).json({
      success: true,
      message: `User role updated from ${previousRole} to ${role}.`,
      data: safeUser
    });
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

    if (req.user) {
      await auditService.log({
        action: 'ADMIN_RESOURCE_CREATED',
        userId: req.user._id,
        personnelId: req.user.personnelId,
        targetResource: 'WelfareResources',
        outcome: 'SUCCESS',
        ipAddress: req.ip,
        details: { title, category, resourceId: resource._id }
      });
    }

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
  updateUserRole,
  getWelfareResources,
  createWelfareResource,
  verifyAuditChain
};

