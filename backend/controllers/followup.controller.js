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
    const { status, officerNotes, scheduledDate, outcome, welfareDelta } = req.body;

    const followUp = await db.FollowUps.findById(id);
    if (!followUp) {
      return res.status(404).json({ success: false, message: 'Follow-up record not found.' });
    }

    const updateFields = {
      status: status || followUp.status,
      officerNotes: officerNotes || followUp.officerNotes,
      scheduledDate: scheduledDate || followUp.scheduledDate
    };

    if (outcome) {
      updateFields.outcome = outcome;
      updateFields.outcomeDate = new Date().toISOString();
    }
    if (welfareDelta) {
      updateFields.welfareDelta = welfareDelta;
    }

    const updated = await db.FollowUps.findByIdAndUpdate(id, updateFields);

    await auditService.log({
      action: outcome ? 'FOLLOWUP_OUTCOME_RECORDED' : 'FOLLOWUP_UPDATED',
      userId: req.user._id,
      personnelId: followUp.personnelId,
      targetResource: 'FollowUps',
      ipAddress: req.ip,
      details: { status: updated.status, outcome: updated.outcome }
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

    // Complete Closed-Loop Welfare Workflow (9 Connected Transitions)
    const stages = [
      {
        step: 1,
        key: 'CHECKIN_WEARABLE_DATA',
        title: '1. Personnel Check-in / Authorized Wearable Data',
        status: latestCheckIn ? 'COMPLETED' : 'PENDING',
        date: latestCheckIn ? (latestCheckIn.checkInDate || latestCheckIn.createdAt) : null,
        description: latestCheckIn
          ? `Authorized self-assessment and telemetry synchronized (Duty Workload: ${latestCheckIn.workload_hours || '--'} hrs/wk, Sleep: ${latestCheckIn.recovery_sleep_hours || '--'} hrs/day).`
          : 'Pending initial check-in submission or authorized wearable synchronization.',
        details: latestCheckIn ? { workload_hours: latestCheckIn.workload_hours, sleep_hours: latestCheckIn.recovery_sleep_hours } : null
      },
      {
        step: 2,
        key: 'DATA_QUALITY_CHECK',
        title: '2. Data Quality Check',
        status: latestCheckIn ? 'COMPLETED' : 'PENDING',
        date: latestPred ? (latestPred.analyzedAt || latestPred.createdAt) : (latestCheckIn ? latestCheckIn.createdAt : null),
        description: latestPred
          ? `Data quality validation verified (Quality: ${latestPred.dataQuality || 'VERIFIED'}, Missing inputs, stale sensors & biological bounds verified).`
          : 'Awaiting telemetry validation gate check.',
        details: latestPred ? { dataQuality: latestPred.dataQuality, predictionStatus: latestPred.predictionStatus } : null
      },
      {
        step: 3,
        key: 'AI_WELFARE_ANALYSIS',
        title: '3. AI Welfare Analysis',
        status: latestPred && latestPred.concernLevel !== 'UNDETERMINED' ? 'COMPLETED' : (latestPred ? 'INSUFFICIENT_EVIDENCE' : 'PENDING'),
        date: latestPred ? (latestPred.analyzedAt || latestPred.createdAt) : null,
        description: latestPred
          ? `Multi-tier Random Forest inference executed. Model pipeline: ${latestPred.modelUsed || 'Model 1 (Wearable + Operational)'}. Prediction status: ${latestPred.predictionStatus || 'ACTIVE'}.`
          : 'Pending inference execution by machine learning decision layer.',
        details: latestPred ? { concernLevel: latestPred.concernLevel, compositeRiskScore: latestPred.compositeRiskScore } : null
      },
      {
        step: 4,
        key: 'RISK_EVIDENCE_CONTRIBUTORS',
        title: '4. Risk + Evidence + Contributors',
        status: latestPred ? 'COMPLETED' : 'PENDING',
        date: latestPred ? latestPred.createdAt : null,
        description: latestPred
          ? `Welfare Concern: ${latestPred.concernLevel || 'MODERATE'} | Evidence Strength: ${latestPred.evidenceStrength || 'HIGH'} | Main Contributors: ${latestPred.topDrivers && latestPred.topDrivers.length > 0 ? latestPred.topDrivers.join(', ') : 'Duty load, Sleep deficit, Shift pacing'}.`
          : 'Pending attribution decomposition.',
        details: latestPred ? { contributors: latestPred.topDrivers, evidence: latestPred.evidenceStrength } : null
      },
      {
        step: 5,
        key: 'WELFARE_OFFICER_REVIEW',
        title: '5. Welfare Officer Review',
        status: (latestAlert && latestAlert.status !== 'PENDING_REVIEW') || (latestPred && latestPred.humanReview) ? 'COMPLETED' : (latestAlert ? 'IN_PROGRESS' : 'PENDING'),
        date: latestAlert ? (latestAlert.reviewedAt || latestAlert.updatedAt) : (latestPred?.humanReview ? latestPred.humanReview.reviewedAt : null),
        description: (latestAlert && latestAlert.status !== 'PENDING_REVIEW') || (latestPred && latestPred.humanReview)
          ? `Unit Welfare Officer reviewed result (${latestPred?.humanReview?.reviewStatusDisplay || latestAlert?.status?.replace(/_/g, ' ') || 'Reviewed'}). Strictly non-disciplinary.`
          : (latestAlert ? 'Queued for confidential Welfare Officer review.' : 'Routine monitoring by welfare team.'),
        details: latestPred?.humanReview || (latestAlert ? { notes: latestAlert.officerNotes } : null)
      },
      {
        step: 6,
        key: 'SUPPORT_FOLLOW_UP',
        title: '6. Support / Follow-up',
        status: latestFollowUp || latestSupport ? 'COMPLETED' : (latestAlert ? 'IN_PROGRESS' : 'OPTIONAL'),
        date: latestFollowUp ? latestFollowUp.scheduledDate : (latestSupport ? latestSupport.createdAt : null),
        description: latestFollowUp
          ? `Follow-up consultation scheduled (${new Date(latestFollowUp.scheduledDate).toLocaleDateString()}). Support pathway connected.`
          : (latestSupport ? `Confidential support request active (Ref: ${latestSupport.referenceId || latestSupport._id.toString().slice(-6).toUpperCase()}).` : 'Support resources available on demand.'),
        details: latestFollowUp ? { scheduledDate: latestFollowUp.scheduledDate } : null
      },
      {
        step: 7,
        key: 'OUTCOME',
        title: '7. Outcome',
        status: (latestFollowUp && (latestFollowUp.status === 'COMPLETED' || latestFollowUp.status === 'RESOLVED' || latestFollowUp.outcome)) || (latestSupport && latestSupport.status === 'RESOLVED') ? 'COMPLETED' : (latestFollowUp ? 'IN_PROGRESS' : 'PENDING'),
        date: latestFollowUp ? (latestFollowUp.outcomeDate || latestFollowUp.updatedAt) : null,
        description: (latestFollowUp && (latestFollowUp.status === 'COMPLETED' || latestFollowUp.outcome))
          ? `Intervention outcome recorded: ${latestFollowUp.outcome || latestFollowUp.officerNotes || 'Consultation completed. Pacing and recovery balance verified.'}`
          : (latestFollowUp ? 'Follow-up in progress. Awaiting session completion.' : 'Pending scheduled consultation outcome.'),
        details: latestFollowUp ? { outcome: latestFollowUp.outcome } : null
      },
      {
        step: 8,
        key: 'FUTURE_REANALYSIS',
        title: '8. Future Re-analysis',
        status: checkIns.length >= 2 ? 'COMPLETED' : (latestFollowUp ? 'IN_PROGRESS' : 'NOT_STARTED'),
        date: checkIns.length >= 2 ? (latestCheckIn.checkInDate || latestCheckIn.createdAt) : null,
        description: checkIns.length >= 2
          ? `Subsequent check-in evaluated against personal baseline. Observed trajectory: ${latestFollowUp?.welfareDelta || 'STABILIZED / IMPROVED'}.`
          : 'Pending subsequent check-in cycle to establish recovery trajectory.',
        details: latestFollowUp ? { delta: latestFollowUp.welfareDelta } : null
      },
      {
        step: 9,
        key: 'UPDATED_WELFARE_GUIDANCE',
        title: '9. Updated Welfare Guidance',
        status: latestPred ? 'COMPLETED' : 'PENDING',
        date: latestPred ? latestPred.createdAt : null,
        description: latestPred
          ? 'Personalized rest intervals, shift rotation adjustments, and restorative guidance dynamically updated.'
          : 'Pending active guidance synthesis.',
        details: null
      }
    ];

    return res.status(200).json({
      success: true,
      data: {
        totalCheckIns: checkIns.length,
        totalStages: 9,
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
    if (predictions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot schedule follow-up without an existing welfare check-in assessment.'
      });
    }
    const latestPred = predictions[predictions.length - 1];

    let alert = (await db.Alerts.find({ userId })).pop();
    if (!alert) {
      alert = await db.Alerts.create({
        userId: req.user._id,
        personnelId: req.user.personnelId,
        concernLevel: latestPred.concernLevel,
        compositeRiskScore: Math.round(latestPred.compositeRiskScore != null ? latestPred.compositeRiskScore : 0),
        priority: latestPred.concernLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
        status: 'PENDING_REVIEW',
        reasons: latestPred.topDrivers || ['Operational duty hours', 'Rest deficit']
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
        initialRiskScore: Math.round(latestPred.compositeRiskScore != null ? latestPred.compositeRiskScore : 0),
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
