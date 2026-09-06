const db = require('../models/dbAdapter');
const auditService = require('../services/audit.service');

const getOfficerDashboard = async (req, res, next) => {
  try {
    const personnel = await db.Personnel.find();
    const alerts = await db.Alerts.find();
    const followUps = await db.FollowUps.find();
    const predictions = await db.Predictions.find();

    // Group current risk distribution
    const latestPredMap = {};
    predictions.forEach(p => {
      latestPredMap[String(p.userId)] = p;
    });

    let highCount = 0;
    let modCount = 0;
    let lowCount = 0;

    Object.values(latestPredMap).forEach(p => {
      if (p.concernLevel === 'HIGH') highCount++;
      else if (p.concernLevel === 'MODERATE') modCount++;
      else lowCount++;
    });

    const pendingAlerts = alerts.filter(a => a.status === 'PENDING_REVIEW' || a.status === 'ACKNOWLEDGED');
    const activeFollowUps = followUps.filter(f => f.status === 'SCHEDULED' || f.status === 'IN_PROGRESS');

    return res.status(200).json({
      success: true,
      data: {
        totalMonitoredPersonnel: personnel.length,
        riskDistribution: {
          HIGH: highCount,
          MODERATE: modCount,
          LOW: lowCount,
          UNASSESSED: Math.max(0, personnel.length - Object.keys(latestPredMap).length)
        },
        alertsCount: {
          total: alerts.length,
          pending: pendingAlerts.length,
          critical: alerts.filter(a => a.priority === 'CRITICAL' && a.status === 'PENDING_REVIEW').length
        },
        followUpsCount: {
          total: followUps.length,
          active: activeFollowUps.length,
          resolved: followUps.filter(f => f.status === 'RESOLVED').length
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

const getAlerts = async (req, res, next) => {
  try {
    const { status, priority } = req.query;
    let query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const alerts = await db.Alerts.find(query);
    const users = await db.Users.find();
    const userMap = {};
    users.forEach(u => { userMap[String(u._id)] = u; });

    const enriched = alerts.map(a => {
      const u = userMap[String(a.userId)] || {};
      return {
        ...a,
        personnelName: u.fullName || 'Personnel Member',
        unit: u.unit || 'CRPF Battalion 104',
        rank: u.rank || 'Constable'
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({
      success: true,
      data: enriched
    });
  } catch (err) {
    next(err);
  }
};

const reviewAlert = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const { status, officerNotes, assignFollowUp, scheduledDate } = req.body;

    const alert = await db.Alerts.findById(alertId);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Welfare alert record not found.' });
    }

    const updatedAlert = await db.Alerts.findByIdAndUpdate(alertId, {
      status: status || 'ACKNOWLEDGED',
      officerNotes: officerNotes || alert.officerNotes,
      reviewedBy: req.user._id,
      reviewedAt: new Date().toISOString()
    });

    let createdFollowUp = null;
    if (assignFollowUp) {
      createdFollowUp = await db.FollowUps.create({
        alertId: alert._id,
        userId: alert.userId,
        personnelId: alert.personnelId,
        assignedOfficerId: req.user._id,
        status: 'SCHEDULED',
        scheduledDate: scheduledDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        initialRiskScore: alert.compositeRiskScore || 70,
        reAnalyzedRiskScore: null,
        welfareDelta: 'PENDING_DATA',
        officerNotes: officerNotes || 'Routine welfare review scheduled.'
      });

      // Notify personnel
      await db.Notifications.create({
        userId: alert.userId,
        title: 'Welfare Follow-up Scheduled',
        message: `Your Unit Welfare Officer has scheduled a supportive follow-up session. Please check your schedule.`,
        type: 'SUPPORT_UPDATE',
        link: '/support.html'
      });
    }

    await auditService.log({
      action: 'ALERT_REVIEWED',
      userId: req.user._id,
      personnelId: alert.personnelId,
      targetResource: 'Alerts',
      ipAddress: req.ip,
      details: { newStatus: status, followUpAssigned: !!assignFollowUp }
    });

    return res.status(200).json({
      success: true,
      message: 'Human-in-the-loop alert review recorded successfully.',
      data: {
        alert: updatedAlert,
        followUp: createdFollowUp
      }
    });
  } catch (err) {
    next(err);
  }
};

const getPersonnelList = async (req, res, next) => {
  try {
    const personnel = await db.Personnel.find();
    const users = await db.Users.find();
    const predictions = await db.Predictions.find();

    const predMap = {};
    predictions.forEach(p => { predMap[String(p.userId)] = p; });

    const userMap = {};
    users.forEach(u => { userMap[String(u._id)] = u; });

    const list = personnel.map(p => {
      const u = userMap[String(p.userId)] || {};
      const latestPred = predMap[String(p.userId)] || null;
      return {
        _id: p._id,
        userId: p.userId,
        personnelId: p.personnelId,
        fullName: p.fullName || u.fullName,
        rank: p.rank || u.rank,
        unit: p.unit || u.unit,
        deploymentZone: p.deploymentZone,
        yearsOfService: p.yearsOfService,
        dutyType: p.dutyType,
        latestConcernLevel: latestPred ? latestPred.concernLevel : 'UNASSESSED',
        latestRiskScore: latestPred ? latestPred.compositeRiskScore : 0,
        lastAnalyzedAt: latestPred ? latestPred.analyzedAt : null
      };
    });

    return res.status(200).json({
      success: true,
      data: list
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getOfficerDashboard, getAlerts, reviewAlert, getPersonnelList };
