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
        personnelRank: pUser.rank || 'Constable',
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

module.exports = { getFollowUps, updateFollowUp };
