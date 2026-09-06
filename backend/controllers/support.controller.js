const db = require('../models/dbAdapter');
const auditService = require('../services/audit.service');

const generateReferenceId = () => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `REQ-${num}`;
};

const createSupportRequest = async (req, res, next) => {
  try {
    const { requestType, urgency, preferredContactMethod, preferredTime, notes } = req.body;

    if (!requestType) {
      return res.status(400).json({ success: false, message: 'Support request type is required.' });
    }

    const referenceId = generateReferenceId();

    const newRequest = await db.SupportRequests.create({
      referenceId,
      userId: req.user._id,
      personnelId: req.user.personnelId,
      requestType,
      urgency: urgency || 'ROUTINE',
      preferredContactMethod: preferredContactMethod || 'CONFIDENTIAL_IN_PERSON',
      preferredTime: preferredTime || 'ANYTIME',
      notes: notes || '',
      status: 'SUBMITTED',
      statusHistory: [
        {
          status: 'SUBMITTED',
          timestamp: new Date().toISOString(),
          note: 'Request received and logged confidentially.'
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
      details: { referenceId, requestType, urgency }
    });

    return res.status(201).json({
      success: true,
      message: 'Confidential support request submitted successfully.',
      data: newRequest
    });
  } catch (err) {
    next(err);
  }
};

const getMyRequests = async (req, res, next) => {
  try {
    const requests = await db.SupportRequests.find({ userId: req.user._id });
    return res.status(200).json({
      success: true,
      data: requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
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

module.exports = { createSupportRequest, getMyRequests, getAllRequests, updateRequestStatus };
