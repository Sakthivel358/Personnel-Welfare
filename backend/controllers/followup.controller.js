const db = require('../models/dbAdapter');
const auditService = require('../services/audit.service');

const getFollowUps = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === 'PERSONNEL') {
      query.userId = req.user._id;
    }

    const followUps = await db.FollowUps.find(query);
    const users = await db.Users.find();
    const userMap = {};
    users.forEach(u => { userMap[String(u._id)] = u; });

    const enriched = followUps.map(f => {
      const pUser = userMap[String(f.userId)] || {};
      const oUser = userMap[String(f.assignedOfficerId)] || {};
      return {
        ...f,
        personnelName: pUser.fullName || f.personnelId,
        personnelRank: pUser.rank || 'Member',
        officerName: oUser.fullName || 'Welfare Officer'
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

const updateFollowUp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, officerNotes, scheduledDate } = req.body;

    const followUp = await db.FollowUps.findById(id);
    if (!followUp) {
      return res.status(404).json({ success: false, message: 'Follow-up record not found.' });
    }

    const updated = await db.FollowUps.findByIdAndUpdate(id, {
      status: status || followUp.status,
      officerNotes: officerNotes || followUp.officerNotes,
      scheduledDate: scheduledDate || followUp.scheduledDate
    });

    await auditService.log({
      action: 'FOLLOWUP_UPDATED',
      userId: req.user._id,
      personnelId: followUp.personnelId,
      targetResource: 'FollowUps',
      ipAddress: req.ip,
      details: { status: updated.status }
    });

    return res.status(200).json({
      success: true,
      message: 'Follow-up record updated successfully.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

const getRecoveryJourney = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const checkIns = await db.CheckIns.find({ userId });
    const predictions = await db.Predictions.find({ userId });
    const alerts = await db.Alerts.find({ userId });
    const followUps = await db.FollowUps.find({ userId });
    const supportRequests = await db.SupportRequests.find({ userId });

    const latestCheckIn = checkIns.length > 0 ? checkIns[checkIns.length - 1] : null;
    const latestPred = predictions.length > 0 ? predictions[predictions.length - 1] : null;
    const latestAlert = alerts.length > 0 ? alerts[alerts.length - 1] : null;
    const latestFollowUp = followUps.length > 0 ? followUps[followUps.length - 1] : null;
    const latestSupport = supportRequests.length > 0 ? supportRequests[supportRequests.length - 1] : null;

    const stages = [
      {
        step: 1,
        key: 'CONCERN_IDENTIFIED',
        title: '1. Welfare Concern Identified',
        status: latestPred ? 'COMPLETED' : 'PENDING',
        date: latestPred ? (latestPred.analyzedAt || latestPred.createdAt) : null,
        description: latestPred
          ? `Random Forest model identified ${latestPred.concernLevel} concern level (${Math.round(latestPred.compositeRiskScore)}% risk index).`
          : 'Pending initial check-in submission.',
        details: latestPred ? { topDrivers: latestPred.topDrivers, concernLevel: latestPred.concernLevel } : null
      },
      {
        step: 2,
        key: 'RECOMMENDATIONS_FORMULATED',
        title: '2. Actionable Guidance Generated',
        status: latestPred ? 'COMPLETED' : 'PENDING',
        date: latestPred ? latestPred.createdAt : null,
        description: latestPred
          ? 'Personalized rest, duty balancing, and peer support recommendations formulated.'
          : 'Pending model factor decomposition.',
        details: null
      },
      {
        step: 3,
        key: 'SUPPORT_CONNECTED',
        title: '3. Support Pathway Connected',
        status: latestSupport || latestAlert ? 'COMPLETED' : 'OPTIONAL',
        date: latestSupport ? latestSupport.createdAt : (latestAlert ? latestAlert.createdAt : null),
        description: latestSupport
          ? `Confidential support request submitted (Ref: ${latestSupport.referenceId || latestSupport._id.toString().slice(-6).toUpperCase()}).`
          : (latestAlert ? 'Automated welfare decision-support channel activated.' : 'Available via Support tab.'),
        details: latestSupport ? { requestType: latestSupport.requestType, status: latestSupport.status } : null
      },
      {
        step: 4,
        key: 'HUMAN_REVIEW',
        title: '4. Human-in-the-Loop Officer Review',
        status: latestAlert && latestAlert.status !== 'PENDING_REVIEW' ? 'COMPLETED' : (latestAlert ? 'IN_PROGRESS' : 'PENDING'),
        date: latestAlert ? latestAlert.reviewedAt : null,
        description: latestAlert && latestAlert.status !== 'PENDING_REVIEW'
          ? `Unit Welfare Officer reviewed signal (Status: ${latestAlert.status.replace(/_/g, ' ')}).`
          : (latestAlert ? 'Queued for confidential officer review.' : 'Routine monitoring.'),
        details: latestAlert ? { notes: latestAlert.officerNotes } : null
      },
      {
        step: 5,
        key: 'FOLLOW_UP_SCHEDULED',
        title: '5. Follow-Up Session Scheduled',
        status: latestFollowUp ? 'COMPLETED' : 'PENDING',
        date: latestFollowUp ? latestFollowUp.scheduledDate : null,
        description: latestFollowUp
          ? `Follow-up consultation scheduled for ${new Date(latestFollowUp.scheduledDate).toLocaleDateString()}.`
          : 'Awaiting officer schedule assignment.',
        details: latestFollowUp ? { initialScore: latestFollowUp.initialRiskScore } : null
      },
      {
        step: 6,
        key: 'RE_ANALYSIS_COMPLETED',
        title: '6. Subsequent Check-in & Re-Analysis',
        status: checkIns.length >= 2 ? 'COMPLETED' : (latestFollowUp ? 'PENDING' : 'NOT_STARTED'),
        date: checkIns.length >= 2 ? (latestCheckIn.checkInDate || latestCheckIn.createdAt) : null,
        description: checkIns.length >= 2
          ? `New check-in processed. Observed trajectory: ${latestFollowUp?.welfareDelta || 'UPDATED'}.`
          : 'Pending subsequent check-in cycle.',
        details: latestFollowUp ? { delta: latestFollowUp.welfareDelta, newScore: latestFollowUp.reAnalyzedRiskScore } : null
      }
    ];

    return res.status(200).json({
      success: true,
      data: {
        totalCheckIns: checkIns.length,
        currentStageIndex: stages.filter(s => s.status === 'COMPLETED').length,
        stages
      }
    });
  } catch (err) {
    next(err);
  }
};

const simulateOfficerReview = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const predictions = await db.Predictions.find({ userId });
    const latestPred = predictions.length > 0 ? predictions[predictions.length - 1] : null;

    let alert = (await db.Alerts.find({ userId })).pop();
    if (!alert) {
      alert = await db.Alerts.create({
        userId: req.user._id,
        personnelId: req.user.personnelId,
        concernLevel: latestPred?.concernLevel || 'MODERATE',
        compositeRiskScore: latestPred?.compositeRiskScore || 58,
        priority: latestPred?.concernLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
        status: 'PENDING_REVIEW',
        reasons: latestPred?.topDrivers || ['Operational duty hours', 'Rest deficit']
      });
    }

    // Mark alert reviewed
    await db.Alerts.findByIdAndUpdate(alert._id, {
      status: 'FOLLOW_UP_ASSIGNED',
      officerNotes: 'Confidential assessment completed by Unit Welfare Officer. Supportive duty pacing and rest intervals coordinated.',
      reviewedAt: new Date().toISOString()
    });

    // Create / Update FollowUp
    let followUp = (await db.FollowUps.find({ userId })).pop();
    if (!followUp) {
      followUp = await db.FollowUps.create({
        alertId: alert._id,
        userId: req.user._id,
        personnelId: req.user.personnelId,
        status: 'SCHEDULED',
        scheduledDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        initialRiskScore: latestPred ? Math.round(latestPred.compositeRiskScore) : 65,
        reAnalyzedRiskScore: null,
        welfareDelta: 'PENDING_DATA',
        officerNotes: 'Scheduled follow-up consultation with Unit Welfare Officer to review sleep and workload modulation.'
      });
    } else {
      await db.FollowUps.findByIdAndUpdate(followUp._id, {
        status: 'SCHEDULED',
        scheduledDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        officerNotes: 'Follow-up consultation confirmed by Unit Welfare Officer.'
      });
    }

    // Send Notification
    await db.Notifications.create({
      userId: req.user._id,
      title: 'Human Review & Follow-up Scheduled',
      message: 'Your Unit Welfare Officer has completed the confidential review and scheduled a follow-up consultation.',
      type: 'SUPPORT_UPDATE',
      link: '/recovery-journey.html'
    });

    await auditService.log({
      action: 'SIMULATE_OFFICER_REVIEW',
      userId: req.user._id,
      personnelId: req.user.personnelId,
      targetResource: 'FollowUps',
      ipAddress: req.ip,
      details: { followUpId: followUp._id }
    });

    return res.status(200).json({
      success: true,
      message: 'Officer review and follow-up session successfully simulated and scheduled.',
      data: { alert, followUp }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getFollowUps, updateFollowUp, getRecoveryJourney, simulateOfficerReview };
