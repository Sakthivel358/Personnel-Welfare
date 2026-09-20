/**
 * Automated Verification Suite for:
 * 1. Task 13: Workload Data & Historical Personal Baseline Comparison
 * 2. Task 14: Rest/Recovery Data & Personal Normal Pattern Comparison
 * 3. Task 15: Optional PSS-10 / Self-Check Guarantee
 */

const http = require('http');

let token = '';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  const list = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
  const cookies = {};
  list.forEach(c => {
    const parts = c.split(';')[0].split('=');
    cookies[parts[0].trim()] = parts[1] ? parts[1].trim() : '';
  });
  return cookies;
}

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log('  PASS: ' + message);
    passedTests++;
  } else {
    console.error('  FAIL: ' + message);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('  RUNNING TESTS: WORKLOAD, REST/RECOVERY & OPTIONAL PSS-10');
  console.log('===============================================================\n');

  // Step 0: Register unique test user
  console.log('[Step 0] Creating unique test personnel...');
  const uniqueId = `wl_test_${Date.now()}`;
  const regRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    personnelId: `CRPF-${uniqueId.substring(8)}`,
    fullName: 'Baseline Test Constable',
    email: `${uniqueId}@welfare.gov.in`,
    password: 'Password@123',
    confirmPassword: 'Password@123',
    role: 'PERSONNEL',
    rank: 'Constable',
    force: 'CRPF'
  });

  assert(regRes.status === 201 || regRes.status === 200, 'Registration succeeded');
  const cookies = parseCookies(regRes.headers['set-cookie']);
  token = cookies.token || (regRes.data && regRes.data.data && regRes.data.data.token);
  assert(token, 'Session token acquired for test personnel');

  // Step 1: Submit Check-in 1 (Establishing Personal Normal Baseline)
  console.log('\n[Step 1] Establishing Personal Baseline (Workload: 44 hrs/wk, Sleep: 7.5 hrs/day)...');
  const checkin1Res = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `token=${token}`
    }
  }, {
    duty_type: 'Patrol & Active Security',
    workload_hours: 44,
    work_pressure_rating: 4,
    recovery_sleep_hours: 7.5,
    rest_interval_hours: 12,
    recovery_pattern: 'BALANCED_CIRCADIAN',
    shift_continuity_days: 2,
    social_support_rating: 7,
    work_life_balance_rating: 7,
    pss_score: 12
  });

  assert(checkin1Res.status === 201, 'Baseline Check-in 1 accepted (Status 201)');
  const chk1Data = checkin1Res.data.data.checkIn;
  assert(chk1Data.workload_hours === 44, 'Check-in 1 recorded workload: 44 hrs');
  assert(chk1Data.recovery_sleep_hours === 7.5, 'Check-in 1 recorded sleep: 7.5 hrs');

  // Step 2: Submit Check-in 2 (Acute Workload Surge + Sleep Deficit)
  console.log('\n[Step 2] Submitting Check-in 2 (Workload: 60 hrs/wk, Sleep: 5.0 hrs/day)...');
  const checkin2Res = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `token=${token}`
    }
  }, {
    duty_type: 'Patrol & Active Security',
    workload_hours: 60,
    work_pressure_rating: 8,
    recovery_sleep_hours: 5.0,
    rest_interval_hours: 6,
    recovery_pattern: 'EXTENDED_DEFICIT',
    shift_continuity_days: 6,
    social_support_rating: 5,
    work_life_balance_rating: 3,
    pss_score: 22
  });

  assert(checkin2Res.status === 201, 'Check-in 2 accepted (Status 201)');
  const chk2Data = checkin2Res.data.data.checkIn;
  assert(chk2Data.personal_avg_workload === 44, `Check-in 2 preserved personal baseline workload (Expected 44, got ${chk2Data.personal_avg_workload})`);
  assert(chk2Data.personal_workload_delta === 16, `Check-in 2 computed workload surge delta (Expected +16, got ${chk2Data.personal_workload_delta})`);
  assert(chk2Data.personal_avg_sleep === 7.5, `Check-in 2 preserved personal baseline sleep (Expected 7.5, got ${chk2Data.personal_avg_sleep})`);
  assert(chk2Data.personal_sleep_delta === -2.5, `Check-in 2 computed sleep deficit delta (Expected -2.5, got ${chk2Data.personal_sleep_delta})`);

  // Step 3: Test /prediction/what-changed (Tasks 13 & 14)
  console.log('\n[Step 3] Verifying /prediction/what-changed personal baseline comparison...');
  const whatChangedRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/prediction/what-changed',
    method: 'GET',
    headers: { 'Cookie': `token=${token}` }
  });

  assert(whatChangedRes.status === 200, 'GET /prediction/what-changed returns 200');
  const wcData = whatChangedRes.data;
  assert(wcData.hasComparison === true, 'Comparative analysis is active');
  assert(wcData.personalBaseline !== undefined, 'personalBaseline object is present in response');

  const pb = wcData.personalBaseline;
  assert(pb.avgWorkloadHours === 44, `personalBaseline.avgWorkloadHours is 44 (got ${pb.avgWorkloadHours})`);
  assert(pb.avgRecoverySleepHours === 7.5, `personalBaseline.avgRecoverySleepHours is 7.5 (got ${pb.avgRecoverySleepHours})`);
  assert(pb.comparison.workloadDelta === 16, `personalBaseline.comparison.workloadDelta is +16 (got ${pb.comparison.workloadDelta})`);
  assert(pb.comparison.workloadStatus === 'ELEVATED_ABOVE_NORMAL', `workloadStatus is ELEVATED_ABOVE_NORMAL (got ${pb.comparison.workloadStatus})`);
  assert(pb.comparison.sleepDelta === -2.5, `personalBaseline.comparison.sleepDelta is -2.5 (got ${pb.comparison.sleepDelta})`);
  assert(pb.comparison.sleepStatus === 'REST_DEFICIT', `sleepStatus is REST_DEFICIT (got ${pb.comparison.sleepStatus})`);

  // Check metrics enrichment
  const metrics = wcData.metrics;
  assert(metrics.workload_hours.personalBaselineAvg === 44, 'metrics.workload_hours has personalBaselineAvg: 44');
  assert(metrics.workload_hours.deltaFromPersonalBaseline === 16, 'metrics.workload_hours has deltaFromPersonalBaseline: 16');
  assert(metrics.recovery_sleep_hours.personalBaselineAvg === 7.5, 'metrics.recovery_sleep_hours has personalBaselineAvg: 7.5');
  assert(metrics.recovery_sleep_hours.deltaFromPersonalBaseline === -2.5, 'metrics.recovery_sleep_hours has deltaFromPersonalBaseline: -2.5');

  // Step 4: Test /prediction/history (Longitudinal Personal Baseline)
  console.log('\n[Step 4] Verifying /prediction/history aggregated personal baseline...');
  const historyRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/prediction/history',
    method: 'GET',
    headers: { 'Cookie': `token=${token}` }
  });

  assert(historyRes.status === 200, 'GET /prediction/history returns 200');
  assert(Array.isArray(historyRes.data.data), 'History returns series array');
  assert(historyRes.data.data.length === 2, 'History contains 2 check-in records');
  assert(historyRes.data.personalBaseline !== undefined, 'History includes personalBaseline aggregate');
  // 44 + 60 / 2 = 52.0
  assert(historyRes.data.personalBaseline.avgWorkloadHours === 52, `History avgWorkloadHours is 52 (got ${historyRes.data.personalBaseline.avgWorkloadHours})`);
  // 7.5 + 5.0 / 2 = 6.25 -> 6.3 or 6.2
  const histSleep = historyRes.data.personalBaseline.avgRecoverySleepHours;
  assert(histSleep >= 6.2 && histSleep <= 6.3, `History avgRecoverySleepHours is ~6.2-6.3 (got ${histSleep})`);

  // Step 5: Test Optional PSS-10 Check-in (Task 15)
  console.log('\n[Step 5] Verifying Optional PSS-10 Check-in (pss_score: null)...');
  const noPssCheckinRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `token=${token}`
    }
  }, {
    duty_type: 'Quick Reaction Team (QRT)',
    workload_hours: 50,
    work_pressure_rating: 6,
    recovery_sleep_hours: 6.5,
    rest_interval_hours: 8,
    recovery_pattern: 'BALANCED_CIRCADIAN',
    shift_continuity_days: 3,
    social_support_rating: 6,
    work_life_balance_rating: 6,
    // Explicitly null / skipped PSS
    pss_score: null,
    pss_responses: []
  });

  assert(noPssCheckinRes.status === 201, 'Check-in without PSS-10 accepted without errors (Status 201)');
  const noPssData = noPssCheckinRes.data.data;
  assert(noPssData.checkIn.pss_score === null, 'Check-in persisted pss_score as null');
  assert(!noPssData.evidenceSources.includes('SELF_CHECK'), 'evidenceSources does NOT include SELF_CHECK');
  assert(noPssData.evidenceSources.includes('DUTY'), 'evidenceSources includes DUTY');
  assert(noPssData.evidenceSources.includes('WORKLOAD'), 'evidenceSources includes WORKLOAD');
  assert(noPssData.evidenceSources.includes('REST_RECOVERY'), 'evidenceSources includes REST_RECOVERY');
  assert(noPssData.evidenceCount === 3, `evidenceCount is exactly 3 (got ${noPssData.evidenceCount})`);
  assert(noPssData.prediction.concernLevel === 'UNDETERMINED' && noPssData.prediction.compositeRiskScore === null, `Zero-Guessing Enforced: Insufficient evidence produces UNDETERMINED without guessing score (Score: ${noPssData.prediction.compositeRiskScore})`);
  assert(noPssData.recommendations && noPssData.recommendations.actionItems.length > 0, 'Personalized recommendations generated without PSS');

  // Step 6: Test Optional PSS-10 with Wearable Smart Jacket (4 Evidence Sources, No PSS)
  console.log('\n[Step 6] Verifying Optional PSS-10 with Wearable Telemetry (4 Sources: Duty, Workload, Rest, Wearable)...');
  const wearableNoPssRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `token=${token}`
    }
  }, {
    duty_type: 'High-Altitude Patrol',
    workload_hours: 54,
    work_pressure_rating: 7,
    recovery_sleep_hours: 6.0,
    rest_interval_hours: 8,
    recovery_pattern: 'SHIFT_LAG',
    shift_continuity_days: 4,
    social_support_rating: 6,
    work_life_balance_rating: 5,
    pss_score: null,
    // Authorized Wearable inputs
    resting_heart_rate: 76,
    hrv_ms: 38,
    respiration_rate: 17,
    skin_temperature_c: 36.6,
    fatigue_physical_strain: 55,
    wearable_synced: true
  });

  assert(wearableNoPssRes.status === 201, 'Wearable check-in without PSS-10 accepted (Status 201)');
  const wNoPssData = wearableNoPssRes.data.data;
  assert(wNoPssData.checkIn.pss_score === null, 'Wearable check-in pss_score is null');
  assert(wNoPssData.evidenceSources.includes('WEARABLE'), 'evidenceSources includes WEARABLE');
  assert(!wNoPssData.evidenceSources.includes('SELF_CHECK'), 'evidenceSources does NOT include SELF_CHECK');
  assert(wNoPssData.evidenceCount === 4, `evidenceCount is 4 (got ${wNoPssData.evidenceCount})`);
  assert(wNoPssData.prediction.compositeRiskScore > 0, `Prediction generated from 4 non-PSS sources (Score: ${wNoPssData.prediction.compositeRiskScore})`);

  console.log('\n===============================================================');
  console.log(`  VERIFICATION RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
