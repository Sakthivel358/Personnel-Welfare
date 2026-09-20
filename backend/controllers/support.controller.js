const db = require('../models/dbAdapter');
const auditService = require('../services/audit.service');

const generateReferenceId = () => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `REQ-${num}`;
};

const getSupportOptions = async (req, res, next) => {
  try {
    const options = {
      policy: {
        accessibleToAll: true,
        statement: 'Personnel can request support at any time, even if the ML model does not classify them as high concern.',
        nonPunitive: true,
        confidential: true
      },
      categories: [
        {
          id: 'CONFIDENTIAL_COUNSELING',
          title: 'Confidential Psychological Counseling',
          description: 'One-on-one tele-counseling or on-base psychological support with certified clinical professionals.',
          urgencyOptions: ['ROUTINE', 'PRIORITY', 'URGENT'],
          icon: '🧠',
          badge: '24/7 Available'
        },
        {
          id: 'WORKLOAD_REVIEW',
          title: 'Duty Schedule & Rest Rotation Review',
          description: 'Request formal review of cumulative duty hours, night shift intervals, and rest period allocation.',
          urgencyOptions: ['ROUTINE', 'PRIORITY'],
          icon: '⏱️',
          badge: 'Unit Command'
        },
        {
          id: 'PEER_SUPPORT',
          title: 'Peer Buddy & Mentorship Connection',
          description: 'Confidential matching with an experienced unit peer or veteran mentor for shared operational decompression.',
          urgencyOptions: ['ROUTINE', 'PRIORITY'],
          icon: '🤝',
          badge: 'Peer Network'
        },
        {
          id: 'FATIGUE_MITIGATION',
          title: 'Fatigue Management & Physical Recovery',
          description: 'Access base decompression chambers, sleep restoration quarters, and physical recovery resources.',
          urgencyOptions: ['ROUTINE', 'PRIORITY'],
          icon: '🛌',
          badge: 'Wellness Center'
        },
        {
          id: 'FAMILY_SUPPORT',
          title: 'Family & Dependent Welfare Liaison',
          description: 'Assistance for dependent health, children schooling transitions, or domestic emergencies.',
          urgencyOptions: ['ROUTINE', 'PRIORITY', 'URGENT'],
          icon: '🏡',
          badge: 'Family Cell'
        },
        {
          id: 'GENERAL_INQUIRY',
          title: 'General Welfare Consultation',
          description: 'Open discussion with Unit Welfare Officer regarding welfare entitlements, leave, or operational wellbeing.',
          urgencyOptions: ['ROUTINE'],
          icon: '🛡️',
          badge: 'HQ Desk'
        },
        {
          id: 'HUMAN_WELFARE_REVIEW',
          title: 'Request Human Welfare Review & Officer Check-in',
          description: 'Confidential request for a dedicated human-in-the-loop review session with the Unit Welfare Officer to review duty, rest, and personal wellbeing.',
          urgencyOptions: ['ROUTINE', 'PRIORITY', 'URGENT'],
          icon: '🩺',
          badge: 'Direct Officer Review'
        }
      ]
    };

    return res.status(200).json({
      success: true,
      data: options
    });
  } catch (err) {
    next(err);
  }
};

const createSupportRequest = async (req, res, next) => {
  try {
    const rawType = req.body.requestType || req.body.category || req.body.type || req.body.serviceType;
    const { urgency, preferredContactMethod, preferredTime, notes, description } = req.body;
    const requestType = rawType;

    if (!requestType) {
      return res.status(400).json({ success: false, message: 'Support request type is required.' });
    }

    const referenceId = generateReferenceId();

    // Personnel can request support regardless of ML concern level (LOW, MODERATE, HIGH, UNDETERMINED)
    const predictions = await db.Predictions.find({ userId: req.user._id });
    const latestPred = predictions.length > 0 ? predictions[predictions.length - 1] : null;
    const personnelConcern = latestPred ? latestPred.concernLevel : 'UNASSESSED';

    const newRequest = await db.SupportRequests.create({
      referenceId,
      userId: req.user._id,
      personnelId: req.user.personnelId,
      requestType,
      urgency: urgency || 'ROUTINE',
      preferredContactMethod: preferredContactMethod || 'CONFIDENTIAL_IN_PERSON',
      preferredTime: preferredTime || 'ANYTIME',
      notes: notes || description || '',
      status: 'SUBMITTED',
      personnelConcernLevel: personnelConcern,
      isSelfRequested: true,
      accessibleRegardlessOfConcern: true,
      statusHistory: [
        {
          status: 'SUBMITTED',
          timestamp: new Date().toISOString(),
          note: 'Request received and logged confidentially. Unit Welfare Officer notified.'
        }
      ]
    });

    // Notify personnel
    await db.Notifications.create({
      userId: req.user._id,
      title: 'Support Request Received',
      message: `Your request (${referenceId}) for "${requestType.replace(/_/g, ' ')}" is logged. An authorized welfare officer will review it confidentially.`,
      type: 'SUPPORT_UPDATE',
      link: '/support.html'
    });

    await auditService.log({
      action: 'SUPPORT_REQUEST_CREATED',
      userId: req.user._id,
      personnelId: req.user.personnelId,
      targetResource: 'SupportRequests',
      ipAddress: req.ip,
      details: { referenceId, requestType, urgency, personnelConcernLevel: personnelConcern }
    });

    return res.status(201).json({
      success: true,
      message: 'Confidential support request submitted successfully. Support is accessible regardless of concern level.',
      data: newRequest
    });
  } catch (err) {
    next(err);
  }
};

const getMyRequests = async (req, res, next) => {
  try {
    const requests = await db.SupportRequests.find({ userId: req.user._id });
    const users = await db.Users.find();
    const followUps = await db.FollowUps.find({ userId: req.user._id });
    const userMap = {};
    users.forEach(u => { userMap[String(u._id)] = u; });

    const enriched = requests.map(r => {
      const officer = r.assignedOfficer ? userMap[String(r.assignedOfficer)] : null;
      const linkedFollowUp = followUps.find(f => String(f.userId) === String(r.userId));
      return {
        ...r,
        assignedOfficerName: officer ? officer.fullName : (r.assignedOfficer ? 'Assigned Officer' : 'Awaiting Officer Assignment'),
        assignedOfficerRank: officer ? officer.rank : null,
        linkedFollowUp: linkedFollowUp ? {
          scheduledDate: linkedFollowUp.scheduledDate,
          status: linkedFollowUp.status,
          welfareDelta: linkedFollowUp.welfareDelta
        } : null
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({
      success: true,
      data: enriched,
      count: enriched.length,
      accessibleRegardlessOfConcern: true
    });
  } catch (err) {
    next(err);
  }
};

const getAllRequests = async (req, res, next) => {
  try {
    const requests = await db.SupportRequests.find();
    const users = await db.Users.find();
    const userMap = {};
    users.forEach(u => { userMap[String(u._id)] = u; });

    const enriched = requests.map(r => {
      const u = userMap[String(r.userId)] || {};
      return {
        ...r,
        personnelName: u.fullName || r.personnelId,
        rank: u.rank || 'Member',
        unit: u.unit || 'Operational Unit'
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

const updateRequestStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, resolutionNotes, assignedOfficerNotes } = req.body;

    const reqDoc = await db.SupportRequests.findById(id);
    if (!reqDoc) {
      return res.status(404).json({ success: false, message: 'Support request not found.' });
    }

    const history = reqDoc.statusHistory || [];
    history.push({
      status: status || reqDoc.status,
      timestamp: new Date().toISOString(),
      note: resolutionNotes || assignedOfficerNotes || `Status updated to ${status}`
    });

    const updated = await db.SupportRequests.findByIdAndUpdate(id, {
      status: status || reqDoc.status,
      resolutionNotes: resolutionNotes || reqDoc.resolutionNotes,
      assignedOfficer: req.user._id,
      statusHistory: history
    });

    // Notify user of update
    await db.Notifications.create({
      userId: reqDoc.userId,
      title: 'Support Request Update',
      message: `Your support request (${reqDoc.referenceId || 'REQ'}) status is now: ${(status || reqDoc.status).replace(/_/g, ' ')}.`,
      type: 'SUPPORT_UPDATE',
      link: '/support.html'
    });

    return res.status(200).json({
      success: true,
      message: 'Support request updated successfully.',
      data: updated
    });
  } catch (err) {
    next(err);
  }
};

const reviewSupportRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      status,
      supportActionTaken,
      officerNotes,
      scheduledFollowUpDate,
      resolutionNotes
    } = req.body;

    const reqDoc = await db.SupportRequests.findById(id);
    if (!reqDoc) {
      return res.status(404).json({ success: false, message: 'Support request not found.' });
    }

    const determinedStatus = status || (scheduledFollowUpDate ? 'FOLLOW_UP_SCHEDULED' : (supportActionTaken ? 'ACTION_TAKEN' : 'UNDER_REVIEW'));
    const finalNotes = officerNotes || resolutionNotes || `Support action recorded: ${supportActionTaken || determinedStatus}`;

    const history = reqDoc.statusHistory || [];
    history.push({
      status: determinedStatus,
      timestamp: new Date().toISOString(),
      note: finalNotes,
      supportActionTaken: supportActionTaken || null,
      officerId: req.user._id,
      officerName: req.user.fullName || 'Welfare Officer'
    });

    const updated = await db.SupportRequests.findByIdAndUpdate(id, {
      status: determinedStatus,
      supportActionTaken: supportActionTaken || reqDoc.supportActionTaken,
      officerNotes: finalNotes,
      resolutionNotes: finalNotes,
      assignedOfficer: req.user._id,
      reviewedBy: req.user._id,
      reviewedAt: new Date().toISOString(),
      statusHistory: history
    });

    // If follow-up session scheduled, create / update FollowUps record
    let followUpRecord = null;
    if (scheduledFollowUpDate) {
      let existingFollowUp = await db.FollowUps.findOne({ supportRequestId: reqDoc._id });
      if (!existingFollowUp) {
        existingFollowUp = await db.FollowUps.findOne({ userId: reqDoc.userId, status: 'SCHEDULED' });
      }

      if (existingFollowUp) {
        followUpRecord = await db.FollowUps.findByIdAndUpdate(existingFollowUp._id, {
          scheduledDate: new Date(scheduledFollowUpDate).toISOString(),
          status: 'SCHEDULED',
          officerNotes: finalNotes,
          supportRequestId: reqDoc._id,
          assignedOfficerId: req.user._id
        });
      } else {
        followUpRecord = await db.FollowUps.create({
          userId: reqDoc.userId,
          personnelId: reqDoc.personnelId,
          supportRequestId: reqDoc._id,
          scheduledDate: new Date(scheduledFollowUpDate).toISOString(),
          status: 'SCHEDULED',
          officerNotes: finalNotes,
          initialRiskScore: reqDoc.personnelConcernLevel || 'UNASSESSED',
          welfareDelta: 'PENDING_DATA',
          assignedOfficerId: req.user._id
        });
      }
    }

    // Notify personnel of support action & scheduled follow-up
    await db.Notifications.create({
      userId: reqDoc.userId,
      title: 'Support Review Action Recorded',
      message: `Your Unit Welfare Officer has completed review for request (${reqDoc.referenceId || 'REQ'}). Action: ${(supportActionTaken || determinedStatus).replace(/_/g, ' ')}.${scheduledFollowUpDate ? ` Follow-up session scheduled on ${new Date(scheduledFollowUpDate).toLocaleDateString()}.` : ''}`,
      type: 'SUPPORT_UPDATE',
      link: '/support.html'
    });

    await auditService.log({
      action: 'HUMAN_WELFARE_REVIEW_COMPLETED',
      userId: req.user._id,
      personnelId: reqDoc.personnelId,
      targetResource: 'SupportRequests',
      ipAddress: req.ip,
      details: {
        requestId: reqDoc._id,
        referenceId: reqDoc.referenceId,
        supportActionTaken,
        status: determinedStatus,
        followUpScheduled: Boolean(scheduledFollowUpDate)
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Human welfare review completed and support action recorded successfully.',
      data: {
        ...(updated || {}),
        request: updated,
        followUp: followUpRecord
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSupportOptions,
  createSupportRequest,
  getMyRequests,
  getAllRequests,
  updateRequestStatus,
  reviewSupportRequest
};
