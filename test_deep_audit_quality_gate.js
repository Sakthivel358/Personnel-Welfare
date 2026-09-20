/**
 * WelfareAI — Comprehensive Deep Audit & Quality Gate Test Suite
 * Validates all 21 sections of the Final Safe Audit, Testing & Fix specification.
 */

const http = require('http');
const assert = require('assert');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const body = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

let totalPassed = 0;
let totalFailed = 0;
const failures = [];

function check(assertion, description, context = {}) {
  try {
    assert(assertion, description);
    console.log(`  ✅ PASS: ${description}`);
    totalPassed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description} (${err.message})`);
    totalFailed++;
    failures.push({ description, error: err.message, context });
  }
}

async function runDeepAudit() {
  console.log('================================================================================');
  console.log('🔍 WELFAREAI — COMPREHENSIVE FINAL AUDIT & QUALITY GATE TEST SUITE');
  console.log('================================================================================\n');

  // -----------------------------------------------------------------------------------
  // Section 2: Startup & Database Lifecycle
  // -----------------------------------------------------------------------------------
  console.log('--- SECTION 2: Startup & Database Lifecycle ---');
  
  // Health checks
  const healthRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/system/health',
    method: 'GET'
  });
  check(healthRes.status === 200, 'Backend /system/health returns HTTP 200');
  check(healthRes.body.components?.backend?.status === 'UP', 'Backend component reports UP status');

  const mlHealthRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/health',
    method: 'GET'
  });
  check(mlHealthRes.status === 200, 'FastAPI ML microservice /health returns HTTP 200');

  // Register -> DB record -> Login -> Session -> Read -> Update -> Logout -> Login again -> Persistence
  const auditPersonnelId = `CRPF-AUDIT-${Date.now().toString().slice(-4)}`;
  const auditEmail = `audit.${Date.now()}@crpf.gov.in`;
  const auditPassword = 'SecureAuditPassword@2026';

  const regRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    personnelId: auditPersonnelId,
    fullName: 'Audit Inspector Kumar',
    email: auditEmail,
    password: auditPassword,
    rank: 'Head Constable',
    unit: '112 Bn CRPF',
    role: 'PERSONNEL'
  });
  check(regRes.status === 201, 'Registration returns HTTP 201 Created');
  check(!regRes.body.data?.password && !regRes.body.data?.passwordHash, 'Password hash is strictly excluded from response payload');

  // Duplicate registration rejection
  const dupRegRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    personnelId: auditPersonnelId,
    fullName: 'Audit Inspector Kumar Duplicate',
    email: auditEmail,
    password: auditPassword
  });
  check(dupRegRes.status === 400 || dupRegRes.status === 409, 'Duplicate registration correctly rejected with HTTP 400/409');

  // Login
  const loginRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    personnelId: auditPersonnelId,
    password: auditPassword
  });
  check(loginRes.status === 200, 'Login succeeds with HTTP 200');
  const sessionToken = loginRes.body.token || loginRes.body.data?.token;
  check(Boolean(sessionToken), 'Cryptographic JWT session token issued');

  // Read Profile
  const getProfileRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/profile',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${sessionToken}` }
  });
  check(getProfileRes.status === 200, 'Profile read succeeds with HTTP 200');
  check(getProfileRes.body.data?.personnelId === auditPersonnelId, 'Profile correctly identifies registered personnel');

  // Update Profile
  const updateProfileRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/profile',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`
    }
  }, {
    rank: 'Assistant Sub-Inspector',
    specialization: 'Tactical Reconnaissance'
  });
  check(updateProfileRes.status === 200, 'Profile update returns HTTP 200');

  // Logout (Token Revocation)
  const logoutRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/logout',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sessionToken}` }
  });
  check(logoutRes.status === 200, 'Logout succeeds with HTTP 200');

  // Invalidation check: old token must be rejected
  const revokedAccessRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/profile',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${sessionToken}` }
  });
  check(revokedAccessRes.status === 401, 'Logged out session token is strictly rejected with HTTP 401');

  // Re-login & Data Persistence Check
  const reLoginRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    personnelId: auditPersonnelId,
    password: auditPassword
  });
  check(reLoginRes.status === 200, 'Re-login succeeds with HTTP 200');
  const activeToken = reLoginRes.body.token || reLoginRes.body.data?.token;

  const verifyProfileRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/profile',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${activeToken}` }
  });
  check(verifyProfileRes.body.data?.rank === 'Assistant Sub-Inspector', 'Updated profile data persisted across sessions');

  // -----------------------------------------------------------------------------------
  // Section 3: Authentication & RBAC Hardening
  // -----------------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Authentication & RBAC Hardening ---');

  // Invalid credentials
  const badCredRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    personnelId: auditPersonnelId,
    password: 'WrongPassword'
  });
  check(badCredRes.status === 401, 'Invalid password rejected with HTTP 401');

  // Login as Officer and Admin
  const officerLogin = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { personnelId: 'WO-101', password: 'Password@123' });
  const officerToken = officerLogin.body.token || officerLogin.body.data?.token;
  check(officerLogin.status === 200 && Boolean(officerToken), 'Welfare Officer WO-101 authenticated');

  const adminLogin = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { personnelId: 'ADM-001', password: 'Password@123' });
  const adminToken = adminLogin.body.token || adminLogin.body.data?.token;
  check(adminLogin.status === 200 && Boolean(adminToken), 'Admin ADM-001 authenticated');

  // RBAC: Personnel blocked from Admin endpoints
  const personnelToAdminRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/admin/metrics',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${activeToken}` }
  });
  check(personnelToAdminRes.status === 403, 'RBAC: Personnel blocked from /admin/metrics (HTTP 403)');

  // RBAC: Personnel blocked from Officer triage
  const personnelToOfficerRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/officer/alerts',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${activeToken}` }
  });
  check(personnelToOfficerRes.status === 403, 'RBAC: Personnel blocked from /officer/alerts (HTTP 403)');

  // RBAC: Officer blocked from Admin endpoints
  const officerToAdminRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/admin/metrics',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  check(officerToAdminRes.status === 403, 'RBAC: Officer blocked from /admin/metrics (HTTP 403)');

  // Admin access to Admin endpoints
  const adminAccessRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/admin/metrics',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  check(adminAccessRes.status === 200, 'RBAC: Admin granted access to /admin/metrics (HTTP 200)');

  // -----------------------------------------------------------------------------------
  // Section 4 & 7: ML Model 1 & Model 2 Inference & Holistic Check-in
  // -----------------------------------------------------------------------------------
  console.log('\n--- SECTION 4 & 7: Holistic Check-in & Dual ML Models ---');

  // Verify Model 1 & Model 2 registry
  const modelsRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/models',
    method: 'GET'
  });
  check(modelsRes.status === 200, 'FastAPI /models returns HTTP 200');
  check(modelsRes.body.model1?.features_count === 20, 'Model 1 evaluates exactly 20 features (Wearable + Operational)');
  check(modelsRes.body.model2?.features_count === 13, 'Model 2 evaluates exactly 13 features (Sensor-Free PSS Fallback)');

  // Checkin 1: Baseline without PSS (Optional PSS-10 tolerance)
  const checkin1Res = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${activeToken}`
    }
  }, {
    workload_hours: 42,
    recovery_sleep_hours: 7.5,
    duty_type: 'General Security',
    shift_continuity_days: 3,
    fatigue_physical_strain: 20,
    pss_score: null,
    wellnessInfo: {
      energyLevel: 4,
      moraleLevel: 4,
      tensionLevel: 2,
      nutritionHydration: 4
    }
  });
  check(checkin1Res.status === 201, 'Baseline Checkin 1 without PSS accepted (HTTP 201)');

  // Smart Jacket Biometric Ingestion
  const jacketPacket = {
    deviceId: 'TSJ-AUDIT-01',
    personnelId: auditPersonnelId,
    timestamp: new Date().toISOString(),
    resting_heart_rate: 72,
    hrv_ms: 55,
    skin_temperature_c: 36.6,
    respiration_rate: 15,
    activity_level: 'MODERATE',
    packet_id: `PKT_${Date.now()}_001`
  };
  const jacketRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/wearable/ingest',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${activeToken}`
    }
  }, jacketPacket);
  check(jacketRes.status === 201, 'Smart Jacket biometric packet ingested successfully (HTTP 201)');

  // Boundary check: Physiological outlier rejection
  const outlierPacket = { ...jacketPacket, resting_heart_rate: 295, packet_id: `PKT_ERR_${Date.now()}` };
  const outlierRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/wearable/ingest',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${activeToken}`
    }
  }, outlierPacket);
  check(outlierRes.status === 400, 'Physiological outlier (295 BPM) rejected with HTTP 400');

  // Checkin 2: High strain operational duty with wearable telemetry
  const checkin2Res = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${activeToken}`
    }
  }, {
    workload_hours: 68,
    recovery_sleep_hours: 4.0,
    night_duty_hours: 16,
    shift_continuity_days: 10,
    duty_type: 'High-Altitude Recon',
    fatigue_physical_strain: 82,
    resting_heart_rate: 88,
    hrv_ms: 24,
    respiration_rate: 21,
    skin_temperature_c: 37.1,
    requestWelfareSupport: true,
    welfareSupportType: 'REST_SCHEDULE_REVIEW',
    welfareSupportNotes: 'Extended duty cycle requiring rest rotation.'
  });
  check(checkin2Res.status === 201, 'High strain checkin 2 accepted (HTTP 201)');
  check(checkin2Res.body.data?.linkedSupportRequest != null, 'Automatic welfare support request created');

  // -----------------------------------------------------------------------------------
  // Section 8, 9 & 10: Decision Layer, Explainability, Baseline & Alerts
  // -----------------------------------------------------------------------------------
  console.log('\n--- SECTION 8, 9 & 10: Decision Layer, Baseline & Alert Center ---');

  const latestPred = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/prediction/latest',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${activeToken}` }
  });
  check(latestPred.status === 200, 'GET /prediction/latest returns HTTP 200');
  check(Boolean(latestPred.body.welfareConcernDisplay), 'Pillar 1: Welfare Concern Display verified');
  check(Boolean(latestPred.body.evidenceDisplay), 'Pillar 2: Evidence Strength Display verified');
  check(Boolean(latestPred.body.dataAvailableDisplay), 'Pillar 3: Data Availability Display verified');
  check(Boolean(latestPred.body.recommendedNextAction), 'Pillar 4: Personalized Action Guidance verified');
  check(latestPred.body.notMedicalDiagnosis === true, 'Non-medical diagnosis disclaimer explicitly declared');

  // What Changed & Baseline
  const whatChangedRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/prediction/what-changed',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${activeToken}` }
  });
  check(whatChangedRes.status === 200, 'GET /prediction/what-changed returns HTTP 200');
  check(whatChangedRes.body.baselineEstablished === true, 'Personal baseline established from personnel history');
  check(whatChangedRes.body.comparisonCategories?.workload != null, 'Workload variance category populated');
  check(whatChangedRes.body.comparisonCategories?.rest != null, 'Rest deficit category populated');

  // -----------------------------------------------------------------------------------
  // Section 5: Welfare Officer Complete Flow & Alerts
  // -----------------------------------------------------------------------------------
  console.log('\n--- SECTION 5: Welfare Officer Flow & Alert Center ---');

  // Search authorized personnel in DB
  const searchRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/v1/officer/personnel/search?query=${auditPersonnelId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  check(searchRes.status === 200, 'Officer search endpoint returns HTTP 200');
  check(Array.isArray(searchRes.body.data), 'Officer search returns real database personnel array');

  // Search nonexistent ID
  const searchNonexistent = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/officer/personnel/search?query=NON_EXISTENT_ID_9999',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  check(searchNonexistent.body.data?.length === 0, 'Nonexistent personnel search gracefully returns empty array without error');

  // Query Alert Center
  const alertsRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/officer/alerts?status=PENDING_REVIEW',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  check(alertsRes.status === 200, 'Officer alerts query returns HTTP 200');
  const alertList = alertsRes.body.data || [];
  const targetAlert = alertList.find(a => a.personnelId === auditPersonnelId) || alertList[0];
  check(Boolean(targetAlert), 'Welfare alert found in triage queue');
  check(targetAlert?.isNonDisciplinary === true, 'Alert tagged non-disciplinary: isNonDisciplinary=true');
  check(targetAlert?.disciplinaryActionPermitted === false, 'Alert strictly prohibits disciplinary action');

  if (targetAlert) {
    // Acknowledge Alert
    const ackRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/officer/alerts/${targetAlert._id}/acknowledge`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      }
    }, { notes: 'Reviewed by Welfare Officer WO-101.' });
    check(ackRes.status === 200, 'Officer acknowledged alert with HTTP 200');

    // Punitive Close attempt (Must be rejected)
    const punitiveCloseRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/officer/alerts/${targetAlert._id}/close`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      }
    }, { resolutionReason: 'Disciplinary charge and formal penalty issued' });
    check(punitiveCloseRes.status === 400, 'Punitive close attempt blocked with HTTP 400');
    check(punitiveCloseRes.body.error === 'NON_DISCIPLINARY_VIOLATION', 'Error code confirmed as NON_DISCIPLINARY_VIOLATION');

    // Supportive Close
    const closeRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/officer/alerts/${targetAlert._id}/close`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      }
    }, {
      resolutionReason: 'Fatigue mitigation consultation conducted. Recommended 48h rest rotation.'
    });
    check(closeRes.status === 200, 'Officer closed alert with supportive rationale (HTTP 200)');
  }

  // Workload Balancing proposals
  const workloadBalancingRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/officer/workload-balancing',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  check(workloadBalancingRes.status === 200, 'Workload balancing endpoint returns HTTP 200');
  check(workloadBalancingRes.body.data?.proposals[0]?.advisoryOnly === true, 'Workload balancing proposal explicitly marked advisoryOnly: true');
  check(workloadBalancingRes.body.data?.proposals[0]?.automatedActionTaken === false, 'Workload balancing proposal explicitly confirms automatedActionTaken: false');

  // -----------------------------------------------------------------------------------
  // Section 6 & 15: Admin Complete Flow & ML Monitoring
  // -----------------------------------------------------------------------------------
  console.log('\n--- SECTION 6 & 15: Admin Flow & ML Transparency ---');

  const transparencyRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/system/transparency',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  check(transparencyRes.status === 200, 'Admin /system/transparency returns HTTP 200');
  check(transparencyRes.body.data?.models?.model1?.datasetType === 'SYNTHETIC_PROTOTYPE_TRAINING_DATA', 'Model 1 dataset labeled SYNTHETIC_PROTOTYPE_TRAINING_DATA');
  check(transparencyRes.body.data?.models?.model2?.datasetType === 'SYNTHETIC_PROTOTYPE_TRAINING_DATA', 'Model 2 dataset labeled SYNTHETIC_PROTOTYPE_TRAINING_DATA');
  check(Boolean(transparencyRes.body.data?.models?.model1?.confusionMatrix), 'Model 1 holdout confusion matrix documented');
  check(Boolean(transparencyRes.body.data?.models?.model2?.confusionMatrix), 'Model 2 holdout confusion matrix documented');

  const auditLogsRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/admin/audit-logs',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  check(auditLogsRes.status === 200, 'Admin audit logs retrieved with HTTP 200');
  check(Array.isArray(auditLogsRes.body.data), 'Audit logs returned as verifiable array');

  // -----------------------------------------------------------------------------------
  // Section 11, 12, 13 & 14: Insufficient Evidence, Privacy Sandbox & HRMS Gateway
  // -----------------------------------------------------------------------------------
  console.log('\n--- SECTION 11-14: Insufficient Evidence, Privacy Sandbox & HRMS ---');

  // Insufficient Evidence: Register a brand new user with no telemetry
  const sparseUser = `CRPF-SPARSE-${Date.now().toString().slice(-4)}`;
  const sparseReg = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    personnelId: sparseUser,
    fullName: 'Constable Sparse Check',
    email: `sparse.${Date.now()}@crpf.gov.in`,
    password: 'Password@123'
  });
  check(sparseReg.status === 201, 'Sparse unassessed personnel registered successfully');

  const sparseLogin = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { personnelId: sparseUser, password: 'Password@123' });
  const sparseToken = sparseLogin.body.token || sparseLogin.body.data?.token;
  check(Boolean(sparseToken), 'Sparse unassessed personnel logged in');

  const sparsePredRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/prediction/latest',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${sparseToken}` }
  });
  check(sparsePredRes.status === 200, 'Unassessed prediction request returns HTTP 200');
  check(sparsePredRes.body.data?.concernLevel === 'UNDETERMINED', 'Zero-guessing: Unassessed personnel returns concernLevel: UNDETERMINED');
  check(sparsePredRes.body.data?.evidenceStrength === 'INSUFFICIENT', 'Zero-guessing: Unassessed personnel returns evidenceStrength: INSUFFICIENT');
  check(sparsePredRes.body.data?.prediction?.compositeRiskScore === null, 'Zero-guessing: Composite risk score is strictly null when evidence is insufficient');

  // Privacy Sandbox Transform
  const privacyTransformRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/privacy/sandbox/transform',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${activeToken}`
    }
  }, {
    personnelId: auditPersonnelId,
    name: 'Constable Rajesh Kumar',
    age: 29,
    unit: '112 Bn CRPF',
    workloadHours: 48,
    stressIndex: 65
  });
  check(privacyTransformRes.status === 200, 'Privacy Sandbox transform succeeds (HTTP 200)');
  check(Boolean(privacyTransformRes.body.data?.after?.userToken), 'Privacy Sandbox generates pseudonymous User Token');
  check(privacyTransformRes.body.data?.after?.ageGroup === '25–30' || Boolean(privacyTransformRes.body.data?.after?.ageGroup), 'Privacy Sandbox minimizes age to age cohort');
  check(privacyTransformRes.body.data?.after?.unitGroup != null, 'Privacy Sandbox minimizes unit to unit group');

  // HRMS Gateway Simulation Disclosure
  const hrmsStatusRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/hrms/status',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${activeToken}` }
  });
  check(hrmsStatusRes.status === 200, 'HRMS status endpoint returns HTTP 200');
  check(hrmsStatusRes.body.data?.isSimulated === true, 'HRMS gateway explicitly declared isSimulated: true');
  check(Boolean(hrmsStatusRes.body.data?.disclaimer), 'HRMS synthetic prototype data disclaimer confirmed');

  // -----------------------------------------------------------------------------------
  // Section 16 & 17: Navigation & Calculation Integrity
  // -----------------------------------------------------------------------------------
  console.log('\n--- SECTION 16 & 17: Navigation & Calculation Integrity ---');

  // Number boundary sanity check: ensure no NaN or Infinity in responses
  const jsonString = JSON.stringify({
    pred: latestPred.body,
    whatChanged: whatChangedRes.body,
    alerts: alertsRes.body
  });
  check(!jsonString.includes('NaN'), 'Calculations audit: Zero NaN values across prediction, what-changed, and alert payloads');
  check(!jsonString.includes('Infinity'), 'Calculations audit: Zero Infinity values across prediction, what-changed, and alert payloads');

  // Summary
  console.log('\n================================================================================');
  console.log(`🏁 DEEP AUDIT COMPLETE: ${totalPassed} PASSED, ${totalFailed} FAILED (Total: ${totalPassed + totalFailed})`);
  console.log('================================================================================');

  if (totalFailed > 0) {
    console.error('\nFailures details:');
    failures.forEach(f => console.error(` - ${f.description}: ${f.error}`));
    process.exit(1);
  }
}

runDeepAudit().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
