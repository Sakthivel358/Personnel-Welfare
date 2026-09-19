/**
 * Verification Test Suite for Tasks 34, 35 & 36
 * Task 34: Evidence-based alerts, why generated, and non-disciplinary mandate
 * Task 35: Privacy Sandbox (Before: Ravi Kumar/CRPF10452/27 -> After: USR_7F29A/25-30/Unit Group/Workload/Stress Index)
 * Task 36: Privacy protection (Separation of identity from welfare analytics, pseudonymization, data minimization, masking)
 */

const http = require('http');
const assert = require('assert');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 VERIFYING TASKS 34, 35 & 36 IMPLEMENTATION');
  console.log('================================================================\n');

  // Authenticate Personnel and Officer
  console.log('[1] Authenticating Personnel and Welfare Officer...');
  const pLogin = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identifier: 'CRPF-9042', password: 'Password@123' });

  assert.strictEqual(pLogin.status, 200, 'Personnel login failed');
  const pToken = (pLogin.data.data && pLogin.data.data.token) || pLogin.data.token;
  console.log('   ✓ Personnel authenticated');

  const oLogin = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identifier: 'WO-101', password: 'Password@123' });

  assert.strictEqual(oLogin.status, 200, 'Officer login failed');
  const oToken = (oLogin.data.data && oLogin.data.data.token) || oLogin.data.token;
  console.log('   ✓ Welfare Officer authenticated');

  // --------------------------------------------------------------------------
  // TEST TASK 35: PRIVACY SANDBOX
  // --------------------------------------------------------------------------
  console.log('\n[2] Testing Task 35: Privacy Sandbox API and Transformation Engine...');

  // 2.1 Fetch sample Before -> After transformation
  const sampleRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/privacy/sandbox/sample',
    method: 'GET'
  });

  assert.strictEqual(sampleRes.status, 200, 'Failed to fetch sandbox sample');
  const primary = sampleRes.data.data.primary;
  
  console.log('   Canonical Sandbox Before state:');
  console.log(`   - Name:       "${primary.before.name}"`);
  console.log(`   - Service ID: "${primary.before.serviceId}"`);
  console.log(`   - Age:        ${primary.before.age}`);

  assert.strictEqual(primary.before.name, 'Ravi Kumar', 'Sample name must be Ravi Kumar');
  assert.strictEqual(primary.before.serviceId, 'CRPF10452', 'Sample service ID must be CRPF10452');
  assert.strictEqual(primary.before.age, 27, 'Sample age must be 27');

  console.log('   Canonical Sandbox After state:');
  console.log(`   - User Token:   "${primary.after.userToken}"`);
  console.log(`   - Age Group:    "${primary.after.ageGroup}"`);
  console.log(`   - Unit Group:   "${primary.after.unitGroup}"`);
  console.log(`   - Workload:     "${primary.after.workload}"`);
  console.log(`   - Stress Index: "${primary.after.stressIndex}"`);

  assert.strictEqual(primary.after.userToken, 'USR_7F29A', 'User Token must match exact specification USR_7F29A');
  assert.strictEqual(primary.after.ageGroup, '25–30', 'Age 27 must be bucketed into cohort 25–30');
  assert.ok(primary.after.unitGroup, 'Unit Group must be defined');
  assert.ok(primary.after.workload, 'Workload must be defined');
  assert.ok(primary.after.stressIndex, 'Stress Index must be defined');
  console.log('   ✓ Task 35: Canonical Ravi Kumar Before -> After transformation verified!');

  // 2.2 Test dynamic custom transformation endpoint
  console.log('\n   Testing Dynamic POST /api/v1/privacy/sandbox/transform...');
  const transformRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/privacy/sandbox/transform',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'Suresh Raina',
    serviceId: 'BSF-99102',
    age: 38,
    unit: 'Sector-I Frontier Guard Border Post 14',
    workloadHours: 70,
    stressScore: 78
  });

  assert.strictEqual(transformRes.status, 200, 'Transform POST failed');
  const tData = transformRes.data.data;
  assert.ok(tData.after.userToken.startsWith('USR_'), 'Must generate USR_ token');
  assert.strictEqual(tData.after.ageGroup, '36–40', 'Age 38 must be in 36–40');
  assert.strictEqual(tData.after.unitGroup, 'Sector-I Frontier Guard');
  assert.strictEqual(tData.after.workload, 'Elevated (70h/wk)');
  console.log('   ✓ Task 35: Dynamic custom transformation verified!');

  // --------------------------------------------------------------------------
  // TEST TASK 36: PRIVACY PROTECTION (SEPARATION & MASKING)
  // --------------------------------------------------------------------------
  console.log('\n[3] Testing Task 36: Privacy Protection & Identity Separation...');
  const statusRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/privacy/status',
    method: 'GET'
  });

  assert.strictEqual(statusRes.status, 200, 'Privacy status endpoint failed');
  const pStatus = statusRes.data.data;
  assert.strictEqual(pStatus.pseudonymization.status, 'ACTIVE');
  assert.strictEqual(pStatus.dataMinimization.status, 'ACTIVE');
  assert.ok(pStatus.masking.serviceIdMasking, 'Masking rules must be documented');
  assert.ok(pStatus.roleBasedAccessControl.welfareOfficer, 'RBAC policies must be declared');
  console.log('   - Pseudonymization: ACTIVE');
  console.log('   - Data Minimization: ACTIVE (5-Year Cohorts, Unit Groups)');
  console.log('   - Appropriate Masking: ACTIVE');
  console.log('   ✓ Task 36: Privacy architecture status confirmed!');

  // --------------------------------------------------------------------------
  // TEST TASK 34: EVIDENCE-BASED ALERTS & NON-DISCIPLINARY MANDATE
  // --------------------------------------------------------------------------
  console.log('\n[4] Testing Task 34: Evidence-based Alerts & Non-Disciplinary Mandate...');

  // 4.1 Submit a check-in that triggers a welfare alert
  console.log('   Submitting high-strain check-in to trigger evidence-based alert...');
  const highCheckin = {
    workload_hours: 74.0,
    work_pressure_rating: 9.0,
    recovery_sleep_hours: 4.0,
    rest_interval_hours: 4.5,
    prolonged_duty_hours: 14.0,
    night_duty_hours: 18.0,
    shift_continuity_days: 8.0,
    pss_score: 34.0,
    fatigue_physical_strain: 80.0,
    wearable_synced: false
  };

  const checkinRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${pToken}`,
      'Content-Type': 'application/json'
    }
  }, highCheckin);

  assert.strictEqual(checkinRes.status, 201, 'Failed to submit check-in');
  console.log('   ✓ High-strain check-in submitted');

  // 4.2 Fetch alerts as Welfare Officer
  const alertsRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/officer/alerts',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${oToken}` }
  });

  assert.strictEqual(alertsRes.status, 200, 'Failed to fetch officer alerts');
  const alerts = alertsRes.data.data;
  assert.ok(alerts.length > 0, 'No alerts found in triage queue');
  const latestAlert = alerts[0];

  console.log('\n   Inspecting latest Alert:');
  console.log(`   - Priority:                 ${latestAlert.priority}`);
  console.log(`   - Welfare Concern Display:  "${latestAlert.welfareConcernDisplay}"`);
  console.log(`   - Evidence Display:         "${latestAlert.evidenceDisplay}"`);
  console.log(`   - Data Available Display:   "${latestAlert.dataAvailableDisplay}"`);
  console.log(`   - Non-Disciplinary Notice:  "${latestAlert.nonDisciplinaryStatement}"`);

  // Verify Non-Disciplinary Mandate
  const nonDisciplinaryRule = 'An ML prediction must never automatically become a disciplinary action.';
  assert.strictEqual(latestAlert.nonDisciplinaryStatement, nonDisciplinaryRule,
    `Alert must include exact statement: "${nonDisciplinaryRule}"`);
  assert.strictEqual(latestAlert.isNonDisciplinary, true, 'isNonDisciplinary flag must be true');
  assert.strictEqual(latestAlert.disciplinaryActionPermitted, false, 'disciplinaryActionPermitted must be false');
  console.log('   ✓ Non-disciplinary mandate strictly enforced on Alert record!');

  // Verify Evidence-based explanation (Why alert was generated)
  assert.ok(latestAlert.whyAlertGenerated, 'Alert must have whyAlertGenerated object');
  console.log(`   - Why Alert Generated Summary: "${latestAlert.whyAlertGenerated.summary}"`);
  console.log(`   - Contributing factors count:  ${latestAlert.whyAlertGenerated.primaryFactors?.length || 0}`);
  assert.ok(latestAlert.whyAlertGenerated.summary, 'Missing whyAlertGenerated summary');
  assert.ok(latestAlert.whyAlertGenerated.evidenceSources, 'Missing evidenceSources in whyAlertGenerated');
  assert.strictEqual(latestAlert.whyAlertGenerated.isEvidenceBased, true, 'isEvidenceBased must be true');
  console.log('   ✓ Alert is strictly evidence-based with structured explanation!');

  // Verify pseudonymization fields on alert
  assert.ok(latestAlert.userToken, 'Alert must have userToken');
  assert.ok(latestAlert.ageGroup, 'Alert must have ageGroup');
  assert.ok(latestAlert.unitGroup, 'Alert must have unitGroup');
  assert.ok(latestAlert.maskedServiceId, 'Alert must have maskedServiceId');
  console.log(`   - Pseudonymized User Token: "${latestAlert.userToken}"`);
  console.log(`   - Minimization Cohort:      "${latestAlert.ageGroup}"`);
  console.log(`   - Masked Service ID:        "${latestAlert.maskedServiceId}"`);
  console.log('   ✓ Alert incorporates pseudonymization and data minimization!');

  // 4.3 Test 7-Stage Workflow Stage 1 contains Why Alert Generated & Non-Disciplinary Mandate
  console.log('\n   Testing Workflow Stage 1 for Alert ID: ' + latestAlert._id);
  const wfRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/v1/officer/alerts/${latestAlert._id}/workflow`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${oToken}` }
  });

  assert.strictEqual(wfRes.status, 200, 'Failed to fetch workflow');
  const st1 = wfRes.data.data.stage1_alert;
  assert.strictEqual(st1.nonDisciplinaryStatement, nonDisciplinaryRule, 'Stage 1 must include non-disciplinary statement');
  assert.strictEqual(st1.prohibitDisciplinaryAction, true, 'Stage 1 must prohibit disciplinary action');
  assert.ok(st1.whyAlertGenerated, 'Stage 1 must include whyAlertGenerated');
  console.log('   ✓ Workflow Stage 1 incorporates whyAlertGenerated and nonDisciplinaryStatement!');

  // 4.4 Test that attempting to submit a disciplinary action in reviewAlert is BLOCKED
  console.log('\n   Testing that reviewAlert strictly BLOCKS any attempt at disciplinary action...');
  const illicitReviewPayload = {
    status: 'DISCIPLINARY_ACTION_PENDING',
    reviewDecision: 'DISCIPLINARY_HEARING',
    officerNotes: 'Initiating disciplinary charge-sheet based on high fatigue score.'
  };

  const illicitRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/v1/officer/alerts/${latestAlert._id}/review`,
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${oToken}`,
      'Content-Type': 'application/json'
    }
  }, illicitReviewPayload);

  assert.strictEqual(illicitRes.status, 400, 'Attempted disciplinary action must be rejected with 400');
  assert.strictEqual(illicitRes.data.error, 'NON_DISCIPLINARY_VIOLATION');
  assert.strictEqual(illicitRes.data.nonDisciplinaryStatement, nonDisciplinaryRule);
  console.log('   ✓ Attempted disciplinary action correctly BLOCKED with 400 NON_DISCIPLINARY_VIOLATION!');

  // 4.5 Verify valid supportive review succeeds
  console.log('\n   Submitting authorized non-punitive supportive care review...');
  const validReviewPayload = {
    status: 'RESOLVED',
    reviewDecision: 'REST_ROTATION',
    supportAction: 'REST_RECOVERY',
    officerNotes: 'Authorized 48h restorative sleep reset and shift rotation under welfare protocol.'
  };

  const validRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/v1/officer/alerts/${latestAlert._id}/review`,
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${oToken}`,
      'Content-Type': 'application/json'
    }
  }, validReviewPayload);

  assert.strictEqual(validRes.status, 200, 'Valid supportive review failed');
  console.log('   ✓ Valid supportive non-punitive review succeeded!');

  console.log('\n================================================================');
  console.log('🎉 ALL TASKS 34, 35 & 36 TESTS PASSED WITH ZERO ERRORS!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
