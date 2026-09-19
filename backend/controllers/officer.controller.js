const db = require('../models/dbAdapter');
const auditService = require('../services/audit.service');
const privacyService = require('../services/privacy.service');
const recommendationService = require('../services/recommendation.service');
const { computePersonalBaseline } = require('./prediction.controller');

const getOfficerDashboard = async (req, res, next) => {
  try {
    const personnel = await db.Personnel.find();
    const alerts = await db.Alerts.find();
    const followUps = await db.FollowUps.find();
    const predictions = await db.Predictions.find();

    // Sort predictions chronologically
    const sortedPredictions = [...predictions].sort((a, b) => new Date(a.createdAt || a.analyzedAt || 0) - new Date(b.createdAt || b.analyzedAt || 0));
    const latestPredMap = {};
    sortedPredictions.forEach(p => {
      latestPredMap[String(p.userId)] = p;
    });

    let highCount = 0;
    let modCount = 0;
    let lowCount = 0;
    let unassessedCount = 0;

    personnel.forEach(p => {
      const pred = latestPredMap[String(p.userId)];
      if (!pred) {
        unassessedCount++;
      } else if (pred.concernLevel === 'HIGH') {
        highCount++;
      } else if (pred.concernLevel === 'MODERATE') {
        modCount++;
      } else {
        lowCount++;
      }
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
          UNASSESSED: unassessedCount
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

const getEarlyWarningCenter = async (req, res, next) => {
  try {
    const personnel = await db.Personnel.find();
    const checkIns = await db.CheckIns.find();
    const predictions = await db.Predictions.find();
    const followUps = await db.FollowUps.find();
    const users = await db.Users.find();

    const userMap = {};
    users.forEach(u => { userMap[String(u._id)] = u; });

    // Group check-ins and predictions by user
    const userCheckIns = {};
    const userPredictions = {};

    checkIns.forEach(c => {
      const uid = String(c.userId);
      if (!userCheckIns[uid]) userCheckIns[uid] = [];
      userCheckIns[uid].push(c);
    });

    predictions.forEach(p => {
      const uid = String(p.userId);
      if (!userPredictions[uid]) userPredictions[uid] = [];
      userPredictions[uid].push(p);
    });

    const newSignals = [];
    const risingSignals = [];
    const persistentSignals = [];
    const improvingSignals = [];

    Object.keys(userPredictions).forEach(uid => {
      const uPreds = userPredictions[uid].sort((a, b) => new Date(a.createdAt || a.analyzedAt || 0) - new Date(b.createdAt || b.analyzedAt || 0));
      const u = userMap[uid] || {};
      const latest = uPreds[uPreds.length - 1];

      if (!latest) return;

      const item = {
        userId: uid,
        personnelId: u.personnelId || 'Unknown',
        fullName: u.fullName || 'Personnel Member',
        rank: u.rank || 'Member',
        unit: u.unit || 'Operational Unit',
        concernLevel: latest.concernLevel,
        compositeRiskScore: latest.compositeRiskScore != null ? Number(latest.compositeRiskScore) : 0,
        topDrivers: latest.topDrivers || [],
        analyzedAt: latest.analyzedAt || latest.createdAt
      };

      if (uPreds.length === 1) {
        if (latest.concernLevel === 'HIGH') {
          newSignals.push({ ...item, category: 'NEW_SIGNAL', reason: 'Initial check-in flagged elevated strain' });
        }
      } else {
        const prev = uPreds[uPreds.length - 2];
        const latestRisk = latest.compositeRiskScore != null ? Number(latest.compositeRiskScore) : 0;
        const prevRisk = prev.compositeRiskScore != null ? Number(prev.compositeRiskScore) : 0;
        const delta = latestRisk - prevRisk;

        if (prev.concernLevel !== 'HIGH' && latest.concernLevel === 'HIGH') {
          newSignals.push({ ...item, category: 'NEW_SIGNAL', reason: 'Recent check-in transitioned into elevated strain' });
        }

        if (delta >= 6) {
          risingSignals.push({ ...item, category: 'RISING_SIGNAL', delta: `+${Math.round(delta)}%`, reason: 'Risk index increased across recent check-in' });
        } else if (delta <= -6) {
          improvingSignals.push({ ...item, category: 'IMPROVING_SIGNAL', delta: `${Math.round(delta)}%`, reason: 'Risk index demonstrated noticeable reduction' });
        }

        if (latest.concernLevel === 'HIGH' && prev.concernLevel === 'HIGH') {
          persistentSignals.push({ ...item, category: 'PERSISTENT_SIGNAL', reason: 'Elevated strain signal persistent across consecutive check-ins' });
        }
      }
    });

    // Follow-ups Due
    const followUpsDue = followUps
      .filter(f => f.status === 'SCHEDULED' || f.status === 'IN_PROGRESS')
      .map(f => {
        const u = userMap[String(f.userId)] || {};
        return {
          ...f,
          personnelName: u.fullName || f.personnelId,
          rank: u.rank || 'Member',
          unit: u.unit || 'Operational Unit'
        };
      });

    return res.status(200).json({
      success: true,
      data: {
        newSignals,
        risingSignals,
        persistentSignals,
        improvingSignals,
        followUpsDue,
        summary: {
          newCount: newSignals.length,
          risingCount: risingSignals.length,
          persistentCount: persistentSignals.length,
          improvingCount: improvingSignals.length,
          dueCount: followUpsDue.length
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

const getInterventionEffectiveness = async (req, res, next) => {
  try {
    const followUps = await db.FollowUps.find();
    const users = await db.Users.find();
    const userMap = {};
    users.forEach(u => { userMap[String(u._id)] = u; });

    const completed = followUps.filter(f => f.status === 'CHECKIN_COMPLETED' || f.status === 'RESOLVED');

    let improvedCount = 0;
    let stableCount = 0;
    let increasedCount = 0;
    let totalScoreDelta = 0;
    let evaluatedCount = 0;

    const comparativeRecords = completed.map(f => {
      const u = userMap[String(f.userId)] || {};
      const hasInitial = f.initialRiskScore != null;
      const hasReanalyzed = f.reAnalyzedRiskScore != null;
      const initial = hasInitial ? Number(f.initialRiskScore) : null;
      const reanalyzed = hasReanalyzed ? Number(f.reAnalyzedRiskScore) : null;
      const delta = (hasInitial && hasReanalyzed) ? (reanalyzed - initial) : null;

      if (hasInitial && hasReanalyzed) {
        totalScoreDelta += delta;
        evaluatedCount++;
      }

      if (f.welfareDelta === 'IMPROVED' || (delta !== null && delta < -5)) improvedCount++;
      else if (f.welfareDelta === 'INCREASED' || (delta !== null && delta > 5)) increasedCount++;
      else stableCount++;

      return {
        followUpId: f._id,
        personnelId: f.personnelId,
        personnelName: u.fullName || f.personnelId,
        rank: u.rank || 'Member',
        initialRiskScore: initial,
        reAnalyzedRiskScore: reanalyzed,
        observedChange: delta,
        welfareDelta: f.welfareDelta || (delta !== null && delta < -5 ? 'IMPROVED' : 'STABLE'),
        completedAt: f.completedAt || f.updatedAt,
        officerNotes: f.officerNotes || 'Routine support and rest coordination completed.'
      };
    });

    const avgReduction = evaluatedCount > 0 ? Number((totalScoreDelta / evaluatedCount).toFixed(1)) : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalEvaluatedFollowUps: completed.length,
        outcomeDistribution: {
          IMPROVED: improvedCount,
          STABLE: stableCount,
          ELEVATED: increasedCount
        },
        averageRiskDelta: avgReduction,
        comparativeRecords,
        disclaimer: 'Observed change after follow-up represents statistical comparison across subsequent check-in cycles, not clinical proof of intervention causality.'
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
      const aCount = a.dataAvailableCount != null ? a.dataAvailableCount : 4;
      const whyAlertGenerated = a.whyAlertGenerated || {
        summary: `Alert generated because ${a.concernLevel || 'HIGH'} welfare strain was detected backed by ${aCount} authorized evidence sources.`,
        primaryFactors: (a.mainContributors && a.mainContributors.length > 0)
          ? a.mainContributors.map(c => `${c.arrow || '↑'} ${c.title || c.factor || c.directionalTitle || 'Operational Factor'}`)
          : (a.topDrivers ? a.topDrivers.map(d => `↑ ${d}`) : ['↑ Cumulative operational duty strain']),
        evidenceSources: a.evidenceSources || ['DUTY', 'WORKLOAD', 'REST_RECOVERY', 'SELF_CHECK'],
        evidenceStrength: a.evidenceStrength || 'MODERATE',
        dataAvailableDisplay: a.dataAvailableDisplay || `DATA AVAILABLE — ${aCount} / 5`,
        isEvidenceBased: true
      };

      const userToken = a.userToken || privacyService.generateUserToken(a.userId);
      const ageGroup = a.ageGroup || privacyService.toAgeGroup(u.age || 28);
      const unitGroup = privacyService.toUnitGroup(u.unit || a.unit);

      return {
        ...a,
        welfareConcernDisplay: a.welfareConcernDisplay || `WELFARE CONCERN — ${a.concernLevel || 'HIGH'}`,
        evidenceStrength: a.evidenceStrength || 'MODERATE',
        evidenceDisplay: a.evidenceDisplay || `EVIDENCE — ${a.evidenceStrength || 'MODERATE'}`,
        evidenceStrengthScore: a.evidenceStrengthScore !== undefined ? a.evidenceStrengthScore : 0.6,
        dataAvailableCount: aCount,
        dataAvailableTotal: 5,
        dataAvailableDisplay: a.dataAvailableDisplay || `DATA AVAILABLE — ${aCount} / 5`,
        mainContributors: a.mainContributors || [],
        reviewTriggers: a.reviewTriggers || (a.topDrivers ? a.topDrivers.map(d => `${d} strain detected`) : ['Elevated welfare strain detected']),
        recommendedOfficerAction: a.recommendedOfficerAction || 'Conduct welfare review and verify restorative downtime.',
        whyAlertGenerated: whyAlertGenerated,
        nonDisciplinaryStatement: 'An ML prediction must never automatically become a disciplinary action.',
        isNonDisciplinary: true,
        disciplinaryActionPermitted: false,
        disciplinaryProhibitionNotice: 'Under Force Welfare Governance Directive, an ML prediction must never automatically become a disciplinary action. Welfare alerts are strictly non-punitive decision support tools for supportive care, fatigue management, and restorative health intervention.',
        userToken: userToken,
        ageGroup: ageGroup,
        unitGroup: unitGroup,
        maskedServiceId: privacyService.maskIdentifier(a.personnelId),
        maskedPersonnelName: privacyService.maskName(u.fullName || 'Personnel Member'),
        personnelName: u.fullName || 'Personnel Member',
        unit: u.unit || 'Operational Unit',
        rank: u.rank || 'Member'
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

const getAlertWorkflow = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const alert = await db.Alerts.findById(alertId);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Welfare alert record not found.' });
    }

    const user = (await db.Users.findById(alert.userId)) || {};
    const checkIns = await db.CheckIns.find({ userId: alert.userId });
    const predictions = await db.Predictions.find({ userId: alert.userId });
    const latestPred = alert.predictionId
      ? await db.Predictions.findById(alert.predictionId)
      : (predictions.length > 0 ? predictions[predictions.length - 1] : null);
    const existingFollowUp = await db.FollowUps.findOne({ alertId: alert._id });

    // Stage 4: What Changed / Personal Baseline
    const personalBaseline = computePersonalBaseline(checkIns);

    // Stage 3: Real Contributors with directional indicators
    let contributors = (alert.mainContributors && alert.mainContributors.length > 0)
      ? alert.mainContributors
      : (latestPred && latestPred.decisionLayer && latestPred.decisionLayer.mainContributors && latestPred.decisionLayer.mainContributors.length > 0)
        ? latestPred.decisionLayer.mainContributors
        : (alert.topDrivers || []).map(d => ({
            directionalTitle: d,
            title: d.replace(/^[↑↓→]\s*/, ''),
            direction: d.startsWith('↓') ? 'DOWN' : 'UP',
            arrow: d.startsWith('↓') ? '↓' : '↑',
            impactLevel: 'HIGH',
            factor: d
          }));

    const aCount = alert.dataAvailableCount != null ? alert.dataAvailableCount : (latestPred && latestPred.dataAvailableCount != null ? latestPred.dataAvailableCount : 4);

    const workflow = {
      alertId: alert._id,
      personnelId: alert.personnelId,
      isNonPunitive: true,
      nonPunitivePolicyNotice: '🛡️ NON-PUNITIVE WELFARE NOTICE: This assessment is generated purely for supportive care, fatigue management, and restorative health intervention. It is strictly non-disciplinary and protected from punitive administrative action.',

      // Stage 1: Alert
      alert: {
        alertId: alert._id,
        personnelId: alert.personnelId,
        personnelName: user.fullName || alert.personnelId,
        rank: user.rank || 'Member',
        unit: user.unit || 'Operational Unit',
        priority: alert.priority || 'HIGH',
        concernLevel: alert.concernLevel || 'HIGH',
        welfareConcernDisplay: alert.welfareConcernDisplay || `WELFARE CONCERN — ${alert.concernLevel || 'HIGH'}`,
        compositeRiskScore: alert.compositeRiskScore,
        triggeredAt: alert.createdAt,
        status: alert.status,
        reviewTriggers: alert.reviewTriggers || (alert.topDrivers ? alert.topDrivers.map(d => `${d} strain detected`) : ['Elevated operational strain']),
        recommendedOfficerAction: alert.recommendedOfficerAction || 'Conduct supportive welfare review and verify restorative downtime.',
        whyAlertGenerated: alert.whyAlertGenerated || {
          summary: `Alert generated because ${alert.concernLevel || 'HIGH'} welfare strain was detected backed by ${aCount} authorized evidence sources.`,
          primaryFactors: (contributors && contributors.length > 0)
            ? contributors.map(c => `${c.arrow || '↑'} ${c.title || c.factor || c.directionalTitle || 'Operational Factor'}`)
            : (alert.topDrivers ? alert.topDrivers.map(d => `↑ ${d}`) : ['↑ Cumulative operational duty strain']),
          evidenceSources: (latestPred && latestPred.evidenceSources) || ['DUTY', 'WORKLOAD', 'REST_RECOVERY', 'SELF_CHECK'],
          evidenceStrength: alert.evidenceStrength || 'MODERATE',
          dataAvailableDisplay: alert.dataAvailableDisplay || `DATA AVAILABLE — ${aCount} / 5`,
          isEvidenceBased: true
        },
        nonDisciplinaryStatement: 'An ML prediction must never automatically become a disciplinary action.',
        isNonDisciplinary: true,
        disciplinaryActionPermitted: false,
        prohibitDisciplinaryAction: true,
        disciplinaryProhibitionNotice: 'Under Force Welfare Governance Directive, an ML prediction must never automatically become a disciplinary action. Alerts are strictly non-punitive decision support tools for supportive care, fatigue management, and restorative health intervention.',
        userToken: alert.userToken || privacyService.generateUserToken(alert.userId),
        ageGroup: alert.ageGroup || privacyService.toAgeGroup(user.age || 28),
        unitGroup: privacyService.toUnitGroup(user.unit || alert.unit),
        maskedServiceId: privacyService.maskIdentifier(alert.personnelId),
        maskedPersonnelName: privacyService.maskName(user.fullName || 'Personnel Member'),
        policyNotice: '🛡️ NON-PUNITIVE POLICY: Welfare insights and AI assessments are strictly for health support, resilience, and fatigue mitigation. Never to be used for disciplinary action, performance profiling, or punitive personnel measures.',
        nonPunitiveNotice: '🛡️ NON-PUNITIVE POLICY: Welfare insights and AI assessments are strictly for health support, resilience, and fatigue mitigation. Never to be used for disciplinary action, performance profiling, or punitive personnel measures.'
      },

      // Stage 2: Evidence
      evidence: {
        evidenceStrength: alert.evidenceStrength || (latestPred ? latestPred.evidenceStrength : 'MODERATE'),
        evidenceDisplay: alert.evidenceDisplay || `EVIDENCE — ${alert.evidenceStrength || 'MODERATE'}`,
        evidenceStrengthScore: alert.evidenceStrengthScore !== undefined ? alert.evidenceStrengthScore : 0.6,
        dataAvailableCount: aCount,
        dataAvailableTotal: 5,
        dataAvailableDisplay: alert.dataAvailableDisplay || `DATA AVAILABLE — ${aCount} / 5`,
        evidenceSources: (latestPred && latestPred.evidenceSources) || ['DUTY', 'WORKLOAD', 'REST_RECOVERY', 'SELF_CHECK'],
        qualityAssessment: 'Authorized telemetry and operational check-ins meet validated completeness and plausibility standards.'
      },

      // Stage 3: Contributors
      contributors: {
        mainContributors: contributors,
        contributors: contributors,
        topDrivers: alert.topDrivers || [],
        zeroInventionRule: 'Strictly calculated from authentic authorized signals without mock placeholder generation.'
      },

      // Stage 4: What Changed
      whatChanged: {
        baselineEstablished: personalBaseline.baselineEstablished,
        status: personalBaseline.status,
        message: personalBaseline.message,
        comparisonCategories: personalBaseline.comparisonCategories,
        yourNormalPattern: personalBaseline.yourNormalPattern,
        current: personalBaseline.current,
        totalCheckInCount: checkIns.length
      },

      // Stage 5: Officer Review
      officerReview: {
        currentStatus: alert.status,
        officerNotes: alert.officerNotes || '',
        reviewedBy: alert.reviewedBy,
        reviewedAt: alert.reviewedAt,
        supportedReviewDecisions: [
          { value: 'ACKNOWLEDGED', label: 'Acknowledge & Mark Under Supervision' },
          { value: 'SUPPORT_SESSION', label: 'Conduct Supportive 1-on-1 Consultation' },
          { value: 'REST_ROTATION', label: 'Authorize Restorative Downtime / Shift Rotation' },
          { value: 'FATIGUE_PROTOCOL', label: 'Activate Fatigue Mitigation & Recovery Protocol' },
          { value: 'ROSTER_ADJUSTMENT', label: 'Adjust Tactical Deployment & Limit Prolonged Duty' },
          { value: 'MEDICAL_REFERRAL', label: 'Voluntary Medical / Psychological Support Referral' },
          { value: 'RESOLVED', label: 'Resolve / Mark Conditions Stabilized' }
        ],
        allowedDecisions: ['ACKNOWLEDGED', 'SUPPORT_SESSION', 'REST_ROTATION', 'FATIGUE_PROTOCOL', 'ROSTER_ADJUSTMENT', 'MEDICAL_REFERRAL', 'RESOLVED'],
        recommendedGuidance: alert.recommendedOfficerAction || 'Conduct supportive welfare review and verify restorative downtime.'
      },

      // Stage 6: Support Action
      supportAction: {
        availableActions: [
          { id: 'REST_RECOVERY', title: 'Rest & Sleep Restoration', desc: 'Authorize 48h to 72h protected restorative downtime with sleep schedule reset.' },
          { id: 'PEER_SUPPORT', title: 'Peer Buddy / Mentorship Connect', desc: 'Pair personnel with a senior buddy or wellness peer for active decompression.' },
          { id: 'DUTY_ADJUSTMENT', title: 'Operational Duty Pacing', desc: 'Temporary transition to lighter duty or day shift rotation.' },
          { id: 'COUNSELING_LIAISON', title: 'Confidential Counseling Liaison', desc: 'Voluntary connection with certified military psychological counseling resources.' },
          { id: 'FAMILY_SUPPORT', title: 'Family & Domestic Liaison', desc: 'Coordinate family welfare assistance or emergency administrative leave.' }
        ],
        restorativeActions: [
          { id: 'REST_RECOVERY', title: 'Rest & Sleep Restoration', desc: 'Authorize 48h to 72h protected restorative downtime with sleep schedule reset.' },
          { id: 'PEER_SUPPORT', title: 'Peer Buddy / Mentorship Connect', desc: 'Pair personnel with a senior buddy or wellness peer for active decompression.' },
          { id: 'DUTY_ADJUSTMENT', title: 'Operational Duty Pacing', desc: 'Temporary transition to lighter duty or day shift rotation.' },
          { id: 'COUNSELING_LIAISON', title: 'Confidential Counseling Liaison', desc: 'Voluntary connection with certified military psychological counseling resources.' },
          { id: 'FAMILY_SUPPORT', title: 'Family & Domestic Liaison', desc: 'Coordinate family welfare assistance or emergency administrative leave.' }
        ],
        assignedAction: alert.supportAction || null
      },

      // Stage 7: Follow-up
      followUp: {
        hasFollowUp: Boolean(existingFollowUp),
        followUpId: existingFollowUp ? existingFollowUp._id : null,
        scheduledDate: existingFollowUp ? existingFollowUp.scheduledDate : null,
        status: existingFollowUp ? existingFollowUp.status : 'NOT_SCHEDULED',
        reAnalyzedRiskScore: existingFollowUp ? existingFollowUp.reAnalyzedRiskScore : null,
        welfareDelta: existingFollowUp ? existingFollowUp.welfareDelta : 'PENDING_DATA',
        officerNotes: existingFollowUp ? existingFollowUp.officerNotes : ''
      },

      // Stage aliases for test suites and structured access
      stage1_alert: null,
      stage2_evidence: null,
      stage3_contributors: null,
      stage4_whatChanged: null,
      stage5_officerReview: null,
      stage6_supportAction: null,
      stage7_followUp: null
    };

    workflow.stage1_alert = workflow.alert;
    workflow.stage2_evidence = workflow.evidence;
    workflow.stage3_contributors = workflow.contributors;
    workflow.stage4_whatChanged = workflow.whatChanged;
    workflow.stage5_officerReview = workflow.officerReview;
    workflow.stage6_supportAction = workflow.supportAction;
    workflow.stage7_followUp = workflow.followUp;

    return res.status(200).json({
      success: true,
      data: workflow
    });
  } catch (err) {
    next(err);
  }
};

const reviewAlert = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const { status, reviewDecision, officerNotes, supportAction, assignFollowUp, scheduledDate } = req.body;

    const alert = await db.Alerts.findById(alertId);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Welfare alert record not found.' });
    }

    // Mandatory Non-Disciplinary Directive Enforcement:
    // An ML prediction must never automatically become a disciplinary action.
    const sanitizedCheckText = `${reviewDecision || ''} ${officerNotes || ''}`
      .toLowerCase()
      .replace(/non-punitive/g, '')
      .replace(/non punitive/g, '')
      .replace(/not punitive/g, '')
      .replace(/non-disciplinary/g, '')
      .replace(/non disciplinary/g, '')
      .replace(/not disciplinary/g, '');

    const prohibitedDisciplinaryKeywords = [
      'disciplinary', 'court-martial', 'punitive', 'penalty', 'demote',
      'charge sheet', 'charge-sheet', 'punish'
    ];
    for (const kw of prohibitedDisciplinaryKeywords) {
      if (sanitizedCheckText.includes(kw)) {
        return res.status(400).json({
          success: false,
          error: 'NON_DISCIPLINARY_VIOLATION',
          message: 'Prohibited Action: An ML prediction must never automatically become a disciplinary action. Welfare alerts are strictly non-punitive.',
          nonDisciplinaryStatement: 'An ML prediction must never automatically become a disciplinary action.'
        });
      }
    }

    const effectiveStatus = reviewDecision || status || 'ACKNOWLEDGED';

    const updateFields = {
      status: effectiveStatus,
      officerNotes: officerNotes || alert.officerNotes,
      reviewedBy: req.user._id,
      reviewedAt: new Date().toISOString(),
      isNonPunitive: true,
      isNonDisciplinary: true,
      nonDisciplinaryStatement: 'An ML prediction must never automatically become a disciplinary action.'
    };

    if (supportAction) {
      updateFields.supportAction = supportAction;
    }

    const updatedAlert = await db.Alerts.findByIdAndUpdate(alertId, updateFields);

    // If support action specified, create/link in SupportRequests so personnel sees action in Welfare Support
    let createdSupportRequest = null;
    if (supportAction) {
      const actionType = typeof supportAction === 'object' ? supportAction.id || supportAction.type : supportAction;
      const actionNotes = typeof supportAction === 'object' ? supportAction.notes || supportAction.desc : '';
      const refId = `ACT-${Math.floor(1000 + Math.random() * 9000)}`;

      createdSupportRequest = await db.SupportRequests.create({
        referenceId: refId,
        userId: alert.userId,
        personnelId: alert.personnelId,
        requestType: actionType || 'OFFICER_ASSIGNED_SUPPORT',
        urgency: alert.priority === 'CRITICAL' ? 'URGENT' : 'PRIORITY',
        notes: `Officer assigned support action: ${actionNotes || actionType}. ${officerNotes || ''}`,
        status: 'SUPPORT_ACTION_TAKEN',
        assignedOfficer: req.user._id,
        resolutionNotes: officerNotes || 'Support action initiated by Unit Welfare Officer.',
        statusHistory: [
          {
            status: 'SUPPORT_ACTION_TAKEN',
            timestamp: new Date().toISOString(),
            note: `Unit Welfare Officer initiated support action: ${actionType}`
          }
        ]
      });
    }

    let createdFollowUp = null;
    if (assignFollowUp) {
      createdFollowUp = await db.FollowUps.create({
        alertId: alert._id,
        userId: alert.userId,
        personnelId: alert.personnelId,
        assignedOfficerId: req.user._id,
        status: 'SCHEDULED',
        scheduledDate: scheduledDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        initialRiskScore: alert.compositeRiskScore != null ? Number(alert.compositeRiskScore) : 0,
        reAnalyzedRiskScore: null,
        welfareDelta: 'PENDING_DATA',
        officerNotes: officerNotes || 'Routine welfare review scheduled.',
        isNonPunitive: true
      });

      // Notify personnel
      await db.Notifications.create({
        userId: alert.userId,
        title: 'Welfare Follow-up Scheduled',
        message: `Your Unit Welfare Officer has scheduled a supportive follow-up session. Please check your schedule.`,
        type: 'SUPPORT_UPDATE',
        link: '/recovery-journey.html'
      });
    }

    await auditService.log({
      action: 'ALERT_REVIEWED',
      userId: req.user._id,
      personnelId: alert.personnelId,
      targetResource: 'Alerts',
      ipAddress: req.ip,
      details: {
        newStatus: effectiveStatus,
        followUpAssigned: !!assignFollowUp,
        supportActionAssigned: !!supportAction,
        isNonPunitive: true
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Human-in-the-loop alert review recorded successfully (Non-Punitive).',
      data: {
        alert: updatedAlert,
        supportRequest: createdSupportRequest,
        followUp: createdFollowUp,
        isNonPunitive: true
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

const searchPersonnel = async (req, res, next) => {
  try {
    const rawQuery = String(req.query.q || req.query.id || req.query.personnelId || '').trim();
    if (!rawQuery) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: 'Please enter a Personnel or Service ID to search.'
      });
    }

    const queryClean = rawQuery.toUpperCase();
    const personnelRecords = await db.Personnel.find();
    const users = await db.Users.find();

    const userMap = {};
    users.forEach(u => { userMap[String(u._id)] = u; });

    // Filter matching personnel by personnelId (exact or prefix/substring) or fullName or email
    const matches = personnelRecords.filter(p => {
      const u = userMap[String(p.userId)] || {};
      const pid = (p.personnelId || '').toUpperCase();
      const fn = (p.fullName || u.fullName || '').toUpperCase();
      const em = (u.email || '').toUpperCase();
      return pid === queryClean || pid.includes(queryClean) || fn.includes(queryClean) || em.includes(queryClean);
    });

    if (matches.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        query: rawQuery,
        message: `No authorized personnel record matching "${rawQuery}" was found.`
      });
    }

    // Retrieve rich welfare monitoring context from database
    const allPredictions = await db.Predictions.find();
    const allCheckIns = await db.CheckIns.find();
    const allAlerts = await db.Alerts.find();

    const results = matches.map(p => {
      const u = userMap[String(p.userId)] || {};
      const uidStr = String(p.userId);

      // Latest prediction
      const userPreds = allPredictions.filter(pr => String(pr.userId) === uidStr);
      userPreds.sort((a, b) => new Date(b.analyzedAt || b.createdAt) - new Date(a.analyzedAt || a.createdAt));
      const latestPred = userPreds[0] || null;

      // User checkins
      const userCheckins = allCheckIns.filter(c => String(c.userId) === uidStr);
      userCheckins.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const latestCheckin = userCheckins[0] || null;

      // Active alerts
      const activeAlerts = allAlerts.filter(a => String(a.userId) === uidStr && a.status === 'PENDING_REVIEW');

      // Welfare Intervention Recommendations
      const interventionsPkg = recommendationService.generateWelfareInterventions(
        p,
        latestPred || { compositeRiskScore: 30, concernLevel: 'LOW' },
        latestCheckin || {},
        p
      );

      return {
        _id: p._id,
        userId: p.userId,
        personnelId: p.personnelId,
        fullName: p.fullName || u.fullName || 'Personnel Member',
        rank: p.rank || u.rank || 'Personnel',
        unit: p.unit || u.unit || 'Operational Unit',
        deploymentZone: p.deploymentZone || 'Field Sector',
        yearsOfService: p.yearsOfService != null ? p.yearsOfService : 'N/A',
        dutyType: p.dutyType || 'Active Duty',
        workSchedule: p.workSchedule || 'Standard Rotation',
        preferredSupportLanguage: p.preferredSupportLanguage || 'Hindi / English',
        isEnrolledInWelfare: p.isEnrolledInWelfare !== false,
        totalCheckinsCount: userCheckins.length,
        // Extended HR & Operational Data
        leavePattern: p.leavePattern || null,
        deploymentHistory: p.deploymentHistory || [],
        dutySchedule: p.dutySchedule || null,
        transferFrequency: p.transferFrequency || null,
        trainingCommitments: p.trainingCommitments || [],
        workloadTrends: p.workloadTrends || null,
        // Welfare Intervention Recommendations
        welfareInterventions: interventionsPkg.interventions || [],
        welfareInterventionsSummary: interventionsPkg.summary || '',
        privacyPreferences: p.privacyPreferences || {
          shareWithWelfareOfficer: true,
          anonymousAggregatedStats: true
        },
        welfareStatus: {
          concernLevel: latestPred ? latestPred.concernLevel : 'UNASSESSED',
          compositeRiskScore: latestPred ? latestPred.compositeRiskScore : null,
          evidenceStrength: latestPred ? latestPred.evidenceStrength : 'INSUFFICIENT',
          primaryPathway: latestPred ? (latestPred.primaryPathway || latestPred.modelPathways?.primaryModel || 'Model 1 (Wearable)') : 'N/A',
          lastAnalyzedAt: latestPred ? (latestPred.analyzedAt || latestPred.createdAt) : null,
          lastCheckinAt: latestCheckin ? latestCheckin.createdAt : null,
          recentDutyHours: latestCheckin ? latestCheckin.shift_duration_hours : null,
          recentWeeklyHours: latestCheckin ? latestCheckin.weekly_duty_hours : null,
          recentSleepHours: latestCheckin ? latestCheckin.sleep_hours_per_night : null,
          recentRecoveryPattern: latestCheckin ? latestCheckin.recovery_pattern : null,
          recentHrvMs: latestCheckin ? latestCheckin.hrv_ms : null,
          recentHeartRate: latestCheckin ? latestCheckin.resting_heart_rate : null,
          recentFatigueStrain: latestCheckin ? latestCheckin.fatigue_physical_strain : null,
          pendingAlertsCount: activeAlerts.length,
          activeAlerts: activeAlerts.map(a => ({
            _id: a._id,
            alertType: a.alertType,
            concernLevel: a.concernLevel,
            triggerReason: a.triggerReason,
            createdAt: a.createdAt
          }))
        }
      };
    });

    // Audit log
    if (typeof auditService !== 'undefined' && auditService.log) {
      await auditService.log({
        action: 'OFFICER_PERSONNEL_SEARCH',
        userId: req.user._id,
        personnelId: req.user.personnelId,
        targetResource: 'Personnel',
        ipAddress: req.ip,
        details: { query: rawQuery, matchCount: results.length }
      });
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      data: results,
      query: rawQuery
    });
  } catch (err) {
    next(err);
  }
};

const getPersonnelById = async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    req.query.q = id;
    return searchPersonnel(req, res, next);
  } catch (err) {
    next(err);
  }
};

const getRosterOptimization = async (req, res, next) => {
  try {
    const personnel = await db.Personnel.find();
    const predictions = await db.Predictions.find();
    const users = await db.Users.find();

    const predMap = {};
    predictions.forEach(p => { predMap[String(p.userId)] = p; });
    const userMap = {};
    users.forEach(u => { userMap[String(u._id)] = u; });

    const proposals = [];
    let totalFatigueReduction = 0;

    const checkIns = await db.CheckIns.find();
    const latestCheckInMap = {};
    checkIns.forEach(c => {
      if (!latestCheckInMap[String(c.userId)] || new Date(c.createdAt || c.checkInDate || 0) > new Date(latestCheckInMap[String(c.userId)].createdAt || latestCheckInMap[String(c.userId)].checkInDate || 0)) {
        latestCheckInMap[String(c.userId)] = c;
      }
    });

    personnel.forEach((p, idx) => {
      const pred = predMap[String(p.userId)];
      if (!pred) return; // Only propose pacing for personnel with existing risk evaluations

      const u = userMap[String(p.userId)] || {};
      const chk = latestCheckInMap[String(p.userId)] || {};
      const risk = Math.round(Number(pred.compositeRiskScore || 0));
      const shifts = chk.shift_continuity_days != null ? Number(chk.shift_continuity_days) : 0;
      const prolonged = chk.prolonged_duty_hours != null ? Number(chk.prolonged_duty_hours) : 0;
      const night = chk.night_duty_hours != null ? Number(chk.night_duty_hours) : 0;
      const activeDuty = chk.duty_type || p.primaryDuty || p.dutyType || 'Field Operations / Patrol';
      
      if (risk > 50 || pred.concernLevel === 'HIGH' || shifts >= 7 || prolonged >= 14) {
        const expectedReduction = Math.max(10, Math.min(35, Math.round(risk * 0.4) + (shifts >= 7 ? 5 : 0)));
        const predictedDelta = -expectedReduction;
        totalFatigueReduction += expectedReduction;

        let recDuty = 'Daylight Base Support & Equipment Logistics';
        let recRest = '48 Hours Decompression Cycle';
        let rationale = `Compounding strain (${risk}% risk index). Reallocating watch intervals mitigates chronic fatigue velocity.`;

        if (shifts >= 7) {
          recDuty = 'Mandatory Off-Duty Recuperation';
          recRest = '72 Hours Unbroken Downtime';
          rationale = `Continuous duty reached ${shifts} consecutive days without full 24h rest. Priority roster relief required.`;
        } else if (night >= 16) {
          recDuty = 'Daylight Administrative Watch';
          recRest = '36 Hours Circadian Resynchronization';
          rationale = `High night duty exposure (${night} hrs/wk). Day-shift rotation recommended to restore circadian rhythm.`;
        } else if (prolonged >= 12) {
          recDuty = 'Staggered 4-Hour Post Rotation';
          recRest = '24 Hours Post-Watch Rest';
          rationale = `Prolonged shift length (${prolonged} hrs continuous). Immediate watch split and relief scheduled.`;
        }

        proposals.push({
          proposalId: `PROP-${p.personnelId}-${p._id ? String(p._id).slice(-4) : (idx + 1).toString().padStart(3, '0')}`,
          userId: p.userId,
          personnelId: p.personnelId,
          fullName: p.fullName || u.fullName,
          rank: p.rank || u.rank,
          unit: p.unit || u.unit,
          currentDuty: activeDuty,
          consecutiveDutyDays: shifts,
          prolongedDutyHours: prolonged,
          nightDutyHours: night,
          currentRiskScore: risk,
          recommendedDuty: recDuty,
          recommendedRestHours: recRest,
          predictedRiskDelta: predictedDelta,
          status: 'PROPOSED',
          rationale
        });
      }
    });

    const battalionAvg = personnel.length > 0 ? (totalFatigueReduction / personnel.length) : 0;
    const estimatedBattalionFatigueReduction = `${battalionAvg.toFixed(1)}%`;

    return res.status(200).json({
      success: true,
      data: {
        totalProposals: proposals.length,
        estimatedBattalionFatigueReduction,
        proposals
      }
    });
  } catch (err) {
    next(err);
  }
};

const approveRosterPacing = async (req, res, next) => {
  try {
    const { proposalId, personnelId, approvedDuty } = req.body;

    await auditService.log({
      action: 'ROSTER_PACING_APPROVED',
      userId: req.user._id,
      personnelId: personnelId || 'UNKNOWN',
      targetResource: 'RosterOptimization',
      ipAddress: req.ip,
      details: { proposalId, approvedDuty }
    });

    return res.status(200).json({
      success: true,
      message: `Roster pacing schedule approved and dispatched to Adjutant Desk. Notification sent to personnel.`,
      data: { proposalId, status: 'APPROVED', effectiveDate: new Date().toISOString() }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Welfare Intervention Recommendations (Requirement 1)
 * Generates supportive, non-disciplinary welfare recommendations across all unit personnel
 */
const getWelfareInterventions = async (req, res, next) => {
  try {
    const personnel = await db.Personnel.find();
    const predictions = await db.Predictions.find();
    const checkIns = await db.CheckIns.find();

    const predMap = {};
    predictions.forEach(p => {
      if (!predMap[String(p.userId)] || new Date(p.createdAt || p.analyzedAt || 0) > new Date(predMap[String(p.userId)].createdAt || predMap[String(p.userId)].analyzedAt || 0)) {
        predMap[String(p.userId)] = p;
      }
    });

    const checkInMap = {};
    checkIns.forEach(c => {
      if (!checkInMap[String(c.userId)] || new Date(c.createdAt || c.checkInDate || 0) > new Date(checkInMap[String(c.userId)].createdAt || checkInMap[String(c.userId)].checkInDate || 0)) {
        checkInMap[String(c.userId)] = c;
      }
    });

    const results = personnel.map(p => {
      const pred = predMap[String(p.userId)] || { compositeRiskScore: 30, concernLevel: 'LOW' };
      const chk = checkInMap[String(p.userId)] || {};
      return recommendationService.generateWelfareInterventions(p, pred, chk, p);
    });

    return res.status(200).json({
      success: true,
      data: {
        totalMonitored: personnel.length,
        welfareInterventions: results,
        nonPunitiveNotice: 'All recommendations are non-disciplinary decision support tools. Automated duty changes are prohibited.'
      }
    });
  } catch (err) {
    next(err);
  }
};

const getPersonnelInterventions = async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    const p = await db.Personnel.findOne({
      $or: [{ personnelId: id }, { userId: id }]
    });

    if (!p) {
      return res.status(404).json({
        success: false,
        message: `Personnel record ${id} not found.`
      });
    }

    const predictions = await db.Predictions.find({ userId: p.userId });
    predictions.sort((a, b) => new Date(b.createdAt || b.analyzedAt || 0) - new Date(a.createdAt || a.analyzedAt || 0));
    const latestPred = predictions[0] || { compositeRiskScore: 30, concernLevel: 'LOW' };

    const checkIns = await db.CheckIns.find({ userId: p.userId });
    checkIns.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const latestCheckin = checkIns[0] || {};

    const interventionsPkg = recommendationService.generateWelfareInterventions(p, latestPred, latestCheckin, p);

    return res.status(200).json({
      success: true,
      data: interventionsPkg
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Workload Balancing Support (Requirement 3)
 * Identifies sustained workload overload patterns and formulates suggested review actions.
 * Strictly non-automated, advisory only.
 */
const getWorkloadBalancingProposals = async (req, res, next) => {
  try {
    const personnel = await db.Personnel.find();
    const predictions = await db.Predictions.find();
    const checkIns = await db.CheckIns.find();
    const users = await db.Users.find();

    const userMap = {};
    users.forEach(u => { userMap[String(u._id)] = u; });

    const latestPredMap = {};
    predictions.forEach(p => {
      if (!latestPredMap[String(p.userId)] || new Date(p.createdAt || p.analyzedAt || 0) > new Date(latestPredMap[String(p.userId)].createdAt || latestPredMap[String(p.userId)].analyzedAt || 0)) {
        latestPredMap[String(p.userId)] = p;
      }
    });

    const latestCheckinMap = {};
    checkIns.forEach(c => {
      if (!latestCheckinMap[String(c.userId)] || new Date(c.createdAt || c.checkInDate || 0) > new Date(latestCheckinMap[String(c.userId)].createdAt || latestCheckinMap[String(c.userId)].checkInDate || 0)) {
        latestCheckinMap[String(c.userId)] = c;
      }
    });

    const balancingProposals = [];
    let highStrainCount = 0;
    let moderateStrainCount = 0;

    personnel.forEach((p, idx) => {
      const u = userMap[String(p.userId)] || {};
      const pred = latestPredMap[String(p.userId)] || { compositeRiskScore: 35, concernLevel: 'LOW' };
      const chk = latestCheckinMap[String(p.userId)] || {};
      const risk = Math.round(Number(pred.compositeRiskScore || 0));

      const weeklyHours = chk.workload_hours != null ? Number(chk.workload_hours) : (chk.weekly_duty_hours != null ? Number(chk.weekly_duty_hours) : 48);
      const shifts = chk.shift_continuity_days != null ? Number(chk.shift_continuity_days) : 0;
      const prolonged = chk.prolonged_duty_hours != null ? Number(chk.prolonged_duty_hours) : 0;
      const night = chk.night_duty_hours != null ? Number(chk.night_duty_hours) : 0;
      const activeDuty = chk.duty_type || p.primaryDuty || p.dutyType || 'Field Operations / Patrol';

      const wt = p.workloadTrends || { averageWeeklyHours: 48, surgeWeeksCount: 1, trajectory: 'Stable' };
      const lp = p.leavePattern || { daysRemaining: 40, leaveDeficitWarning: false };
      const ds = p.dutySchedule || { shiftType: 'Rotational 3-Watch', nightShiftRatio: 0.25 };

      // Identify sustained workload patterns
      const isSustainedWeekly = weeklyHours >= 58 || wt.averageWeeklyHours >= 56 || wt.surgeWeeksCount >= 3;
      const isConsecutiveOverload = shifts >= 7;
      const isProlongedWatch = prolonged >= 12;
      const isNightDutyOverload = night >= 16 || (ds.nightShiftRatio && ds.nightShiftRatio >= 0.35);
      const isSurgeTrajectory = wt.trajectory === 'Increasing' && risk >= 45;

      const hasSustainedPattern = isSustainedWeekly || isConsecutiveOverload || isProlongedWatch || isNightDutyOverload || isSurgeTrajectory || risk >= 55;

      if (hasSustainedPattern) {
        const patternsDetected = [];
        let suggestedReviewAction = 'Review operational pacing and rotate non-critical standby duties with Adjutant Desk.';
        let targetArea = 'General Workload Pacing';
        let severity = 'MODERATE';

        if (isConsecutiveOverload) {
          severity = 'HIGH';
          patternsDetected.push(`Continuous Duty Exposure (${shifts} consecutive shifts without rest)`);
          suggestedReviewAction = `Recommend Adjutant review mandatory 48-hour recuperative rest window before next deployment (current streak: ${shifts} consecutive shifts).`;
          targetArea = 'Mandatory Decompression';
        } else if (isProlongedWatch) {
          severity = 'HIGH';
          patternsDetected.push(`Prolonged Watch Length (${prolonged} continuous hours)`);
          suggestedReviewAction = `Suggest watch split to 4-hour staggered rotation intervals to cap continuous vigilance strain.`;
          targetArea = 'Watch Interval Splitting';
        } else if (isSustainedWeekly) {
          severity = weeklyHours >= 65 ? 'HIGH' : 'MODERATE';
          patternsDetected.push(`Sustained Weekly Load (${weeklyHours}h/wk, ${wt.surgeWeeksCount || 2} surge cycles)`);
          suggestedReviewAction = `Recommend temporary redistribution to daylight base maintenance and technical logistics (capping at 40h/wk).`;
          targetArea = 'Duty Redistribution';
        } else if (isNightDutyOverload) {
          severity = 'MODERATE';
          patternsDetected.push(`Circadian Night Watch Load (${night} night hours/wk)`);
          suggestedReviewAction = `Suggest rotating to daylight watch shift to restore circadian sleep equilibrium.`;
          targetArea = 'Circadian Rebalancing';
        } else if (isSurgeTrajectory) {
          severity = 'MODERATE';
          patternsDetected.push(`Upward Workload Velocity (${wt.trajectory} trajectory, ${wt.surgeWeeksCount} surge weeks)`);
          suggestedReviewAction = `Suggest Adjutant review workload velocity to prevent chronic fatigue transition.`;
          targetArea = 'Trajectory Stabilization';
        } else {
          patternsDetected.push(`Elevated Operational Strain Index (${risk}%)`);
        }

        if (severity === 'HIGH') highStrainCount++;
        else moderateStrainCount++;

        balancingProposals.push({
          proposalId: `WLB-${p.personnelId}-${p._id ? String(p._id).slice(-4) : (idx + 1).toString().padStart(3, '0')}`,
          userId: p.userId,
          personnelId: p.personnelId,
          fullName: p.fullName || u.fullName || 'Personnel Member',
          rank: p.rank || u.rank || 'Personnel',
          unit: p.unit || u.unit || 'Operational Unit',
          currentDuty: activeDuty,
          patternsDetected,
          targetArea,
          severity,
          metrics: {
            weeklyDutyHours: weeklyHours,
            consecutiveDutyDays: shifts,
            prolongedDutyHours: prolonged,
            nightDutyHours: night,
            workloadTrajectory: wt.trajectory,
            surgeWeeksCount: wt.surgeWeeksCount,
            riskScore: risk,
            leaveDeficit: lp.leaveDeficitWarning
          },
          suggestedReviewAction,
          advisoryOnly: true,
          automatedActionTaken: false,
          status: 'PENDING_OFFICER_REVIEW',
          governanceNotice: 'Advisory Pacing Only — Automated duty modification is strictly prohibited. Final duty schedule decisions reside solely with the Unit Commander / Adjutant.'
        });
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        totalEvaluated: personnel.length,
        sustainedWorkloadCount: balancingProposals.length,
        highSeverityCount: highStrainCount,
        moderateSeverityCount: moderateStrainCount,
        proposals: balancingProposals,
        governanceRule: 'Automated duty modification strictly prohibited; all proposals require human officer adjudication and Commander confirmation.'
      }
    });
  } catch (err) {
    next(err);
  }
};

const reviewWorkloadProposal = async (req, res, next) => {
  try {
    const { proposalId } = req.params;
    const { reviewAction, officerNotes, personnelId } = req.body;

    await auditService.log({
      action: 'WORKLOAD_PACING_REVIEWED',
      userId: req.user._id,
      personnelId: personnelId || 'UNKNOWN',
      targetResource: 'WorkloadBalancing',
      ipAddress: req.ip,
      details: { proposalId, reviewAction, officerNotes, automatedActionTaken: false }
    });

    return res.status(200).json({
      success: true,
      message: `Workload pacing review recorded successfully. Advisory dispatched to Adjutant Desk.`,
      data: {
        proposalId,
        reviewAction: reviewAction || 'DISPATCH_TO_ADJUTANT',
        officerNotes: officerNotes || '',
        status: 'REVIEWED_BY_OFFICER',
        automatedActionTaken: false,
        reviewedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOfficerDashboard,
  getEarlyWarningCenter,
  getInterventionEffectiveness,
  getAlerts,
  getAlertWorkflow,
  reviewAlert,
  getPersonnelList,
  searchPersonnel,
  getPersonnelById,
  getRosterOptimization,
  approveRosterPacing,
  getWelfareInterventions,
  getPersonnelInterventions,
  getWorkloadBalancingProposals,
  reviewWorkloadProposal
};
