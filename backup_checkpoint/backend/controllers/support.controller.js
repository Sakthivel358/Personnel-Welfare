const db = require('../models/dbAdapter');
const auditService = require('../services/audit.service');

const createSupportRequest = async (req, res, next) => {
  try {
    const { requestType, urgency, notes } = req.body;

    if (!requestType) {
      return res.status(400).json({ success: false, message: 'Support request type is required.' });
    }

    const newRequest = await db.SupportRequests.create({
      userId: req.user._id,
      personnelId: req.user.personnelId,
      requestType,
      urgency: urgency || 'ROUTINE',
      notes: notes || '',
      status: 'OPEN'
    });

    // Notify personnel
    await db.Notifications.create({
      userId: req.user._id,
      title: 'Support Request Received',
      message: `Your request for "${requestType.replace(/_/g, ' ')}" has been registered. An authorized welfare officer will review it confidentially.`,
      type: 'SUPPORT_UPDATE',
      link: '/support.html'
    });

    await auditService.log({
      action: 'SUPPORT_REQUEST_CREATED',
      userId: req.user._id,
      personnelId: req.user.personnelId,
      targetResource: 'SupportRequests',
      ipAddress: req.ip,
      details: { requestType, urgency }
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
        rank: u.rank || 'Constable',
        unit: u.unit || 'CRPF Battalion 104'
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
    const { status, resolutionNotes } = req.body;

    const reqDoc = await db.SupportRequests.findById(id);
    if (!reqDoc) {
      return res.status(404).json({ success: false, message: 'Support request not found.' });
    }

    const updated = await db.SupportRequests.findByIdAndUpdate(id, {
      status: status || reqDoc.status,
      resolutionNotes: resolutionNotes || reqDoc.resolutionNotes,
      assignedOfficer: req.user._id
    });

    // Notify user of update
    await db.Notifications.create({
      userId: reqDoc.userId,
      title: 'Support Request Update',
      message: `Your support request status has been updated to: ${status || reqDoc.status}.`,
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
