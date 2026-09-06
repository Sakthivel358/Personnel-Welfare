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
    await db.Users.findByIdAndUpdate(req.user._id, {
      fullName: fullName || req.user.fullName,
      unit: unit || req.user.unit,
      rank: rank || req.user.rank
    });

    // Update Personnel structured details
    const updatedPersonnel = await db.Personnel.findOneAndUpdate(
      { userId: req.user._id },
      {
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

