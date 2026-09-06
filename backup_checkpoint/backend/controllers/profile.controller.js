const db = require('../models/dbAdapter');
const auditService = require('../services/audit.service');

const getProfile = async (req, res, next) => {
  try {
    const personnel = await db.Personnel.findOne({ userId: req.user._id });
    const user = await db.Users.findById(req.user._id);

    return res.status(200).json({
      success: true,
      data: {
        ...personnel,
        email: user ? user.email : '',
        role: user ? user.role : 'PERSONNEL',
        lastLogin: user ? user.lastLogin : null
      }
    });
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const {
      fullName,
      unit,
      rank,
      deploymentZone,
      yearsOfService,
      dutyType,
      preferredSupportLanguage,
      emergencyContact
    } = req.body;

    // Update User core info
    await db.Users.findByIdAndUpdate(req.user._id, {
      fullName: fullName || req.user.fullName,
      unit: unit || req.user.unit,
      rank: rank || req.user.rank
    });

    // Update Personnel details
    const updatedPersonnel = await db.Personnel.findOneAndUpdate(
      { userId: req.user._id },
      {
        fullName: fullName || req.user.fullName,
        unit: unit || req.user.unit,
        rank: rank || req.user.rank,
        deploymentZone: deploymentZone || 'Sector North - Alpha Division',
        yearsOfService: yearsOfService !== undefined ? Number(yearsOfService) : 6,
        dutyType: dutyType || 'Field Operations',
        preferredSupportLanguage: preferredSupportLanguage || 'English',
        emergencyContact: emergencyContact || {}
      }
    );

    await auditService.log({
      action: 'PROFILE_UPDATE',
      userId: req.user._id,
      personnelId: req.user.personnelId,
      targetResource: 'Personnel',
      ipAddress: req.ip
    });

    return res.status(200).json({
      success: true,
      message: 'Profile information saved successfully.',
      data: updatedPersonnel
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile };
