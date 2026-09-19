/**
 * Simulated HRMS Integration Service
 * 
 * DISCLAIMER / INTEGRITY NOTICE:
 * PROTOTYPE SIMULATION ONLY: This service layer simulates integration with military and CAPF
 * Human Resource Management Systems (e.g. ARPAN, BSF HRMS, ITBP e-HRMS). It provides synthetic
 * mock data for demonstration, testing, and evaluation purposes and does NOT claim connectivity
 * to live Indian Government HRMS or defense servers.
 */

const fs = require('fs');
const path = require('path');
const db = require('../models/dbAdapter');
const auditService = require('./audit.service');

const HRMS_DATA_FILE = path.join(__dirname, '..', 'data', 'hrms_mock_data.json');

class HRMSService {
  constructor() {
    this.systemName = 'Armed Forces & CAPF Unified HRMS Gateway (Simulated Adapter)';
    this.mockDisclaimer = 'PROTOTYPE SIMULATION ONLY: This API layer simulates integration with military/CAPF Human Resource Management Systems (e.g. ARPAN / BSF HRMS / ITBP e-HRMS). It contains synthetic mock data for demonstration purposes and does NOT connect to live government servers.';
    this.version = 'v1.4.0-mock-adapter';
    this.supportedDomains = ['personnel', 'duty', 'leave', 'deployment', 'training', 'workload'];
  }

  _loadMockDatabase() {
    try {
      if (fs.existsSync(HRMS_DATA_FILE)) {
        const raw = fs.readFileSync(HRMS_DATA_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('Could not read hrms_mock_data.json, using fallback generator:', err.message);
    }
    return { records: {} };
  }

  getHRMSStatus() {
    return {
      status: 'ONLINE',
      adapterMode: 'SIMULATED_PROTOTYPE_GATEWAY',
      isSimulated: true,
      system: this.systemName,
      disclaimer: this.mockDisclaimer,
      version: this.version,
      supportedDomains: this.supportedDomains,
      lastGatewayHeartbeat: new Date().toISOString()
    };
  }

  _generateSyntheticDossier(personnelId, user = {}) {
    const pId = personnelId || user.personnelId || 'SEC-0001';
    const fullName = user.fullName || 'Force Member';
    const rank = user.rank || 'Havildar';
    const unit = user.unit || 'Operational Field Battalion';
    const force = pId.split('-')[0] || 'CRPF';

    return {
      personnelId: pId,
      isSimulated: true,
      simulationNotice: this.mockDisclaimer,
      personnel: {
        serviceNumber: `${pId}-SYN`,
        fullName,
        rank,
        force,
        unit,
        company: 'Bravo Coy',
        platoon: '1st Platoon',
        trade: 'General Duty / Tactical Security',
        dateOfJoining: '2019-04-12',
        dateOfAttestation: '2019-11-20',
        dateOfBirth: '1995-03-15',
        bloodGroup: 'B+',
        medicalCategory: 'SHAPE-1 (Operational Field Fit)',
        heightCm: 176,
        weightKg: 72,
        nextOfKin: {
          name: 'Verified Family Contact',
          relationship: 'Next of Kin',
          emergencyContact: '+91-98765-00000'
        }
      },
      duty: {
        currentRoster: `${unit} Rotational Shift Roster`,
        watchRole: 'Patrol & Active Security Duty',
        shiftTiming: '06:00 - 14:00 (Rotational)',
        dutyPost: 'Outpost Observation Watch',
        guardCommander: 'Subedar M. Singh',
        companyCommander: 'Company Commander',
        currentStatus: 'ON_ACTIVE_DUTY',
        lastRosterUpdate: new Date().toISOString()
      },
      leave: {
        annualLeave: {
          entitlementDays: 60,
          availedDays: 38,
          balanceDays: 22
        },
        casualLeave: {
          entitlementDays: 15,
          availedDays: 9,
          balanceDays: 6
        },
        overdueDeficit: false,
        overdueDeficitDays: 0,
        lastLeaveAvailedDate: '2026-05-10',
        nextEligibleLeaveDate: '2026-10-15',
        pendingLeaveApplications: []
      },
      deployment: {
        currentZone: 'Active Operational Sector',
        hardshipTier: 'CATEGORY_B_FIELD',
        altitudeCategory: 'Tactical Outpost',
        monthsInCurrentPosting: 12,
        deploymentHistory: [
          { posting: 'Field Sector A', from: '2020-01', to: '2023-03', hardship: 'HIGH' },
          { posting: unit, from: '2023-04', to: 'Present', hardship: 'MODERATE' }
        ]
      },
      training: {
        completedCourses: [
          { courseCode: 'TAC-101', courseName: 'Operational Readiness & Field Craft', year: 2022, grade: 'AX' },
          { courseCode: 'WEL-01', courseName: 'Forces Mental Health & Resilience Orientation', year: 2024, grade: 'AX' }
        ],
        annualFiringClassification: 'Marksman',
        lastBPETDate: '2026-06-01',
        bpetScore: 'EXCELLENT',
        welfareOrientationStatus: 'COMPLETED'
      },
      workload: {
        weeklyDutyHoursLogged: [50, 52, 54, 52],
        averageWeeklyHours: 52,
        nightShiftsPastMonth: 8,
        continuousDutyDaysCurrent: 4,
        standbyHoursPastMonth: 32,
        restDaysMandatory: 4,
        restDaysGranted: 3,
        complianceIndex: '90% (Satisfactory Pacing)'
      }
    };
  }

  async getPersonnelRecord(personnelId) {
    const mockDb = this._loadMockDatabase();
    if (mockDb.records && mockDb.records[personnelId]) {
      return {
        ...mockDb.records[personnelId],
        isSimulated: true,
        mockDisclaimer: this.mockDisclaimer,
        retrievedAt: new Date().toISOString()
      };
    }

    // Try finding user in database to create accurate synthetic dossier
    const user = await db.Users.findOne({ personnelId });
    const synthetic = this._generateSyntheticDossier(personnelId, user || {});
    return {
      ...synthetic,
      mockDisclaimer: this.mockDisclaimer,
      retrievedAt: new Date().toISOString()
    };
  }

  async getCategoryData(category, personnelId) {
    const record = await this.getPersonnelRecord(personnelId);
    if (!this.supportedDomains.includes(category)) {
      throw new Error(`Invalid HRMS domain '${category}'. Supported: ${this.supportedDomains.join(', ')}`);
    }

    return {
      personnelId,
      domain: category,
      category: category,
      isSimulated: true,
      mockDisclaimer: this.mockDisclaimer,
      data: record[category] || {},
      retrievedAt: new Date().toISOString()
    };
  }

  async syncPersonnelFromHRMS(personnelId, requestingUserId = null) {
    const hrmsDossier = await this.getPersonnelRecord(personnelId);

    // Synchronize to local personnel DB profile if present
    const personnelDoc = await db.Personnel.findOne({ personnelId });
    if (personnelDoc) {
      const updatedFields = {
        leavePattern: {
          accruedLeaveDays: hrmsDossier.leave?.annualLeave?.entitlementDays || 60,
          consumedLeaveDays: hrmsDossier.leave?.annualLeave?.availedDays || 40,
          pendingLeaveBalance: hrmsDossier.leave?.annualLeave?.balanceDays || 20,
          lastLeaveDate: hrmsDossier.leave?.lastLeaveAvailedDate || '2026-04-10',
          consecutiveDutyDays: hrmsDossier.workload?.continuousDutyDaysCurrent || 4,
          overdueLeaveDeficit: hrmsDossier.leave?.overdueDeficit || false
        },
        deploymentHistory: {
          tenureMonths: hrmsDossier.deployment?.monthsInCurrentPosting || 12,
          hardshipClassification: hrmsDossier.deployment?.hardshipTier || 'CATEGORY_B_FIELD',
          highAltitudePosting: (hrmsDossier.deployment?.altitudeCategory || '').includes('High Altitude'),
          previousDeployments: hrmsDossier.deployment?.deploymentHistory || []
        },
        dutySchedule: {
          shiftPattern: hrmsDossier.duty?.shiftTiming || 'Rotational',
          watchHoursPerDay: 8,
          nightShiftFrequency: `${hrmsDossier.workload?.nightShiftsPastMonth || 8} shifts/mo`,
          lastRosterChange: hrmsDossier.duty?.lastRosterUpdate || new Date().toISOString()
        },
        trainingCommitments: {
          upcomingCourses: [],
          mandatoryReadinessCourses: (hrmsDossier.training?.completedCourses || []).map(c => c.courseName),
          trainingFatigueIndex: 'MODERATE'
        },
        workloadTrends: {
          averageWeeklyHours: hrmsDossier.workload?.averageWeeklyHours || 52,
          recentHoursHistory: hrmsDossier.workload?.weeklyDutyHoursLogged || [50, 52, 54, 52],
          workloadTrajectory: 'STABLE',
          highWorkloadConsecutiveWeeks: 1
        }
      };

      await db.Personnel.findByIdAndUpdate(personnelDoc._id, updatedFields);
    }

    // Log audit event
    await auditService.log({
      action: 'HRMS_SYNC_COMPLETED',
      userId: requestingUserId,
      personnelId,
      targetResource: 'HRMS_Integration',
      details: {
        isSimulated: true,
        domainsSynced: this.supportedDomains,
        syncSource: 'SIMULATED_MOCK_HRMS_GATEWAY'
      }
    });

    return {
      success: true,
      isSimulated: true,
      mockDisclaimer: this.mockDisclaimer,
      message: `Personnel record ${personnelId} successfully synchronized from simulated HRMS gateway.`,
      synchronizedAt: new Date().toISOString(),
      dossier: hrmsDossier
    };
  }
}

module.exports = new HRMSService();
