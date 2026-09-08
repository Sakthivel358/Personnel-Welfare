const db = require('../models/dbAdapter');
const auditService = require('../services/audit.service');

const getProfile = async (req, res, next) => {
  try {
    const user = await db.Users.findById(req.user._id);
    const personnel = await db.Personnel.findOne({
      $or: [
        { userId: req.user._id },
        { personnelId: (user && user.personnelId) || req.user.personnelId }
      ]
    });

    return res.status(200).json({
      success: true,
      data: {
        ...(personnel || {}),
        personnelId: (user && user.personnelId) || (personnel && personnel.personnelId) || req.user.personnelId || '',
        email: (user && user.email) || (personnel && personnel.email) || req.user.email || '',
        fullName: (user && user.fullName) || (personnel && personnel.fullName) || req.user.fullName || '',
        rank: (personnel && personnel.rank) || (user && user.rank) || req.user.rank || 'Havildar',
        unit: (personnel && personnel.unit) || (user && user.unit) || req.user.unit || 'CRPF Battalion 104',
        phone: (personnel && personnel.phone) || (user && user.phone) || '',
        profileImage: (personnel && personnel.profileImage) || (user && user.profileImage) || '',
        role: user ? user.role : (req.user.role || 'PERSONNEL'),
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
      profileImage,
      phone,
      dob,
      gender,
      rank,
      force,
      unit,
      joiningDate,
      yearsOfService,
      serviceCategory,
      postingType,
      deploymentZone,
      currentLocation,
      preferredSupportLanguage,
      primaryDuty,
      secondaryDuty,
      qualification,
      trainingCompleted,
      certifications,
      experienceYears,
      preferredSupportChannel,
      preferredContactTime,
      welfareContactPreference,
      accessibilityPreference,
      emergencyContact,
      privacyPreferences
    } = req.body;

    // Update User core info
    const userUpdate = {
      fullName: fullName || req.user.fullName,
      unit: unit || req.user.unit,
      rank: rank || req.user.rank
    };
    if (profileImage !== undefined) {
      userUpdate.profileImage = profileImage;
    }
    await db.Users.findByIdAndUpdate(req.user._id, userUpdate);

    // Update Personnel structured details
    const personnelUpdate = {
      fullName: fullName || req.user.fullName,
      phone: phone || '',
      dob: dob || '',
      gender: gender || 'Not Specified',
      rank: rank || req.user.rank,
      force: force || 'CRPF',
      unit: unit || req.user.unit,
      joiningDate: joiningDate || '',
      yearsOfService: yearsOfService !== undefined ? Number(yearsOfService) : 5,
      serviceCategory: serviceCategory || 'Combatant',
      postingType: postingType || 'Field Operations',
        deploymentZone: deploymentZone || 'Standard Field Deployment',
        currentLocation: currentLocation || 'Battalion HQ',
        preferredSupportLanguage: preferredSupportLanguage || 'English / Hindi',
        primaryDuty: primaryDuty || 'Field Patrol / Active Security',
        secondaryDuty: secondaryDuty || 'Logistics & Communication',
        qualification: qualification || 'Graduate / Diploma',
        trainingCompleted: trainingCompleted || 'Basic Operational & Counter-Insurgency Training',
        certifications: certifications || 'High-Altitude Survival, First Aid',
        experienceYears: experienceYears !== undefined ? Number(experienceYears) : 5,
        preferredSupportChannel: preferredSupportChannel || 'In-App Notification',
        preferredContactTime: preferredContactTime || 'Evening (Post-Duty)',
        welfareContactPreference: welfareContactPreference || 'Welfare Officer In-Person',
        accessibilityPreference: accessibilityPreference || 'Standard Display',
        emergencyContact: emergencyContact || {},
        privacyPreferences: privacyPreferences || {
          shareWithWelfareOfficer: true,
          anonymousAggregatedStats: true,
          notificationChannel: 'IN_APP'
        }
      };
      if (profileImage !== undefined) {
        personnelUpdate.profileImage = profileImage;
      }

      const updatedPersonnel = await db.Personnel.findOneAndUpdate(
        { userId: req.user._id },
        personnelUpdate,
        { new: true, upsert: true }
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
      data: updatedPersonnel || {
        ...req.user,
        ...userUpdate,
        profileImage: userUpdate.profileImage || ''
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile };

