/**
 * Privacy Controller for SIH26186 Personnel Welfare System
 * Tasks 35 & 36: Privacy Sandbox and Identity-Analytics Separation Endpoints
 */
const privacyService = require('../services/privacy.service');
const auditService = require('../services/audit.service');

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

module.exports = {
  getSandboxSample,
  transformSandboxRecord,
  getPrivacyStatus
};
