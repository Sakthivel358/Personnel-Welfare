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
        rank: (personnel && personnel.rank) || (user && user.rank) || req.user.rank || 'Personnel Member',
        unit: (personnel && personnel.unit) || (user && user.unit) || req.user.unit || 'Operational Unit',
        phone: (personnel && personnel.phone) || (user && user.phone) || '',
        profileImage: (personnel && personnel.profileImage) || (user && user.profileImage) || '',
        role: user ? user.role : (req.user.role || 'PERSONNEL'),
        lastLogin: user ? user.lastLogin : null,
        leavePattern: {
          daysEarned: (personnel && personnel.leavePattern && personnel.leavePattern.daysEarned != null) ? personnel.leavePattern.daysEarned : 60,
          daysAvailed: (personnel && personnel.leavePattern && personnel.leavePattern.daysAvailed != null) ? personnel.leavePattern.daysAvailed : 15,
          daysRemaining: (personnel && personnel.leavePattern && personnel.leavePattern.daysRemaining != null) ? personnel.leavePattern.daysRemaining : 45,
          ...(personnel ? (personnel.leavePattern || {}) : {})
        },
        deploymentHistory: (personnel && Array.isArray(personnel.deploymentHistory) && personnel.deploymentHistory.length > 0)
          ? personnel.deploymentHistory
          : [
            { location: 'Jammu & Kashmir Sector', duration: '18 months', role: 'Counter-Terrorism & Line-of-Control Guard', tier: 'High-Altitude Extreme' },
            { location: 'Assam / Northeastern Border', duration: '24 months', role: 'Border Surveillance & Counter-Insurgency', tier: 'Hard Area Category-B' }
          ],
        dutySchedule: {
          shiftType: (personnel && personnel.dutySchedule && personnel.dutySchedule.shiftType) || 'Rotational 3-Watch',
          weeklyHoursNominal: (personnel && personnel.dutySchedule && personnel.dutySchedule.weeklyHoursNominal != null) ? personnel.dutySchedule.weeklyHoursNominal : 48,
          nightShiftRatio: (personnel && personnel.dutySchedule && personnel.dutySchedule.nightShiftRatio != null) ? personnel.dutySchedule.nightShiftRatio : 0.25,
          ...(personnel ? (personnel.dutySchedule || {}) : {})
        },
        transferFrequency: {
          transfersCount: (personnel && personnel.transferFrequency && typeof personnel.transferFrequency.transfersCount === 'number') ? personnel.transferFrequency.transfersCount : 3,
          averageTenureMonths: (personnel && personnel.transferFrequency && personnel.transferFrequency.averageTenureMonths != null) ? personnel.transferFrequency.averageTenureMonths : 22,
          highMobilityFlag: (personnel && personnel.transferFrequency && personnel.transferFrequency.highMobilityFlag != null) ? personnel.transferFrequency.highMobilityFlag : false,
          ...(personnel ? (personnel.transferFrequency || {}) : {})
        },
        trainingCommitments: (personnel && Array.isArray(personnel.trainingCommitments) && personnel.trainingCommitments.length > 0)
          ? personnel.trainingCommitments
          : [
            { courseName: 'Operational Readiness & Field Craft (TAC-101)', status: 'Completed', year: 2022 },
            { courseName: 'Forces Mental Health & Resilience Orientation (WEL-01)', status: 'In-Progress', year: 2024 }
          ],
        workloadTrends: {
          averageWeeklyHours: (personnel && personnel.workloadTrends && typeof personnel.workloadTrends.averageWeeklyHours === 'number') ? personnel.workloadTrends.averageWeeklyHours : 52,
          trajectory: (personnel && personnel.workloadTrends && personnel.workloadTrends.trajectory) || 'Stable',
          ...(personnel ? (personnel.workloadTrends || {}) : {})
        }
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
      privacyPreferences,
      leavePattern,
      deploymentHistory,
      dutySchedule,
      transferFrequency,
      trainingCommitments,
      workloadTrends
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

    const existingPersonnel = await db.Personnel.findOne({
      $or: [{ userId: req.user._id }, { personnelId: req.user.personnelId }]
    });

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
      },
      // Extended HR & Operational Data
      leavePattern: leavePattern || (existingPersonnel && existingPersonnel.leavePattern) || {
        daysEarned: 60,
        daysAvailed: 15,
        daysRemaining: 45,
        lastLeaveDate: '2026-03-10',
        leaveDeficitWarning: false,
        annualEntitlement: 60
      },
      deploymentHistory: deploymentHistory || (existingPersonnel && existingPersonnel.deploymentHistory) || [
        {
          mission: 'Op Rakshak - Sector North',
          zone: deploymentZone || 'Northern Sector (High Altitude)',
          durationMonths: 14,
          terrainType: 'Glacial Mountain / High Altitude',
          completedAt: '2025-11-20'
        }
      ],
      dutySchedule: dutySchedule || (existingPersonnel && existingPersonnel.dutySchedule) || {
        shiftType: 'Rotational 3-Watch',
        rotationCycle: '8h Watch / 16h Rest',
        weeklyHoursNominal: 48,
        nightShiftRatio: 0.25,
        timing: '06:00 - 14:00 / 14:00 - 22:00 / 22:00 - 06:00'
      },
      transferFrequency: transferFrequency || (existingPersonnel && existingPersonnel.transferFrequency) || {
        transfersCount: 3,
        averageTenureMonths: 22,
        lastTransferDate: '2025-06-15',
        highMobilityFlag: false
      },
      trainingCommitments: trainingCommitments || (existingPersonnel && existingPersonnel.trainingCommitments) || [
        {
          program: 'High Altitude Tactical Conditioning & Cold Survival',
          status: 'Completed',
          mandatoryHours: 40,
          completedHours: 40
        }
      ],
      workloadTrends: workloadTrends || (existingPersonnel && existingPersonnel.workloadTrends) || {
        averageWeeklyHours: 52,
        peakWeeklyHours: 68,
        surgeWeeksCount: 3,
        trajectory: 'Increasing'
      },
      // Strict separation: profile never captures dynamic welfare/wearable telemetry
      personnelId: req.user.personnelId
    };
      if (profileImage !== undefined) {
        personnelUpdate.profileImage = profileImage;
      }

      const updatedPersonnel = await db.Personnel.findOneAndUpdate(
        { $or: [{ userId: req.user._id }, { personnelId: req.user.personnelId }] },
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

