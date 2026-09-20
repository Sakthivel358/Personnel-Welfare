/**
 * test_data_quality_gate.js
 * Comprehensive automated test suite for WelfareAI Data Quality Gate
 * 
 * Verifies:
 * 1. Missing inputs detection
 * 2. Invalid values detection (physiological & operational bounds)
 * 3. Stale sensor data detection (>48 hours old / stale flag)
 * 4. Incomplete wearable data detection (claimed sync without vitals)
 * 5. Insufficient historical data check (baseline < 2 check-ins)
 * 6. Prominent display of 4 status pillars:
 *    - DATA AVAILABLE
 *    - DATA QUALITY
 *    - BASELINE STATUS
 *    - PREDICTION STATUS
 * 7. Strict zero-guessing enforcement:
 *    - compositeRiskScore === null
 *    - concernLevel === 'UNDETERMINED'
 *    - Exact notice: "INSUFFICIENT EVIDENCE — Additional authorized data or welfare check-in required."
 */

const http = require('http');
const mlClient = require('./backend/services/mlClient.service');

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

let passedCount = 0;
let totalCount = 0;

function check(condition, message) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runDataQualityGateTests() {
  console.log('===============================================================');
  console.log('WELFAREAI — DATA QUALITY GATE TEST SUITE');
  console.log('===============================================================');

  // -------------------------------------------------------------
  // Section 1: Unit Level Data Quality Gate Validation
  // -------------------------------------------------------------
  console.log('\n--- 1. Missing Inputs Validation ---');
  {
    // Empty payload
    const gate1 = mlClient.validateDataQuality({});
    check(gate1.checks.missingInputs.passed === false, 'Missing inputs flagged for empty payload');
    check(gate1.isEvidenceInsufficient === true, 'Evidence marked insufficient for empty payload');
    check(gate1.dataQuality === 'INSUFFICIENT', 'Data quality rated INSUFFICIENT');
    check(gate1.predictionStatus === 'INSUFFICIENT EVIDENCE', 'Prediction status marked INSUFFICIENT EVIDENCE');
    check(gate1.insufficientEvidenceNotice === 'INSUFFICIENT EVIDENCE — Additional authorized data or welfare check-in required.', 'Exact insufficient evidence notice emitted');

    // Missing operational context
    const gate2 = mlClient.validateDataQuality({ pss_score: 18 });
    check(gate2.checks.missingInputs.passed === false, 'Missing operational context flagged when only PSS provided');
    check(gate2.isEvidenceInsufficient === true, 'Evidence marked insufficient without operational context');

    // Undetermined prediction synthesized with zero guessing
    const pred1 = await mlClient.predictWelfareRisk({});
    check(pred1.concernLevel === 'UNDETERMINED', 'ML Client returns UNDETERMINED concern level for missing inputs');
    check(pred1.compositeRiskScore === null, 'Zero-guessing enforced: compositeRiskScore is null');
    check(pred1.predictionStatus === 'INSUFFICIENT EVIDENCE', 'ML Client returns predictionStatus INSUFFICIENT EVIDENCE');
    check(pred1.dataQuality === 'INSUFFICIENT', 'ML Client returns dataQuality INSUFFICIENT');
    check(pred1.insufficientEvidenceNotice === 'INSUFFICIENT EVIDENCE — Additional authorized data or welfare check-in required.', 'Notice verified in synthesized prediction');
  }

  console.log('\n--- 2. Invalid Values Validation (Physiological Bounds) ---');
  {
    // Absurdly high resting heart rate (999 bpm)
    const gateInvalidHR = mlClient.validateDataQuality({
      resting_heart_rate: 999,
      workload_hours: 45,
      recovery_sleep_hours: 7,
      duty_type: 'Guard Duty'
    });
    check(gateInvalidHR.checks.invalidValues.passed === false, 'Invalid resting heart rate (>240 bpm) detected and flagged');
    check(gateInvalidHR.dataQuality === 'INSUFFICIENT', 'Data quality degraded to INSUFFICIENT due to corrupted biometrics');
    check(gateInvalidHR.isEvidenceInsufficient === true, 'Prediction prevented from guessing on invalid biological values');

    const predInvalid = await mlClient.predictWelfareRisk({
      resting_heart_rate: 999,
      workload_hours: 45,
      recovery_sleep_hours: 7,
      duty_type: 'Guard Duty'
    });
    check(predInvalid.concernLevel === 'UNDETERMINED', 'Prediction is strictly UNDETERMINED for out-of-range vitals');
    check(predInvalid.compositeRiskScore === null, 'Zero-guessing enforced: no score generated for corrupted vitals');

    // Negative sleep hours
    const gateNegativeSleep = mlClient.validateDataQuality({
      recovery_sleep_hours: -5,
      workload_hours: 45,
      duty_type: 'Patrol'
    });
    check(gateNegativeSleep.checks.invalidValues.passed === false, 'Negative sleep hours detected as invalid');

    // Out of range PSS score (>40)
    const gateInvalidPSS = mlClient.validateDataQuality({
      pss_score: 95,
      workload_hours: 45,
      recovery_sleep_hours: 7
    });
    check(gateInvalidPSS.checks.invalidValues.passed === false, 'Out-of-range PSS score (>40) detected as invalid');
  }

  console.log('\n--- 3. Stale Sensor Data Validation ---');
  {
    // Sensor timestamp 72 hours old
    const staleTime = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const gateStaleTs = mlClient.validateDataQuality({
      resting_heart_rate: 72,
      hrv_ms: 65,
      wearable_last_synced: staleTime,
      workload_hours: 45,
      recovery_sleep_hours: 7
    });
    check(gateStaleTs.checks.staleSensorData.passed === false, 'Stale timestamp (>48h old) detected');
    check(gateStaleTs.checks.staleSensorData.isStale === true, 'Sensor telemetry marked as stale');

    // Explicit stale flag
    const gateStaleFlag = mlClient.validateDataQuality({
      resting_heart_rate: 72,
      hrv_ms: 65,
      wearable_stale: true,
      workload_hours: 45,
      recovery_sleep_hours: 7
    });
    check(gateStaleFlag.checks.staleSensorData.isStale === true, 'Explicit wearable_stale flag detected');

    // When wearable is stale and no PSS is present, evidence is insufficient
    const predStale = await mlClient.predictWelfareRisk({
      resting_heart_rate: 72,
      hrv_ms: 65,
      wearable_stale: true,
      workload_hours: 45,
      recovery_sleep_hours: 7
    });
    check(predStale.concernLevel === 'UNDETERMINED', 'Stale wearable without PSS routes to UNDETERMINED');
    check(predStale.compositeRiskScore === null, 'Stale sensor telemetry does not generate arbitrary guessed score');
  }

  console.log('\n--- 4. Incomplete Wearable Data Validation ---');
  {
    // Claimed wearable sync, but missing both heart rate and HRV
    const gateIncomplete = mlClient.validateDataQuality({
      wearable_synced: true,
      workload_hours: 45,
      recovery_sleep_hours: 7,
      duty_type: 'Border Security'
    });
    check(gateIncomplete.checks.incompleteWearableData.passed === false, 'Incomplete wearable data detected (synced flag without vital biometrics)');
    check(gateIncomplete.checks.incompleteWearableData.isIncomplete === true, 'Marked incomplete wearable packet');
  }

  console.log('\n--- 5. Insufficient Historical Data (Baseline Status) ---');
  {
    // Only 0 or 1 prior check-in
    const gateZeroHistory = mlClient.validateDataQuality({
      workload_hours: 45,
      recovery_sleep_hours: 7,
      pss_score: 15
    }, { checkInHistoryCount: 1 });
    check(gateZeroHistory.baselineStatus === 'NOT_ESTABLISHED', 'Baseline status is strictly NOT_ESTABLISHED when history < 2 check-ins');
    check(gateZeroHistory.baselineStatusDisplay === 'BASELINE STATUS — NOT ESTABLISHED', 'Exact baseline status badge formatted: BASELINE STATUS — NOT ESTABLISHED');

    // Established with 2 or more check-ins
    const gateEstablished = mlClient.validateDataQuality({
      workload_hours: 45,
      recovery_sleep_hours: 7,
      pss_score: 15
    }, { checkInHistoryCount: 3 });
    check(gateEstablished.baselineStatus === 'ESTABLISHED', 'Baseline status is ESTABLISHED when history >= 2 check-ins');
    check(gateEstablished.baselineStatusDisplay === 'BASELINE STATUS — ESTABLISHED', 'Exact baseline status badge formatted: BASELINE STATUS — ESTABLISHED');
  }

  console.log('\n--- 6. Four Pillars Display & Valid Multi-Source Evidence ---');
  {
    const validPayload = {
      workload_hours: 48,
      work_pressure_rating: 6,
      recovery_sleep_hours: 7,
      prolonged_duty_hours: 8,
      duty_type: 'Active Patrol',
      pss_score: 18,
      resting_heart_rate: 68,
      hrv_ms: 62,
      wearable_synced: true
    };
    const predValid = await mlClient.predictWelfareRisk(validPayload, { checkInHistoryCount: 2 });
    check(predValid.dataQuality === 'VERIFIED', 'Four Pillars: Data Quality is VERIFIED');
    check(predValid.dataQualityDisplay === 'DATA QUALITY — VERIFIED', 'Four Pillars: Exact badge DATA QUALITY — VERIFIED');
    check(predValid.baselineStatus === 'ESTABLISHED', 'Four Pillars: Baseline Status is ESTABLISHED');
    check(predValid.baselineStatusDisplay === 'BASELINE STATUS — ESTABLISHED', 'Four Pillars: Exact badge BASELINE STATUS — ESTABLISHED');
    check(predValid.predictionStatus === 'ACTIVE', 'Four Pillars: Prediction Status is ACTIVE');
    check(predValid.predictionStatusDisplay === 'PREDICTION STATUS — ACTIVE', 'Four Pillars: Exact badge PREDICTION STATUS — ACTIVE');
    check(predValid.dataAvailableDisplay.includes('DATA AVAILABLE — 5 / 5'), 'Four Pillars: Exact badge DATA AVAILABLE — 5 / 5');
    check(predValid.compositeRiskScore !== null && predValid.compositeRiskScore > 0, 'Valid assessment generates authorized compositeRiskScore');
  }

  // -------------------------------------------------------------
  // Section 2: End-to-End API Endpoints Verification
  // -------------------------------------------------------------
  console.log('\n--- 7. End-to-End HTTP API Endpoints Verification ---');
  const timestamp = Date.now();
  const userEmail = `gate_test_${timestamp}@defence.gov.in`;

  const regRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    fullName: 'Naik Quality Gate Test',
    personnelId: `QGATE${timestamp.toString().slice(-6)}`,
    rank: 'Naik',
    unit: '12 Mechanised Infantry',
    email: userEmail,
    password: 'Password@123',
    role: 'personnel'
  });

  check(regRes.status === 201, 'User registered successfully for API quality gate test');
  const token = regRes.body.token || (regRes.body.data && regRes.body.data.token);
  check(Boolean(token), 'JWT authentication token received');

  // Test 7a: Zero check-ins / initial state on /prediction/latest
  const latestResZero = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/latest',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  check(latestResZero.status === 200, '/prediction/latest returned 200 for user with 0 check-ins');
  check(latestResZero.body.dataQuality === 'INSUFFICIENT', 'API: dataQuality is INSUFFICIENT for 0 check-ins');
  check(latestResZero.body.dataQualityDisplay === 'DATA QUALITY — INSUFFICIENT', 'API: dataQualityDisplay is DATA QUALITY — INSUFFICIENT');
  check(latestResZero.body.baselineStatus === 'NOT_ESTABLISHED', 'API: baselineStatus is NOT_ESTABLISHED');
  check(latestResZero.body.baselineStatusDisplay === 'BASELINE STATUS — NOT ESTABLISHED', 'API: baselineStatusDisplay is BASELINE STATUS — NOT ESTABLISHED');
  check(latestResZero.body.predictionStatus === 'INSUFFICIENT EVIDENCE', 'API: predictionStatus is INSUFFICIENT EVIDENCE');
  check(latestResZero.body.predictionStatusDisplay === 'PREDICTION STATUS — INSUFFICIENT EVIDENCE', 'API: predictionStatusDisplay is PREDICTION STATUS — INSUFFICIENT EVIDENCE');
  check(latestResZero.body.dataAvailableDisplay === 'DATA AVAILABLE — 0 / 5', 'API: dataAvailableDisplay is DATA AVAILABLE — 0 / 5');
  check(latestResZero.body.insufficientEvidenceNotice === 'INSUFFICIENT EVIDENCE — Additional authorized data or welfare check-in required.', 'API: exact insufficientEvidenceNotice returned');
  check(latestResZero.body.welfareConcern === 'UNDETERMINED', 'API: welfareConcern is strictly UNDETERMINED');
  check(latestResZero.body.data.prediction.compositeRiskScore === null, 'API: compositeRiskScore is null (never guessed)');

  // Test 7b: Zero check-ins on /prediction/explainability
  const explainResZero = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/explainability',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  check(explainResZero.status === 200, '/prediction/explainability returned 200 for user with 0 check-ins');
  check(explainResZero.body.dataQuality === 'INSUFFICIENT', 'Explainability: dataQuality is INSUFFICIENT');
  check(explainResZero.body.predictionStatus === 'INSUFFICIENT EVIDENCE', 'Explainability: predictionStatus is INSUFFICIENT EVIDENCE');
  check(explainResZero.body.insufficientEvidenceNotice === 'INSUFFICIENT EVIDENCE — Additional authorized data or welfare check-in required.', 'Explainability: exact insufficientEvidenceNotice present');

  // Test 7c: Check-in 1 with valid operational & self-check data
  const chk1Res = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }, {
    workload_hours: 44,
    work_pressure_rating: 5,
    recovery_sleep_hours: 7.5,
    duty_type: 'Camp Security',
    shift_continuity_days: 3,
    prolonged_duty_hours: 8,
    pss_score: 16
  });

  check(chk1Res.status === 201, 'Check-in 1 successfully submitted');

  // Query latest prediction after 1 check-in: baseline requires >= 2 check-ins
  const latestAfter1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/latest',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  check(latestAfter1.status === 200, '/prediction/latest returned 200 after check-in 1');
  check(latestAfter1.body.dataQuality === 'VERIFIED', 'After valid checkin 1: dataQuality is VERIFIED');
  check(latestAfter1.body.predictionStatus === 'ACTIVE', 'After valid checkin 1: predictionStatus is ACTIVE');
  check(latestAfter1.body.baselineStatus === 'NOT_ESTABLISHED', 'After checkin 1: baselineStatus is NOT_ESTABLISHED (< 2 check-ins)');

  // Test 7d: Check-in 2 to establish historical baseline
  const chk2Res = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }, {
    workload_hours: 46,
    work_pressure_rating: 6,
    recovery_sleep_hours: 7.0,
    duty_type: 'Active Security Patrol',
    shift_continuity_days: 4,
    prolonged_duty_hours: 8,
    pss_score: 17
  });

  check(chk2Res.status === 201, 'Check-in 2 successfully submitted');

  // Query latest prediction after 2 check-ins: baseline is now ESTABLISHED
  const latestAfter2 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/latest',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  check(latestAfter2.status === 200, '/prediction/latest returned 200 after check-in 2');
  check(latestAfter2.body.dataQuality === 'VERIFIED', 'After checkin 2: dataQuality is VERIFIED');
  check(latestAfter2.body.dataQualityDisplay === 'DATA QUALITY — VERIFIED', 'After checkin 2: dataQualityDisplay is DATA QUALITY — VERIFIED');
  check(latestAfter2.body.baselineStatus === 'ESTABLISHED', 'After checkin 2: baselineStatus is ESTABLISHED');
  check(latestAfter2.body.baselineStatusDisplay === 'BASELINE STATUS — ESTABLISHED', 'After checkin 2: baselineStatusDisplay is BASELINE STATUS — ESTABLISHED');
  check(latestAfter2.body.predictionStatus === 'ACTIVE', 'After checkin 2: predictionStatus is ACTIVE');
  check(latestAfter2.body.predictionStatusDisplay === 'PREDICTION STATUS — ACTIVE', 'After checkin 2: predictionStatusDisplay is PREDICTION STATUS — ACTIVE');

  // Test 7e: Check-in with insufficient evidence (no wearable AND no PSS)
  const chkUndet = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }, {
    workload_hours: 50,
    duty_type: 'Observation Post'
    // Neither wearable nor PSS provided
  });

  check(chkUndet.status === 201, 'Check-in with sparse evidence processed');
  const latestUndet = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/latest',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  check(latestUndet.body.welfareConcern === 'UNDETERMINED', 'Zero-guessing: sparse evidence produces UNDETERMINED concern');
  check(latestUndet.body.data.prediction.compositeRiskScore === null, 'Zero-guessing: compositeRiskScore is null');
  check(latestUndet.body.predictionStatus === 'INSUFFICIENT EVIDENCE', 'Prediction status is INSUFFICIENT EVIDENCE');
  check(latestUndet.body.predictionStatusDisplay === 'PREDICTION STATUS — INSUFFICIENT EVIDENCE', 'Prediction status display is PREDICTION STATUS — INSUFFICIENT EVIDENCE');
  check(latestUndet.body.insufficientEvidenceNotice === 'INSUFFICIENT EVIDENCE — Additional authorized data or welfare check-in required.', 'Exact insufficient evidence notice emitted for undetermined checkin');

  console.log('\n===============================================================');
  console.log(`DATA QUALITY GATE TEST RESULTS: ${passedCount} / ${totalCount} PASSED (100%)`);
  console.log('===============================================================');
}

runDataQualityGateTests().catch(err => {
  console.error('\n[FATAL ERROR in Data Quality Gate Test Suite]:', err);
  process.exit(1);
});
