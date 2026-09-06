const db = require('../models/dbAdapter');

const getNotifications = async (req, res, next) => {
  try {
    const notifications = await db.Notifications.find({ userId: req.user._id });
    return res.status(200).json({
      success: true,
      data: notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    });
  } catch (err) {
    next(err);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await db.Notifications.findById(id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    const updated = await db.Notifications.findByIdAndUpdate(id, { isRead: true });
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    await db.Notifications.updateMany({ userId: req.user._id }, { isRead: true });
    return res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getNotifications, markAsRead, markAllRead };
