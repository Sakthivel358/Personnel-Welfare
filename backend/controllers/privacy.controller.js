/**
 * Privacy Controller for SIH26186 Personnel Welfare System
 * Tasks 35 & 36: Privacy Sandbox and Identity-Analytics Separation Endpoints
 */
const privacyService = require('../services/privacy.service');
const auditService = require('../services/audit.service');
const securityMonitoring = require('../services/securityMonitoring.service');

/**
 * GET /api/v1/privacy/sandbox/sample
 * Returns canonical sample matching user prompt:
 * Before: Name: Ravi Kumar, Service ID: CRPF10452, Age: 27
 * After: User Token: USR_7F29A, Age Group: 25–30, Unit Group, Workload, Stress Index
 */
const getSandboxSample = async (req, res, next) => {
  try {
    const canonicalSample = privacyService.transformToPrivacySandbox({
      name: 'Ravi Kumar',
      serviceId: 'CRPF10452',
      age: 27,
      unit: '7th Battalion Bravo Company',
      workloadHours: 64,
      stressScore: 68,
      concernLevel: 'Moderate',
      phone: '9876543210'
    });

    const alternateSamples = [
      privacyService.transformToPrivacySandbox({
        name: 'Priya Sharma',
        serviceId: 'BSF-77219',
        age: 34,
        unit: 'Sector-I Frontier Guard Border Post 12',
        workloadHours: 72,
        stressScore: 82,
        concernLevel: 'High',
        phone: '9812345678'
      }),
      privacyService.transformToPrivacySandbox({
        name: 'Amit Singh',
        serviceId: 'CISF-30411',
        age: 22,
        unit: 'Sector-II Airport Security Unit',
        workloadHours: 46,
        stressScore: 35,
        concernLevel: 'Low',
        phone: '9845671234'
      })
    ];

    return res.status(200).json({
      success: true,
      data: {
        primary: canonicalSample,
        presets: [canonicalSample, ...alternateSamples]
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/privacy/sandbox/transform
 * Interactive dynamic transformation endpoint
 */
const transformSandboxRecord = async (req, res, next) => {
  try {
    const input = req.body || {};
    const transformed = privacyService.transformToPrivacySandbox(input);

    if (req.user) {
      await auditService.log({
        action: 'PRIVACY_SANDBOX_TRANSFORM_EXECUTED',
        userId: req.user._id,
        personnelId: req.user.personnelId,
        targetResource: 'PrivacySandbox',
        ipAddress: req.ip,
        details: { requestedId: input.serviceId ? privacyService.maskIdentifier(input.serviceId) : 'ANONYMOUS' }
      });
    }

    return res.status(200).json({
      success: true,
      data: transformed
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/privacy/status
 * Returns system-wide privacy architecture status
 */
const getPrivacyStatus = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        architecture: 'Decoupled Identity and Welfare Analytics Protocol',
        pseudonymization: {
          status: 'ACTIVE',
          algorithm: 'HMAC-SHA256 User Tokenization',
          tokenFormat: 'USR_<HEX5>',
          example: 'USR_7F29A'
        },
        dataMinimization: {
          status: 'ACTIVE',
          ageBucketing: '5-Year Cohorts (<20, 20–24, 25–30, 31–35, 36–40, 41–45, 46–50, 50+)',
          spatialGeneralization: 'Tactical Unit Grouping',
          workloadBucketing: 'Standard / Moderate / Elevated Workload Categories'
        },
        masking: {
          serviceIdMasking: 'CRPF*****52',
          nameMasking: 'R*** K****',
          phoneMasking: '******3210'
        },
        roleBasedAccessControl: {
          personnel: 'Self-telemetry and personal recommendations only',
          welfareOfficer: 'Triage queue with non-punitive casework and logged de-identification audit',
          commander: 'Cohort-aggregated de-identified analytics only (min k >= 5)',
          administrator: 'System health, governance audit trails, and configuration'
        },
        legalSafeguards: {
          nonDisciplinaryMandate: 'An ML prediction must never automatically become a disciplinary action.',
          enforcedByForceDirective: 'W-2026-PRIVACY-NON-PUNITIVE'
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

const db = require('../models/dbAdapter');

/**
 * GET /api/v1/privacy/consent
 * Returns personnel consent settings, data permissions, usage explanations, and minimization status
 */
const getPersonnelConsent = async (req, res, next) => {
  try {
    const userId = req.user._id;
    let consentDoc = await db.Consent.findOne({ userId });

    if (!consentDoc) {
      consentDoc = {
        userId,
        personnelId: req.user.personnelId,
        allowSelfCheckSubjective: true,
        allowWearableBiometrics: true,
        allowLongitudinalTrends: true,
        contributeAnonymizedResearch: true,
        telemetryGranularity: 'FULL',
        pseudonymizeIdentity: true,
        consentVersion: 'v1.0-2026',
        lastConsentUpdatedAt: new Date().toISOString()
      };
    }

    const consentWithAliases = {
      ...consentDoc,
      allowSelfCheckData: consentDoc.allowSelfCheckSubjective !== undefined ? consentDoc.allowSelfCheckSubjective : true,
      allowWearableData: consentDoc.allowWearableBiometrics !== undefined ? consentDoc.allowWearableBiometrics : true,
      anonymousAggregatedStats: consentDoc.contributeAnonymizedResearch !== undefined ? consentDoc.contributeAnonymizedResearch : true,
      dataMinimizationLevel: consentDoc.telemetryGranularity || 'FULL'
    };

    const explanations = {
      allowSelfCheckSubjective: {
        title: 'Optional Self-Check Subjective Ratings',
        purpose: 'Used to track personal energy, morale, and perceived stress trends for timely shift pacing adjustments and fatigue recovery advisory.',
        legalBasis: 'Voluntary Personnel Wellness Monitoring',
        retentionPeriod: 'Rolling 180-day operational retention window',
        nonPunitiveGuarantee: 'Responses cannot be cited in performance appraisals, promotions, or disciplinary actions.'
      },
      allowWearableBiometrics: {
        title: 'Continuous Wearable Sensor Telemetry (Smart Jacket / Band)',
        purpose: 'Processes real-time autonomic indicators (resting HR, HRV, skin temperature) solely to detect physiological fatigue and alert officers to schedule rest rotations.',
        legalBasis: 'Force Health Protection Directive',
        retentionPeriod: 'Processed in memory; raw telemetry purged after 30 days; only aggregated daily indexes retained',
        nonPunitiveGuarantee: 'Physiological data is confidential medical/welfare information and never accessible to disciplinary boards.'
      },
      allowLongitudinalTrends: {
        title: 'Longitudinal Welfare Trajectory Tracking',
        purpose: 'Computes multi-week trajectory comparisons (Stable, Improving, Elevated) across duty postings to prevent chronic cumulative burnout.',
        legalBasis: 'Occupational Health & Pacing Optimization',
        retentionPeriod: 'Active service duration',
        nonPunitiveGuarantee: 'Enables early recovery interventions before acute health degradation occurs.'
      },
      contributeAnonymizedResearch: {
        title: 'Anonymized Research & Roster Optimization Contribution',
        purpose: 'Aggregated, de-identified statistical indicators contribute to defense policy research on optimal patrol shift architectures.',
        legalBasis: 'K-Anonymized Defense Research Framework',
        retentionPeriod: 'Perpetual statistical aggregate (Zero identifiable PII)',
        nonPunitiveGuarantee: 'Completely unlinked from individual personnel identities.'
      },
      voluntaryNature: '100% voluntary with granular per-category opt-in/opt-out',
      nonPunitiveGuarantee: 'Under Force Welfare Directives, health and check-in telemetry can never automatically become a disciplinary action or punitive measure.'
    };

    return res.status(200).json({
      success: true,
      data: {
        consent: consentWithAliases,
        explanations,
        dataUsageExplanations: explanations,
        dataMinimizationOptions: [
          {
            level: 'FULL',
            title: 'Complete Telemetry',
            description: 'Includes detailed workload hours, sleep breakdown, sensor telemetry, and optional self-check responses.'
          },
          {
            level: 'COARSE',
            title: 'Coarse Aggregation',
            description: 'Buckets workload into 5-hour bands and provides overall composite risk score without raw biometrics.'
          },
          {
            level: 'MINIMAL',
            title: 'Minimal Welfare Alert-Only',
            description: 'Suppresses intermediate indicators; only transmits an alert when composite strain reaches High Concern threshold.'
          }
        ]
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/privacy/consent
 * Updates personnel consent and privacy control preferences with audit logging
 */
const updatePersonnelConsent = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const {
      allowSelfCheckSubjective,
      allowSelfCheckData,
      allowWearableBiometrics,
      allowWearableData,
      allowLongitudinalTrends,
      contributeAnonymizedResearch,
      anonymousAggregatedStats,
      telemetryGranularity,
      dataMinimizationLevel,
      pseudonymizeIdentity
    } = req.body;

    const requestedGranularity = telemetryGranularity || dataMinimizationLevel;
    const validGranularities = ['FULL', 'COARSE', 'MINIMAL', 'FULL_TELEMETRY', 'COARSE_AGGREGATE', 'MINIMAL_ANONYMIZED'];
    if (requestedGranularity && !validGranularities.includes(requestedGranularity)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid data minimization level. Allowed values: FULL, COARSE, MINIMAL.'
      });
    }
    const normalizedGranularity = requestedGranularity && requestedGranularity.startsWith('FULL') ? 'FULL' : (requestedGranularity && requestedGranularity.startsWith('COARSE') ? 'COARSE' : (requestedGranularity && requestedGranularity.startsWith('MINIMAL') ? 'MINIMAL' : (requestedGranularity || 'FULL')));
    const chosenGranularity = normalizedGranularity;

    const selfCheckVal = allowSelfCheckSubjective !== undefined ? allowSelfCheckSubjective : (allowSelfCheckData !== undefined ? allowSelfCheckData : true);
    const wearableVal = allowWearableBiometrics !== undefined ? allowWearableBiometrics : (allowWearableData !== undefined ? allowWearableData : true);
    const researchVal = contributeAnonymizedResearch !== undefined ? contributeAnonymizedResearch : (anonymousAggregatedStats !== undefined ? anonymousAggregatedStats : true);

    let consentDoc = await db.Consent.findOne({ userId });
    const updatePayload = {
      userId,
      personnelId: req.user.personnelId,
      allowSelfCheckSubjective: Boolean(selfCheckVal),
      allowWearableBiometrics: Boolean(wearableVal),
      allowLongitudinalTrends: allowLongitudinalTrends !== undefined ? Boolean(allowLongitudinalTrends) : true,
      contributeAnonymizedResearch: Boolean(researchVal),
      telemetryGranularity: chosenGranularity,
      pseudonymizeIdentity: pseudonymizeIdentity !== undefined ? Boolean(pseudonymizeIdentity) : true,
      consentVersion: 'v1.0-2026',
      lastConsentUpdatedAt: new Date().toISOString()
    };

    let result;
    if (consentDoc) {
      result = await db.Consent.findByIdAndUpdate(consentDoc._id, updatePayload);
    } else {
      result = await db.Consent.create(updatePayload);
    }

    // Merge aliases into result
    const resultWithAliases = {
      ...result,
      allowSelfCheckData: result.allowSelfCheckSubjective,
      allowWearableData: result.allowWearableBiometrics,
      anonymousAggregatedStats: result.contributeAnonymizedResearch,
      dataMinimizationLevel: result.telemetryGranularity
    };

    // Also synchronize privacyPreferences on Personnel document if present
    const personnelDoc = await db.Personnel.findOne({
      $or: [{ userId }, { personnelId: req.user.personnelId }]
    });
    if (personnelDoc) {
      await db.Personnel.findByIdAndUpdate(personnelDoc._id, {
        privacyPreferences: {
          pseudonymizeTelemetry: updatePayload.pseudonymizeIdentity,
          dataSharingLevel: updatePayload.telemetryGranularity,
          researchConsent: updatePayload.contributeAnonymizedResearch
        }
      });
    }

    await securityMonitoring.recordSecurityConfigChange({
      ip: req.ip,
      userId: req.user._id,
      userRole: req.user.role,
      action: 'CONSENT_SETTINGS_UPDATED',
      targetResource: 'Consent',
      details: { telemetryGranularity: chosenGranularity }
    });

    await auditService.log({
      action: 'CONSENT_SETTINGS_UPDATED',
      userId: req.user._id,
      personnelId: req.user.personnelId,
      targetResource: 'Consent',
      ipAddress: req.ip,
      details: {
        telemetryGranularity: chosenGranularity,
        allowWearableBiometrics: updatePayload.allowWearableBiometrics,
        allowSelfCheckSubjective: updatePayload.allowSelfCheckSubjective,
        pseudonymizeIdentity: updatePayload.pseudonymizeIdentity
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Consent and data control preferences successfully updated.',
      data: {
        ...resultWithAliases,
        consent: resultWithAliases
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSandboxSample,
  transformSandboxRecord,
  getPrivacyStatus,
  getPersonnelConsent,
  updatePersonnelConsent
};
