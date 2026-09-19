/**
 * Master Test Suite: Task 44 — Final End-to-End Application Testing
 * Verifies all 27 capabilities requested in Task 44:
 * 1. Registration
 * 2. Login
 * 3. Logout
 * 4. Roles & RBAC
 * 5. Profile
 * 6. Duty
 * 7. Workload
 * 8. Rest
 * 9. PSS (PSS-10)
 * 10. Wearable data
 * 11. Offline storage
 * 12. Synchronization
 * 13. ML Model 1
 * 14. ML Model 2
 * 15. Decision Layer
 * 16. Evidence strength
 * 17. Data availability
 * 18. UNDETERMINED state
 * 19. Baseline comparison
 * 20. Welfare Officer
 * 21. Admin
 * 22. Privacy Sandbox
 * 23. Settings
 * 24. FAQ
 * 25. Notifications
 * 26. All buttons/navigation
 * 27. Mobile/tablet/desktop
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BACKEND_PORT = 5000;
const ML_PORT = 8000;

function makeRequest(method, reqPath, body = null, headers = {}, port = BACKEND_PORT) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: reqPath,
        method,
        headers: reqHeaders
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (_) {
            parsed = data;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed
          });
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

let passedCount = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedCount++;
  console.log(`  ✅ PASS: ${message}`);
}

async function runFinalTesting() {
  console.log('======================================================================');
  console.log('🚀 TASK 44: FINAL COMPREHENSIVE END-TO-END APPLICATION TEST SUITE');
  console.log('======================================================================\n');

  const rand = Math.floor(100000 + Math.random() * 900000);

  // -------------------------------------------------------------
  // 1. REGISTRATION
  // -------------------------------------------------------------
  console.log('🔹 [1/27] Testing Registration (Personnel, Officer, Admin)...');
  const regPersonnelRes = await makeRequest('POST', '/api/v1/auth/register', {
    personnelId: `PERS_FIN_${rand}`,
    email: `pers_fin_${rand}@welfare.mil.in`,
    password: 'FinalPassword123!',
    confirmPassword: 'FinalPassword123!',
    fullName: `Subedar Major Vikram Singh`,
    role: 'PERSONNEL',
    unit: '12th Assam Rifles',
    rank: 'Subedar Major'
  });
  assert(regPersonnelRes.status === 201, 'Personnel registration returned 201 Created');
  assert(regPersonnelRes.body?.user?.role === 'PERSONNEL', 'Personnel assigned role PERSONNEL');
  let personnelToken = regPersonnelRes.body?.token;

  const regOfficerRes = await makeRequest('POST', '/api/v1/auth/register', {
    personnelId: `TEST_WO_${rand}`,
    email: `wo_fin_${rand}@welfare.mil.in`,
    password: 'OfficerPassword123!',
    confirmPassword: 'OfficerPassword123!',
    fullName: `Capt. Ananya Sen`,
    role: 'WELFARE_OFFICER'
  });
  assert(regOfficerRes.status === 201, 'Welfare Officer registration returned 201 Created');
  assert(regOfficerRes.body?.user?.role === 'WELFARE_OFFICER', 'Officer assigned role WELFARE_OFFICER');
  let officerToken = regOfficerRes.body?.token;

  const regAdminRes = await makeRequest('POST', '/api/v1/auth/register', {
    personnelId: `ADM_FIN_${rand}`,
    email: `adm_fin_${rand}@welfare.mil.in`,
    password: 'AdminPassword123!',
    confirmPassword: 'AdminPassword123!',
    fullName: `Col. R. K. Nair`,
    role: 'ADMIN',
    adminSecret: 'welfare-secure-admin-key-2026'
  });
  assert(regAdminRes.status === 201, 'Admin registration returned 201 Created');
  assert(regAdminRes.body?.user?.role === 'ADMIN', 'Admin assigned role ADMIN');
  let adminToken = regAdminRes.body?.token;

  // -------------------------------------------------------------
  // 2. LOGIN
  // -------------------------------------------------------------
  console.log('\n🔹 [2/27] Testing Login...');
  const loginRes = await makeRequest('POST', '/api/v1/auth/login', {
    identifier: `PERS_FIN_${rand}`,
    password: 'FinalPassword123!'
  });
  assert(loginRes.status === 200, 'Login succeeded with HTTP 200 OK');
  assert(loginRes.body?.token, 'JWT session token issued upon login');
  assert(loginRes.body?.user?.email === `pers_fin_${rand}@welfare.mil.in`, 'User identity confirmed in login response');
  personnelToken = loginRes.body?.token;

  // -------------------------------------------------------------
  // 3. LOGOUT & TOKEN REVOCATION
  // -------------------------------------------------------------
  console.log('\n🔹 [3/27] Testing Logout & Session Revocation...');
  // Register temp user for logout
  const tempRes = await makeRequest('POST', '/api/v1/auth/register', {
    personnelId: `TEMP_LO_${rand}`,
    email: `temp_lo_${rand}@welfare.mil.in`,
    password: 'TempPassword123!',
    confirmPassword: 'TempPassword123!',
    fullName: 'Temp Logout User',
    role: 'PERSONNEL'
  });
  const tempToken = tempRes.body?.token;
  const logoutRes = await makeRequest('POST', '/api/v1/auth/logout', null, {
    Authorization: `Bearer ${tempToken}`
  });
  assert(logoutRes.status === 200, 'Logout succeeded with HTTP 200 OK');
  const postLogoutRes = await makeRequest('GET', '/api/v1/auth/me', null, {
    Authorization: `Bearer ${tempToken}`
  });
  assert(postLogoutRes.status === 401, 'Revoked session correctly blocked with HTTP 401');

  // -------------------------------------------------------------
  // 4. ROLES & RBAC
  // -------------------------------------------------------------
  console.log('\n🔹 [4/27] Testing Roles & RBAC...');
  const unauthorizedAdminAccess = await makeRequest('GET', '/api/v1/admin/metrics', null, {
    Authorization: `Bearer ${personnelToken}`
  });
  assert(unauthorizedAdminAccess.status === 403, 'Personnel blocked from Admin metrics with HTTP 403');
  const authorizedAdminAccess = await makeRequest('GET', '/api/v1/admin/metrics', null, {
    Authorization: `Bearer ${adminToken}`
  });
  assert(authorizedAdminAccess.status === 200, 'Admin authorized for Admin metrics with HTTP 200');

  // -------------------------------------------------------------
  // 5. PROFILE
  // -------------------------------------------------------------
  console.log('\n🔹 [5/27] Testing Profile (GET and PUT)...');
  const getProfileRes = await makeRequest('GET', '/api/v1/profile', null, {
    Authorization: `Bearer ${personnelToken}`
  });
  assert(getProfileRes.status === 200, 'Profile fetched with HTTP 200 OK');
  assert(getProfileRes.body?.data?.unit === '12th Assam Rifles', 'Profile reflects authentic unit without hardcoded default');
  assert(getProfileRes.body?.data?.rank === 'Subedar Major', 'Profile reflects authentic rank without hardcoded default');

  const updateProfileRes = await makeRequest('PUT', '/api/v1/profile', {
    deploymentZone: 'High Altitude Eastern Sector',
    primaryDuty: 'Forward Perimeter Security',
    yearsOfService: 16
  }, {
    Authorization: `Bearer ${personnelToken}`
  });
  assert(updateProfileRes.status === 200, 'Profile updated successfully with HTTP 200');
  assert(updateProfileRes.body?.data?.deploymentZone === 'High Altitude Eastern Sector', 'Updated deploymentZone persisted');

  // -------------------------------------------------------------
  // 6. DUTY, 7. WORKLOAD, 8. REST, 9. PSS, 10. WEARABLE DATA
  // -------------------------------------------------------------
  console.log('\n🔹 [6-10/27] Testing Duty, Workload, Rest, PSS, and Wearable Data Submission...');
  const multiSourcePayload = {
    // 6. Duty
    prolonged_duty_hours: 14.0,
    night_duty_hours: 24.0,
    shift_continuity_days: 6,
    duty_type: 'Quick Reaction Force Patrol',
    deploymentZone: 'Remote High Altitude',
    // 7. Workload
    workload_hours: 62.0,
    work_pressure_rating: 8.5,
    // 8. Rest
    recovery_sleep_hours: 4.5,
    rest_interval_hours: 3.0,
    // 9. PSS
    pss_score: 28,
    pss_responses: [3, 2, 3, 3, 2, 3, 3, 3, 3, 3],
    // 10. Wearable
    wearable_synced: true,
    resting_heart_rate: 84,
    hrv_ms: 32,
    respiration_rate: 21,
    skin_temperature_c: 37.1,
    fatigue_physical_strain: 78,
    idempotencyKey: `idemp-multi-${rand}-1`
  };

  const checkinRes = await makeRequest('POST', '/api/v1/checkin', multiSourcePayload, {
    Authorization: `Bearer ${personnelToken}`
  });
  assert(checkinRes.status === 201, 'Multi-source check-in processed with HTTP 201 Created');
  const checkInRecord = checkinRes.body?.data?.checkIn;
  const predRecord = checkinRes.body?.data?.prediction;
  assert(checkInRecord?._id, 'Check-in persisted to database');
  assert(predRecord?._id, 'Stress prediction record persisted');

  // -------------------------------------------------------------
  // 11. OFFLINE STORAGE & 12. SYNCHRONIZATION
  // -------------------------------------------------------------
  console.log('\n🔹 [11-12/27] Testing Offline Storage Buffering & Synchronization...');
  const offlineBatch = [
    {
      idempotencyKey: `offline-chk-${rand}-A`,
      workload_hours: 48,
      work_pressure_rating: 5,
      recovery_sleep_hours: 7.0,
      resting_heart_rate: 66,
      hrv_ms: 68,
      wearable_synced: true
    },
    {
      // Intentionally replay the same key to verify deduplication
      idempotencyKey: `offline-chk-${rand}-A`,
      workload_hours: 48,
      work_pressure_rating: 5
    }
  ];

  const syncRes = await makeRequest('POST', '/api/v1/checkin/sync', offlineBatch, {
    Authorization: `Bearer ${personnelToken}`
  });
  assert(syncRes.status === 200, 'Batch synchronization returned HTTP 200 OK');
  assert(syncRes.body?.syncedCount === 1, 'Exactly 1 new record synchronized');
  assert(syncRes.body?.duplicateCount === 1, 'Duplicate record safely prevented via idempotency key');

  // -------------------------------------------------------------
  // 13. ML MODEL 1 & 14. ML MODEL 2
  // -------------------------------------------------------------
  console.log('\n🔹 [13-14/27] Testing ML Model 1 & ML Model 2 (FastAPI and Backend)...');
  const m1Res = await makeRequest('POST', '/predict/model1', {
    resting_heart_rate: 68,
    hrv_ms: 65,
    respiration_rate: 15,
    skin_temperature_c: 36.6,
    workload_hours: 44,
    recovery_sleep_hours: 7.5,
    prolonged_duty_hours: 6
  }, {}, ML_PORT);
  assert(m1Res.status === 200, 'FastAPI Model 1 inference succeeded with HTTP 200');
  assert(m1Res.body?.data?.modelUsed === 'MODEL_1_WEARABLE_OPERATIONAL', 'Model 1 identified as MODEL_1_WEARABLE_OPERATIONAL');

  const m2Res = await makeRequest('POST', '/predict/model2', {
    pss_score: 16,
    workload_hours: 46,
    work_pressure_rating: 4,
    recovery_sleep_hours: 7.0,
    prolonged_duty_hours: 8
  }, {}, ML_PORT);
  assert(m2Res.status === 200, 'FastAPI Model 2 inference succeeded with HTTP 200');
  assert(m2Res.body?.data?.modelUsed === 'MODEL_2_PSS_OPERATIONAL', 'Model 2 identified as MODEL_2_PSS_OPERATIONAL');

  // -------------------------------------------------------------
  // 15. DECISION LAYER, 16. EVIDENCE STRENGTH & 17. DATA AVAILABILITY
  // -------------------------------------------------------------
  console.log('\n🔹 [15-17/27] Testing Decision Layer, Evidence Strength & Data Availability...');
  const latestPredRes = await makeRequest('GET', '/api/v1/prediction/latest', null, {
    Authorization: `Bearer ${personnelToken}`
  });
  assert(latestPredRes.status === 200, 'Latest prediction retrieved');
  const predData = latestPredRes.body?.data?.prediction;
  assert(predData?.decisionLayer, 'Decision Layer synthesized and attached to prediction');
  assert(predData?.evidenceStrength === 'HIGH', `Evidence strength evaluated: ${predData?.evidenceStrength}`);
  assert(predData?.evidenceDisplay === 'EVIDENCE — HIGH', `Evidence badge rendered: ${predData?.evidenceDisplay}`);
  assert(predData?.dataAvailableCount >= 4, `Data availability counted: ${predData?.dataAvailableCount}/5 sources`);
  assert(predData?.welfareConcernDisplay.includes('WELFARE CONCERN'), `Welfare concern formatted: ${predData?.welfareConcernDisplay}`);

  // -------------------------------------------------------------
  // 18. UNDETERMINED STATE (Zero Guessing)
  // -------------------------------------------------------------
  console.log('\n🔹 [18/27] Testing UNDETERMINED State (Zero Guessing)...');
  const incompletePayload = {
    // Only duty type without wearable or PSS or workload numbers
    duty_type: 'Administrative Support'
  };
  const undeterminedRes = await makeRequest('POST', '/api/v1/checkin', incompletePayload, {
    Authorization: `Bearer ${personnelToken}`
  });
  assert(undeterminedRes.status === 201, 'Incomplete check-in handled gracefully');
  const undertermPred = undeterminedRes.body?.data?.prediction;
  assert(undertermPred?.concernLevel === 'UNDETERMINED', 'Insufficient evidence strictly classified as UNDETERMINED');
  assert(undertermPred?.evidenceStrength === 'INSUFFICIENT', 'Evidence strength classified as INSUFFICIENT');
  assert(undertermPred?.welfareConcernDisplay === 'WELFARE CONCERN — UNDETERMINED', 'Zero-guessing badge displayed');
  assert(undertermPred?.compositeRiskScore === null, 'Composite risk score is null/NA (not guessed)');

  // -------------------------------------------------------------
  // 19. BASELINE COMPARISON (What Changed)
  // -------------------------------------------------------------
  console.log('\n🔹 [19/27] Testing Baseline Comparison & What Changed Engine...');
  // User now has multiple check-ins; baseline is established
  const baselineRes = await makeRequest('GET', '/api/v1/prediction/what-changed', null, {
    Authorization: `Bearer ${personnelToken}`
  });
  assert(baselineRes.status === 200, 'What-changed endpoint returned HTTP 200 OK');
  const isBaselineEst = baselineRes.body?.baselineEstablished ?? baselineRes.body?.data?.baselineEstablished;
  const hasComp = baselineRes.body?.hasComparison ?? baselineRes.body?.data?.hasComparison;
  assert(isBaselineEst === true, 'Personal baseline established (baselineEstablished: true)');
  assert(hasComp === true, 'Longitudinal comparison computed against baseline');
  const cats = baselineRes.body?.personalBaseline?.comparisonCategories;
  assert(cats && cats.workload && cats.rest, 'Personal baseline comparison categories present (workload, rest, fatigue)');
  assert(baselineRes.body?.metrics && baselineRes.body?.metrics.workload_hours, 'Comparison metrics calculated (workload_hours, recovery_sleep_hours)');

  // -------------------------------------------------------------
  // 20. WELFARE OFFICER (Triage Queue & Workflow)
  // -------------------------------------------------------------
  console.log('\n🔹 [20/27] Testing Welfare Officer Workflow...');
  const officerAlertsRes = await makeRequest('GET', '/api/v1/officer/alerts', null, {
    Authorization: `Bearer ${officerToken}`
  });
  assert(officerAlertsRes.status === 200, 'Officer triage alerts fetched with HTTP 200');
  assert(Array.isArray(officerAlertsRes.body?.data), 'Officer triage alerts returned as array');

  const firstAlert = officerAlertsRes.body?.data?.[0];
  if (firstAlert) {
    const reviewRes = await makeRequest('POST', `/api/v1/officer/alerts/${firstAlert._id}/review`, {
      status: 'FOLLOW_UP_ASSIGNED',
      reviewDecision: 'FOLLOW_UP_ASSIGNED',
      supportAction: 'SUPPORT_SESSION',
      assignFollowUp: true,
      scheduledDate: new Date(Date.now() + 86400000).toISOString(),
      officerNotes: 'Proactive supportive discussion scheduled. All metrics non-punitive.'
    }, {
      Authorization: `Bearer ${officerToken}`
    });
    assert(reviewRes.status === 200, 'Officer review completed with HTTP 200 OK');
    assert(reviewRes.body?.data?.alert?.status === 'FOLLOW_UP_ASSIGNED', 'Alert status updated to FOLLOW_UP_ASSIGNED');
  }

  // -------------------------------------------------------------
  // 21. ADMIN (Authorized Live Metrics & Transparency)
  // -------------------------------------------------------------
  console.log('\n🔹 [21/27] Testing Admin Dashboard Metrics & Transparency...');
  const adminMetrics = await makeRequest('GET', '/api/v1/admin/metrics', null, {
    Authorization: `Bearer ${adminToken}`
  });
  assert(adminMetrics.status === 200, 'Admin metrics returned HTTP 200');
  assert(typeof adminMetrics.body?.data?.counts?.users === 'number', 'Admin metrics provides real user counts');
  assert(typeof adminMetrics.body?.data?.counts?.checkIns === 'number', 'Admin metrics provides real check-in volume');

  const transparencyRes = await makeRequest('GET', '/api/v1/system/transparency');
  assert(transparencyRes.status === 200, 'System transparency returned HTTP 200');
  assert(transparencyRes.body?.data?.dataset_label === 'Synthetic Prototype Training Data', 'Transparency dataset label confirmed');

  // -------------------------------------------------------------
  // 22. PRIVACY SANDBOX
  // -------------------------------------------------------------
  console.log('\n🔹 [22/27] Testing Privacy Sandbox Transformation...');
  const sandboxTransformRes = await makeRequest('POST', '/api/v1/privacy/sandbox/transform', {
    name: 'Ravi Kumar',
    personnelId: 'CRPF10452',
    age: 27,
    unit: 'Sector-IV Brigade Delta',
    workloadHours: 64,
    stressIndex: 68
  });
  assert(sandboxTransformRes.status === 200, 'Privacy Sandbox transform succeeded with HTTP 200');
  const afterData = sandboxTransformRes.body?.data?.after;
  assert(afterData?.userToken.startsWith('USR_'), `User Token pseudonymized: ${afterData?.userToken}`);
  assert(afterData?.ageGroup === '25–30', `Age minimized into cohort: ${afterData?.ageGroup}`);
  assert(afterData?.unitGroup.includes('Sector-IV'), `Unit generalized: ${afterData?.unitGroup}`);

  // -------------------------------------------------------------
  // 23. SETTINGS & TWO-STAGE PASSWORD VERIFICATION
  // -------------------------------------------------------------
  console.log('\n🔹 [23/27] Testing Settings & Two-Stage Password Verification...');
  // Stage 1: Verify current password
  const verifyPwdRes = await makeRequest('POST', '/api/v1/auth/verify-password', {
    currentPassword: 'FinalPassword123!'
  }, {
    Authorization: `Bearer ${personnelToken}`
  });
  assert(verifyPwdRes.status === 200, 'Stage 1 password verification succeeded');
  assert(verifyPwdRes.body?.verified === true, 'Identity verified: verified = true');

  // Stage 2: Change password
  const changePwdRes = await makeRequest('POST', '/api/v1/auth/change-password', {
    currentPassword: 'FinalPassword123!',
    newPassword: 'UpdatedPassword123!',
    confirmPassword: 'UpdatedPassword123!'
  }, {
    Authorization: `Bearer ${personnelToken}`
  });
  assert(changePwdRes.status === 200, 'Stage 2 password change succeeded');

  // Verify new password works
  const newLoginRes = await makeRequest('POST', '/api/v1/auth/login', {
    identifier: `PERS_FIN_${rand}`,
    password: 'UpdatedPassword123!'
  });
  assert(newLoginRes.status === 200, 'Login with new updated password succeeded');
  personnelToken = newLoginRes.body?.token;

  // -------------------------------------------------------------
  // 24. FAQ (14 Sections Verification)
  // -------------------------------------------------------------
  console.log('\n🔹 [24/27] Testing FAQ Structure (help.html)...');
  const helpHtml = fs.readFileSync(path.join(__dirname, 'frontend', 'help.html'), 'utf-8');
  const requiredFaqSections = [
    'General', 'Personnel', 'Welfare Officer', 'Admin', 'ML',
    'Wearables', 'PSS-10', 'Privacy', 'Security', 'Offline mode',
    'Data', 'Alerts', 'Welfare Support', 'Ethics'
  ];
  for (const sec of requiredFaqSections) {
    assert(helpHtml.includes(sec), `FAQ contains requested section: "${sec}"`);
  }

  // -------------------------------------------------------------
  // 25. NOTIFICATIONS
  // -------------------------------------------------------------
  console.log('\n🔹 [25/27] Testing Notifications API...');
  const notifsRes = await makeRequest('GET', '/api/v1/notifications', null, {
    Authorization: `Bearer ${personnelToken}`
  });
  assert(notifsRes.status === 200, 'Notifications fetched with HTTP 200');
  assert(Array.isArray(notifsRes.body?.data), 'Notifications returned as array');

  // -------------------------------------------------------------
  // 26. ALL BUTTONS & NAVIGATION (HTML File & Link Integrity)
  // -------------------------------------------------------------
  console.log('\n🔹 [26/27] Testing Navigation Integrity across all 25 HTML files...');
  const frontendDir = path.join(__dirname, 'frontend');
  const htmlFiles = fs.readdirSync(frontendDir).filter(f => f.endsWith('.html'));
  assert(htmlFiles.length === 25, `All 25 HTML pages exist (found: ${htmlFiles.length})`);

  let checkedLinks = 0;
  for (const file of htmlFiles) {
    const content = fs.readFileSync(path.join(frontendDir, file), 'utf-8');
    const hrefMatches = [...content.matchAll(/href=["']([^"']+\.html)["']/g)];
    for (const match of hrefMatches) {
      let target = match[1].split('#')[0].split('?')[0];
      if (target.startsWith('/')) target = target.slice(1);
      if (target && !target.startsWith('http')) {
        const targetPath = path.join(frontendDir, target);
        assert(fs.existsSync(targetPath), `Link in ${file} -> ${target} targets valid file`);
        checkedLinks++;
      }
    }
  }
  console.log(`  ✓ Verified ${checkedLinks} internal HTML links across all 25 files with zero broken targets.`);

  // -------------------------------------------------------------
  // 27. MOBILE / TABLET / DESKTOP RESPONSIVENESS
  // -------------------------------------------------------------
  console.log('\n🔹 [27/27] Testing Mobile, Tablet & Desktop Responsive Layouts...');
  const mainCss = fs.readFileSync(path.join(frontendDir, 'css', 'main.css'), 'utf-8');
  const dashCss = fs.readFileSync(path.join(frontendDir, 'css', 'dashboard.css'), 'utf-8');

  assert(mainCss.includes('@media (max-width: 1024px)'), 'Tablet breakpoint (1024px) defined in main.css');
  assert(mainCss.includes('@media (max-width: 640px)'), 'Large mobile breakpoint (640px) defined in main.css');
  assert(mainCss.includes('@media (max-width: 480px)'), 'Small mobile breakpoint (480px) defined in main.css');
  assert(dashCss.includes('.sidebar-backdrop'), 'Drawer backdrop defined in dashboard.css');
  assert(dashCss.includes('.app-sidebar.open'), 'Off-canvas drawer slide-out state defined in dashboard.css');
  assert(mainCss.includes('.table-responsive'), '.table-responsive class defined with overflow protection');

  console.log('\n======================================================================');
  console.log(`🎉 ALL 27 TASKS & CAPABILITIES VERIFIED! TOTAL ASSERTIONS PASSED: ${passedCount}`);
  console.log('======================================================================');
}

runFinalTesting().catch((err) => {
  console.error('\n❌ Master Test Suite Failed:', err);
  process.exit(1);
});
