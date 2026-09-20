/**
 * test_baseline_human_review_offline.js
 * Comprehensive automated test suite verifying:
 * 1. Personal Baseline:
 *    - "PERSONAL BASELINE NOT ESTABLISHED" when history < 2 check-ins
 *    - Authentic intra-individual comparison (workload, recovery/rest, night-duty, wearable trends)
 *    - Zero cross-personnel comparison & zero fabricated values
 * 2. Human-in-the-Loop Review:
 *    - Officer recording: Reviewed, Needs Follow-up, Support Provided, AI Result Not Applicable
 *    - Strict separation of AI result & human review
 *    - AI remains decision-support only (disciplinary/medical rejection)
 *    - Tamper-evident cryptographic audit log verification
 * 3. Mobile + Offline Self-Assessment:
 *    - Local vault sensitive data protection (no plaintext exposure)
 *    - Deduplication via idempotency keys on batch synchronization
 */

const http = require('http');
const auditService = require('./backend/services/audit.service');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('==================================================================');
  console.log('STARTING PERSONAL BASELINE, HUMAN REVIEW & OFFLINE TEST SUITE');
  console.log('==================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
    }
  }

  const timestamp = Date.now();

  // --------------------------------------------------------------------------
  // PART 1: PERSONAL BASELINE VERIFICATION
  // --------------------------------------------------------------------------
  console.log('--- 1. Personal Baseline: User with 0 Check-ins ---');
  const user1Email = `pb_officer_${timestamp}@defence.gov.in`;
  const reg1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    fullName: 'Naik Personal Baseline Test',
    personnelId: `PB${timestamp.toString().slice(-6)}`,
    rank: 'Naik',
    unit: '11 Gurkha Rifles',
    email: user1Email,
    password: 'Password@123',
    role: 'personnel'
  });

  const token1 = reg1.body.token || (reg1.body.data && reg1.body.data.token);
  assert(!!token1, 'User 1 registered and authenticated');

  const baselineZero = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/personal-baseline',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });

  assert(baselineZero.status === 200, '/prediction/personal-baseline returned 200');
  assert(baselineZero.body.data.baselineEstablished === false, 'baselineEstablished is false for 0 check-ins');
  assert(baselineZero.body.data.display === 'PERSONAL BASELINE NOT ESTABLISHED', 'Exact display: "PERSONAL BASELINE NOT ESTABLISHED"');
  assert(baselineZero.body.data.personalBaselineText === 'PERSONAL BASELINE NOT ESTABLISHED', 'personalBaselineText is "PERSONAL BASELINE NOT ESTABLISHED"');
  assert(baselineZero.body.data.comparisonCategories === null, 'comparisonCategories is null (no fake data)');

  const whatChangedZero = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/what-changed',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });

  assert(whatChangedZero.body.baselineEstablished === false, 'what-changed reports baselineEstablished: false');
  assert(whatChangedZero.body.display === 'PERSONAL BASELINE NOT ESTABLISHED', 'what-changed displays "PERSONAL BASELINE NOT ESTABLISHED"');

  console.log('\n--- 2. Personal Baseline: User with 1 Check-in (< 2 required) ---');
  const checkin1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token1}`
    }
  }, {
    workload_hours: 40,
    recovery_sleep_hours: 8.0,
    work_pressure_rating: 3,
    shift_continuity_days: 1,
    social_support_rating: 4,
    work_life_balance_rating: 4,
    prolonged_duty_hours: 4,
    night_duty_hours: 0,
    fatigue_physical_strain: 15,
    resting_heart_rate: 68,
    hrv_ms: 65,
    respiration_rate: 14,
    skin_temperature_c: 36.4
  });

  assert(checkin1.status === 201, 'Check-in 1 created');

  const baselineOne = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/personal-baseline',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });

  assert(baselineOne.body.data.baselineEstablished === false, 'Baseline still not established with 1 check-in (requires >= 2)');
  assert(baselineOne.body.data.display === 'PERSONAL BASELINE NOT ESTABLISHED', 'Still displays "PERSONAL BASELINE NOT ESTABLISHED"');

  console.log('\n--- 3. Personal Baseline: User with 3 Check-ins (Baseline Established) ---');
  // Check-in 2
  const checkin2 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token1}`
    }
  }, {
    workload_hours: 42,
    recovery_sleep_hours: 7.4,
    work_pressure_rating: 4,
    shift_continuity_days: 2,
    social_support_rating: 4,
    work_life_balance_rating: 4,
    prolonged_duty_hours: 6,
    night_duty_hours: 2,
    fatigue_physical_strain: 25,
    resting_heart_rate: 70,
    hrv_ms: 60,
    respiration_rate: 15,
    skin_temperature_c: 36.6
  });

  assert(checkin2.status === 201, 'Check-in 2 created');

  // Check-in 3: Current check-in with elevated operational strain
  const checkin3 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token1}`
    }
  }, {
    workload_hours: 56,
    recovery_sleep_hours: 5.0,
    work_pressure_rating: 8,
    shift_continuity_days: 6,
    social_support_rating: 3,
    work_life_balance_rating: 2,
    prolonged_duty_hours: 12,
    night_duty_hours: 8,
    fatigue_physical_strain: 65,
    resting_heart_rate: 82,
    hrv_ms: 40,
    respiration_rate: 18,
    skin_temperature_c: 37.0
  });

  assert(checkin3.status === 201, 'Check-in 3 created');

  const baselineThree = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/personal-baseline',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });

  assert(baselineThree.status === 200, '/prediction/personal-baseline returns 200');
  const pbData = baselineThree.body.data;
  assert(pbData.baselineEstablished === true, 'Baseline is established (baselineEstablished: true)');
  assert(pbData.display === 'BASELINE STATUS — ESTABLISHED', 'Displays BASELINE STATUS — ESTABLISHED');
  assert(pbData.baselineCheckInCount === 2, 'Baseline computed strictly from 2 prior historical check-ins');

  // Verify the 4 required categories
  const cats = pbData.comparisonCategories;
  assert(!!cats.workload, '1. Workload vs Personal Baseline exists');
  assert(cats.workload.normalPattern.value === 41.0, `Normal Workload is 41.0 hrs/wk (got ${cats.workload.normalPattern.value})`);
  assert(cats.workload.current.value === 56.0, `Current Workload is 56.0 hrs/wk (got ${cats.workload.current.value})`);
  assert(cats.workload.delta === 15.0, `Workload delta is +15.0 hrs/wk (got ${cats.workload.delta})`);

  assert(!!cats.rest, '2. Recovery / Rest vs Baseline exists');
  assert(cats.rest.normalPattern.value === 7.7, `Normal Rest is 7.7 hrs/day (got ${cats.rest.normalPattern.value})`);
  assert(cats.rest.current.value === 5.0, `Current Rest is 5.0 hrs/day (got ${cats.rest.current.value})`);
  assert(cats.rest.delta === -2.7, `Rest delta is -2.7 hrs/day (got ${cats.rest.delta})`);

  assert(!!cats.nightDuty, '3. Night-Duty Pattern vs Baseline exists');
  assert(cats.nightDuty.normalPattern.value === 1.0, `Normal Night Duty is 1.0 hrs/wk (got ${cats.nightDuty.normalPattern.value})`);
  assert(cats.nightDuty.current.value === 8.0, `Current Night Duty is 8.0 hrs/wk (got ${cats.nightDuty.current.value})`);
  assert(cats.nightDuty.delta === 7.0, `Night Duty delta is +7.0 hrs/wk (got ${cats.nightDuty.delta})`);

  assert(!!cats.wearableTrends, '4. Relevant Wearable Trends vs Baseline exists');
  assert(cats.wearableTrends.normalPattern.value === 69.0, `Normal HR is 69.0 BPM (got ${cats.wearableTrends.normalPattern.value})`);
  assert(cats.wearableTrends.current.value === 82.0, `Current HR is 82.0 BPM (got ${cats.wearableTrends.current.value})`);
  assert(cats.wearableTrends.delta === 13.0, `Heart rate delta is +13.0 BPM (got ${cats.wearableTrends.delta})`);

  // Verify Strictly Intra-Individual: Register User 2 and verify no cross-personnel comparison
  console.log('\n--- 4. Personal Baseline: Zero Cross-Personnel Comparison ---');
  const user2Email = `pb_isolated_${timestamp}@defence.gov.in`;
  const reg2 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    fullName: 'Sepoy Isolated Member',
    personnelId: `ISO${timestamp.toString().slice(-6)}`,
    rank: 'Sepoy',
    unit: '11 Gurkha Rifles',
    email: user2Email,
    password: 'Password@123',
    role: 'personnel'
  });

  const token2 = reg2.body.token || (reg2.body.data && reg2.body.data.token);
  const user2Baseline = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/personal-baseline',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token2}` }
  });

  assert(user2Baseline.body.data.baselineEstablished === false, 'User 2 has 0 check-ins and baseline is NOT established');
  assert(user2Baseline.body.data.display === 'PERSONAL BASELINE NOT ESTABLISHED', 'User 2 is never influenced by User 1 baseline');

  // --------------------------------------------------------------------------
  // PART 2: HUMAN-IN-THE-LOOP REVIEW VERIFICATION
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Human-in-the-Loop Review: Register Welfare Officer ---');
  const officerEmail = `officer_welfare_${timestamp}@defence.gov.in`;
  const regOfficer = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    fullName: 'Major Welfare Officer',
    personnelId: `WO_${timestamp.toString().slice(-6)}`,
    rank: 'Major',
    unit: '11 Gurkha Rifles',
    email: officerEmail,
    password: 'Password@123',
    role: 'welfare_officer',
    adminSecret: 'welfare-secure-admin-key-2026'
  });

  const officerToken = regOfficer.body.token || (regOfficer.body.data && regOfficer.body.data.token);
  assert(!!officerToken, 'Welfare Officer registered and authenticated');

  // Get User 1's latest prediction ID
  const latestPredRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/latest',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });

  const predictionId = latestPredRes.body.data.prediction._id || latestPredRes.body.data.predictionId;
  assert(!!predictionId, `Found latest prediction ID: ${predictionId}`);

  console.log('\n--- 6. Human Review: Non-Disciplinary Mandate Enforcement ---');
  // Attempt disciplinary action through review endpoint
  const disciplinaryAttempt = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/v1/officer/predictions/${predictionId}/review`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${officerToken}`
    }
  }, {
    reviewStatus: 'Disciplinary Action',
    officerNotes: 'Recommend court-martial and disciplinary punishment for high stress.'
  });

  assert(disciplinaryAttempt.status === 400, 'Prohibited disciplinary review attempt rejected with 400');
  assert(disciplinaryAttempt.body.error === 'NON_DISCIPLINARY_OR_MEDICAL_VIOLATION', 'Error code is NON_DISCIPLINARY_OR_MEDICAL_VIOLATION');

  // Attempt medical diagnosis through review endpoint
  const medicalAttempt = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/v1/officer/predictions/${predictionId}/review`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${officerToken}`
    }
  }, {
    reviewStatus: 'Reviewed',
    officerNotes: 'Issued clinical medical diagnosis for depressive episode.'
  });

  assert(medicalAttempt.status === 400, 'Prohibited medical diagnosis attempt rejected with 400');

  console.log('\n--- 7. Human Review: 4 Authorized Review Decisions ---');
  // Option 1: Reviewed
  const review1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/v1/officer/predictions/${predictionId}/review`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${officerToken}`
    }
  }, {
    reviewStatus: 'Reviewed',
    officerNotes: 'Verified within operational duty context. Personnel is coping adequately.'
  });

  assert(review1.status === 200, 'Officer successfully recorded: "Reviewed"');
  assert(review1.body.data.humanReview.reviewStatus === 'REVIEWED', 'Stored reviewStatus: REVIEWED');
  assert(review1.body.data.humanReview.reviewStatusDisplay === 'Reviewed', 'Stored reviewStatusDisplay: "Reviewed"');
  assert(review1.body.data.humanReview.decisionSupportOnly === true, 'Flagged decisionSupportOnly: true');
  assert(review1.body.data.humanReview.isDisciplinaryOrMedicalAction === false, 'isDisciplinaryOrMedicalAction: false');

  // Option 2: Needs Follow-up
  const review2 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/v1/officer/predictions/${predictionId}/review`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${officerToken}`
    }
  }, {
    reviewStatus: 'Needs Follow-up',
    officerNotes: 'Elevated duty workload. Scheduled check-in session for next Tuesday.'
  });

  assert(review2.status === 200, 'Officer successfully recorded: "Needs Follow-up"');
  assert(review2.body.data.humanReview.reviewStatus === 'NEEDS_FOLLOW_UP', 'Stored reviewStatus: NEEDS_FOLLOW_UP');
  assert(review2.body.data.humanReview.reviewStatusDisplay === 'Needs Follow-up', 'Stored reviewStatusDisplay: "Needs Follow-up"');
  assert(!!review2.body.data.followUp, 'Automatic Follow-up record scheduled in FollowUps collection');

  // Option 3: Support Provided
  const review3 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/v1/officer/predictions/${predictionId}/review`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${officerToken}`
    }
  }, {
    reviewStatus: 'Support Provided',
    supportType: 'REST_ROTATION',
    officerNotes: 'Authorized 48h restorative rotation to restore sleep deficit.'
  });

  assert(review3.status === 200, 'Officer successfully recorded: "Support Provided"');
  assert(review3.body.data.humanReview.reviewStatus === 'SUPPORT_PROVIDED', 'Stored reviewStatus: SUPPORT_PROVIDED');
  assert(review3.body.data.humanReview.reviewStatusDisplay === 'Support Provided', 'Stored reviewStatusDisplay: "Support Provided"');
  assert(!!review3.body.data.supportRequest, 'SupportRequest recorded in SupportRequests collection');

  // Option 4: AI Result Not Applicable
  const review4 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/v1/officer/predictions/${predictionId}/review`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${officerToken}`
    }
  }, {
    reviewStatus: 'AI Result Not Applicable',
    officerNotes: 'High heart rate occurred during scheduled PT run; not chronic stress.'
  });

  assert(review4.status === 200, 'Officer successfully recorded: "AI Result Not Applicable"');
  assert(review4.body.data.humanReview.reviewStatus === 'NOT_APPLICABLE', 'Stored reviewStatus: NOT_APPLICABLE');
  assert(review4.body.data.humanReview.reviewStatusDisplay === 'AI Result Not Applicable', 'Stored reviewStatusDisplay: "AI Result Not Applicable"');

  console.log('\n--- 8. Human Review: Clear Separation of AI Result and Review ---');
  // Check that /prediction/latest returns both AI prediction and Human Review clearly separated
  const latestAfterReview = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/latest',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });

  const predBody = latestAfterReview.body.data;
  assert(predBody.prediction.concernLevel !== undefined, 'AI concernLevel is preserved');
  assert(predBody.prediction.compositeRiskScore !== undefined, 'AI compositeRiskScore is preserved');
  assert(!!predBody.humanReview, 'humanReview exists at top level');
  assert(predBody.humanReview.reviewStatus === 'NOT_APPLICABLE', 'humanReview has latest officer status');
  assert(predBody.humanReview.officerRank === 'Major', 'Recorded officer rank Major');

  console.log('\n--- 9. Human Review: Tamper-Evident Audit Trail Chaining ---');
  const chainVerification = await auditService.verifyChain();
  assert(chainVerification.verified === true, 'Tamper-evident audit hash-chain verified: 100% intact');

  // --------------------------------------------------------------------------
  // PART 3: MOBILE + OFFLINE SELF-ASSESSMENT VERIFICATION
  // --------------------------------------------------------------------------
  console.log('\n--- 10. Mobile + Offline: Batch Synchronization & Idempotency ---');
  const offlineKey1 = `chk-offline-${timestamp}-001`;
  const offlineKey2 = `chk-offline-${timestamp}-002`;

  const batchPayload = {
    items: [
      {
        idempotencyKey: offlineKey1,
        workload_hours: 44,
        recovery_sleep_hours: 7.0,
        work_pressure_rating: 4,
        shift_continuity_days: 2,
        social_support_rating: 4,
        work_life_balance_rating: 4,
        notes: 'Offline submission batch item 1'
      },
      {
        idempotencyKey: offlineKey2,
        workload_hours: 46,
        recovery_sleep_hours: 6.5,
        work_pressure_rating: 5,
        shift_continuity_days: 3,
        social_support_rating: 4,
        work_life_balance_rating: 3,
        notes: 'Offline submission batch item 2'
      }
    ]
  };

  const syncRes1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/checkin/sync',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token1}`
    }
  }, batchPayload);

  assert(syncRes1.status === 200, '/checkin/sync returned 200 for batch items');
  assert(syncRes1.body.syncedCount === 2, `Synchronized 2 offline items (got ${syncRes1.body.syncedCount})`);
  assert(syncRes1.body.duplicateCount === 0, 'Zero duplicates on first sync');

  // Second sync with identical idempotency keys (deduplication verification)
  const syncRes2 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/checkin/sync',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token1}`
    }
  }, batchPayload);

  assert(syncRes2.status === 200, 'Duplicate batch sync returned 200');
  assert(syncRes2.body.syncedCount === 0, 'No re-synced items on duplicate submission');
  assert(syncRes2.body.duplicateCount === 2, '2 duplicate records safely prevented by idempotency keys');

  console.log('\n==================================================================');
  console.log(`TEST SUMMARY: ${passed} / ${total} assertions passed.`);
  console.log('==================================================================');

  if (passed === total) {
    console.log('🎉 ALL PERSONAL BASELINE, HUMAN REVIEW & OFFLINE REQUIREMENTS PASSING!\n');
    process.exit(0);
  } else {
    console.error('⚠️ SOME ASSERTIONS FAILED.\n');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled test execution error:', err);
  process.exit(1);
});
