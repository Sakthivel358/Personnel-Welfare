/**
 * =============================================================================
 * SIH26186 Personnel Welfare System — Automated Test Suite
 * Tasks 22, 23 & 24: Evidence Strength, Data Availability & Main Contributors
 * =============================================================================
 * 
 * Verifies:
 * 1. Task 22: Evidence Strength decoupled from Welfare Concern (Risk).
 *    - Display separately: WELFARE CONCERN — HIGH and EVIDENCE — MODERATE.
 *    - Evidence depends on Quality, Completeness, and Availability of authorized data.
 * 2. Task 23: Data Availability:
 *    - Shows: DATA AVAILABLE — 4 / 5 (or X / 5).
 *    - Only counts evidence sources that actually contain valid authorized data.
 *    - Zero counting of fake/demo/un-synchronized values.
 * 3. Task 24: Main Contributors:
 *    - Actual factors contributing to current result (↑ Workload, ↓ Rest, ↑ Night duty,
 *      ↑ Fatigue indicators, relevant wearable changes).
 *    - Zero invented contributors.
 * =============================================================================
 */

const ML_SERVICE_URL = 'http://127.0.0.1:8000';
const BACKEND_URL = 'http://localhost:5000';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('======================================================================');
  console.log('🧪 VERIFYING TASKS 22, 23 & 24: EVIDENCE, AVAILABILITY & CONTRIBUTORS');
  console.log('======================================================================');

  // -------------------------------------------------------------
  // Test 1: User's Exact Prompt Scenario
  // WELFARE CONCERN — HIGH
  // EVIDENCE — MODERATE
  // DATA AVAILABLE — 4 / 5
  // Contributors: ↑ Workload, ↓ Rest, ↑ Night duty, ↑ Perceived Stress (Zero Wearable Invention)
  // -------------------------------------------------------------
  console.log('\n[Test 1] Testing Exact User Scenario: WELFARE CONCERN — HIGH & EVIDENCE — MODERATE (DATA AVAILABLE — 4 / 5)...');
  try {
    const inputScenario1 = {
      // 1. DUTY (Valid authorized data)
      duty_type: 'High-Tempo Active Security Watch',
      prolonged_duty_hours: 14.0,
      night_duty_hours: 18.0,
      shift_continuity_days: 7.0,

      // 2. WORKLOAD (Valid authorized data - High strain)
      workload_hours: 72.0,
      work_pressure_rating: 9.0,

      // 3. REST_RECOVERY (Valid authorized data - Sleep deficit)
      recovery_sleep_hours: 4.0,
      rest_interval_hours: 5.0,
      recovery_pattern: 'FRAGMENTED',

      // 4. SELF-CHECK (Valid authorized PSS-10 score - Elevated)
      pss_score: 32.0,

      // 5. WEARABLE (STRICTLY ABSENT - No sensor synced)
      wearable_synced: false
      // resting_heart_rate, hrv_ms, etc. all omitted
    };

    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputScenario1)
    });
    const json = await res.json();
    assert(json.success === true, 'Inference request succeeds');
    const data = json.data;

    // Requirement 22: Display separately WELFARE CONCERN — HIGH and EVIDENCE — MODERATE
    assert(data.concernLevel === 'HIGH', `Welfare concern is HIGH (got: ${data.concernLevel})`);
    assert(data.welfareConcernDisplay === 'WELFARE CONCERN — HIGH', `welfareConcernDisplay is strictly 'WELFARE CONCERN — HIGH' (got: ${data.welfareConcernDisplay})`);
    assert(data.evidenceStrength === 'MODERATE', `Evidence strength is MODERATE (got: ${data.evidenceStrength})`);
    assert(data.evidenceDisplay === 'EVIDENCE — MODERATE', `evidenceDisplay is strictly 'EVIDENCE — MODERATE' (got: ${data.evidenceDisplay})`);

    // Requirement 23: DATA AVAILABLE — 4 / 5
    assert(data.dataAvailableCount === 4, `dataAvailableCount is exactly 4 (got: ${data.dataAvailableCount})`);
    assert(data.dataAvailableTotal === 5, `dataAvailableTotal is 5 (got: ${data.dataAvailableTotal})`);
    assert(data.dataAvailableDisplay === 'DATA AVAILABLE — 4 / 5', `dataAvailableDisplay is strictly 'DATA AVAILABLE — 4 / 5' (got: ${data.dataAvailableDisplay})`);
    assert(data.evidenceSources.includes('DUTY'), 'Available sources includes DUTY');
    assert(data.evidenceSources.includes('WORKLOAD'), 'Available sources includes WORKLOAD');
    assert(data.evidenceSources.includes('REST_RECOVERY'), 'Available sources includes REST_RECOVERY');
    assert(data.evidenceSources.includes('SELF_CHECK'), 'Available sources includes SELF_CHECK');
    assert(!data.evidenceSources.includes('WEARABLE'), 'Available sources strictly excludes WEARABLE (no sensor data)');

    // Requirement 24: Main contributors with directional arrows
    const dl = data.decisionLayer;
    assert(dl && dl.mainContributors && dl.mainContributors.length > 0, 'Decision Layer contains mainContributors');
    const contributors = dl.mainContributors;

    const directionalTitles = contributors.map(c => c.directionalTitle);
    assert(directionalTitles.includes('↑ Workload'), `Contributors includes '↑ Workload' (got: ${directionalTitles.join(', ')})`);
    assert(directionalTitles.includes('↓ Rest'), `Contributors includes '↓ Rest' (got: ${directionalTitles.join(', ')})`);
    assert(directionalTitles.includes('↑ Night duty'), `Contributors includes '↑ Night duty' (got: ${directionalTitles.join(', ')})`);
    assert(directionalTitles.includes('↑ Perceived Stress'), `Contributors includes '↑ Perceived Stress' (got: ${directionalTitles.join(', ')})`);

    // Zero invention guarantee: Wearable features MUST NOT be in contributors
    const keys = contributors.map(c => c.featureKey);
    const hasWearableKey = keys.some(k => ['resting_heart_rate', 'hrv_ms', 'respiration_rate', 'skin_temperature_c', 'fatigue_physical_strain'].includes(k));
    assert(!hasWearableKey, 'Zero invented contributors: No wearable features present when sensor was unsupplied');

    // Check topDrivers has directional indicators
    assert(data.topDrivers.some(d => d.startsWith('↑') || d.startsWith('↓')), `topDrivers contains directional formatting (got: ${data.topDrivers.join(', ')})`);
  } catch (err) {
    assert(false, `Failed in Test 1: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 2: Decoupling Guarantee — Low Concern with High Evidence
  // WELFARE CONCERN — LOW
  // EVIDENCE — HIGH
  // DATA AVAILABLE — 5 / 5
  // Proves risk and evidence are NOT the same thing!
  // -------------------------------------------------------------
  console.log('\n[Test 2] Testing Decoupling: WELFARE CONCERN — LOW & EVIDENCE — HIGH (DATA AVAILABLE — 5 / 5)...');
  try {
    const inputScenario2 = {
      // Balanced duty & workload
      duty_type: 'Base Standard Watch',
      prolonged_duty_hours: 6.0,
      night_duty_hours: 0.0,
      shift_continuity_days: 1.0,
      workload_hours: 42.0,
      work_pressure_rating: 3.0,
      recovery_sleep_hours: 8.0,
      rest_interval_hours: 12.0,
      recovery_pattern: 'CONTINUOUS',
      pss_score: 8.0,

      // Synchronized Smart Jacket biometrics in healthy state
      wearable_synced: true,
      resting_heart_rate: 60.0,
      hrv_ms: 72.0,
      respiration_rate: 13.0,
      skin_temperature_c: 36.5,
      fatigue_physical_strain: 12.0
    };

    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputScenario2)
    });
    const json = await res.json();
    assert(json.success === true, 'Low strain inference request succeeds');
    const data = json.data;

    assert(data.concernLevel === 'LOW', `Welfare concern is LOW (got: ${data.concernLevel})`);
    assert(data.welfareConcernDisplay === 'WELFARE CONCERN — LOW', `welfareConcernDisplay is strictly 'WELFARE CONCERN — LOW' (got: ${data.welfareConcernDisplay})`);
    assert(data.evidenceStrength === 'HIGH', `Evidence strength is HIGH with full biometrics (got: ${data.evidenceStrength})`);
    assert(data.evidenceDisplay === 'EVIDENCE — HIGH', `evidenceDisplay is strictly 'EVIDENCE — HIGH' (got: ${data.evidenceDisplay})`);
    assert(data.dataAvailableCount === 5, `dataAvailableCount is 5 (got: ${data.dataAvailableCount})`);
    assert(data.dataAvailableDisplay === 'DATA AVAILABLE — 5 / 5', `dataAvailableDisplay is strictly 'DATA AVAILABLE — 5 / 5' (got: ${data.dataAvailableDisplay})`);
  } catch (err) {
    assert(false, `Failed in Test 2: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 3: High Biometric Strain with Wearable Changes
  // WELFARE CONCERN — HIGH & EVIDENCE — HIGH
  // Directional Wearable Indicators: ↑ Fatigue indicators, ↑ Heart Rate, ↓ Heart Rate Variability
  // -------------------------------------------------------------
  console.log('\n[Test 3] Testing Relevant Wearable Changes (↑ Fatigue indicators, ↑ Heart Rate, ↓ Heart Rate Variability)...');
  try {
    const inputScenario3 = {
      duty_type: 'Combat QRT Patrol',
      prolonged_duty_hours: 16.0,
      night_duty_hours: 12.0,
      shift_continuity_days: 6.0,
      workload_hours: 76.0,
      work_pressure_rating: 9.0,
      recovery_sleep_hours: 3.5,
      rest_interval_hours: 4.0,
      recovery_pattern: 'SLEEP_DEBT',
      pss_score: 30.0,

      // Elevated biometric strain
      wearable_synced: true,
      resting_heart_rate: 108.0,
      hrv_ms: 22.0,
      respiration_rate: 26.0,
      skin_temperature_c: 37.9,
      fatigue_physical_strain: 88.0
    };

    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputScenario3)
    });
    const json = await res.json();
    assert(json.success === true, 'High biometric strain request succeeds');
    const data = json.data;

    assert(data.concernLevel === 'HIGH', `Welfare concern is HIGH (got: ${data.concernLevel})`);
    assert(data.welfareConcernDisplay === 'WELFARE CONCERN — HIGH', 'welfareConcernDisplay matches');
    assert(data.evidenceStrength === 'HIGH', 'evidenceStrength is HIGH');
    assert(data.evidenceDisplay === 'EVIDENCE — HIGH', 'evidenceDisplay matches');
    assert(data.dataAvailableCount === 5, 'dataAvailableCount is 5 / 5');

    const contributors = data.decisionLayer.mainContributors;
    const directionalTitles = contributors.map(c => c.directionalTitle);
    assert(directionalTitles.includes('↑ Fatigue indicators'), `Contributors includes '↑ Fatigue indicators' (got: ${directionalTitles.join(', ')})`);
    assert(directionalTitles.includes('↑ Heart Rate'), `Contributors includes '↑ Heart Rate' (got: ${directionalTitles.join(', ')})`);
    assert(directionalTitles.includes('↓ Heart Rate Variability'), `Contributors includes '↓ Heart Rate Variability' (got: ${directionalTitles.join(', ')})`);
    assert(directionalTitles.includes('↑ Respiration Rate'), `Contributors includes '↑ Respiration Rate' (got: ${directionalTitles.join(', ')})`);
    assert(directionalTitles.includes('↑ Body Temperature'), `Contributors includes '↑ Body Temperature' (got: ${directionalTitles.join(', ')})`);
  } catch (err) {
    assert(false, `Failed in Test 3: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 4: Data Availability — No Fake/Demo Data Counted
  // -------------------------------------------------------------
  console.log('\n[Test 4] Testing Data Availability Counting (Only Valid Authorized Data Counted)...');
  try {
    // Only Workload and Rest provided, with PSS skipped and Wearable un-synced
    const partialInput = {
      workload_hours: 50.0,
      work_pressure_rating: 6.0,
      recovery_sleep_hours: 6.5,
      // duty details omitted or 0
      prolonged_duty_hours: 0.0,
      night_duty_hours: 0.0,
      shift_continuity_days: 0.0,
      duty_type: '',
      pss_score: null,
      wearable_synced: false
    };

    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partialInput)
    });
    const json = await res.json();
    assert(json.success === true, 'Partial request processed');
    const data = json.data;

    // DUTY has 0/empty -> not counted
    // SELF_CHECK is null -> not counted
    // WEARABLE has no biometrics & unsynced -> not counted
    // WORKLOAD is 50h -> counted
    // REST_RECOVERY is 6.5h -> counted
    assert(data.dataAvailableCount === 2, `dataAvailableCount is exactly 2 (got: ${data.dataAvailableCount})`);
    assert(data.dataAvailableDisplay === 'DATA AVAILABLE — 2 / 5', `dataAvailableDisplay is strictly 'DATA AVAILABLE — 2 / 5' (got: ${data.dataAvailableDisplay})`);
    assert(data.evidenceStrength === 'INSUFFICIENT' || data.evidenceStrength === 'EMERGING', `Evidence strength reflects limited availability (got: ${data.evidenceStrength})`);
  } catch (err) {
    assert(false, `Failed in Test 4: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 5: Decision Layer /info Transparency API
  // -------------------------------------------------------------
  console.log('\n[Test 5] Verifying GET /decision-layer/info reflects 3 pillars, availability, and contributors...');
  try {
    const res = await fetch(`${ML_SERVICE_URL}/decision-layer/info`);
    assert(res.status === 200, 'GET /decision-layer/info returns 200');
    const info = await res.json();

    assert(info.evidence_strength_pillars !== undefined, 'evidence_strength_pillars is documented');
    assert(info.evidence_strength_pillars.quality !== undefined, 'Quality pillar documented');
    assert(info.evidence_strength_pillars.completeness !== undefined, 'Completeness pillar documented');
    assert(info.evidence_strength_pillars.availability !== undefined, 'Availability pillar documented');
    assert(info.evidence_strength_pillars.decoupled_from_risk === true, 'decoupled_from_risk guarantee is true');
    assert(info.data_availability_rules !== undefined, 'data_availability_rules is documented');
    assert(info.data_availability_rules.display_format === 'DATA AVAILABLE — X / 5', 'display_format is DATA AVAILABLE — X / 5');
    assert(info.main_contributors_rules !== undefined, 'main_contributors_rules is documented');
    assert(info.main_contributors_rules.directional_indicators.includes('↑ Workload'), 'Directional indicators include ↑ Workload');
  } catch (err) {
    assert(false, `Failed in Test 5: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 6: Backend Check-in & Officer Portal Integration
  // -------------------------------------------------------------
  console.log('\n[Test 6] Testing Backend Persistence & Officer Triage Queue Integration...');
  try {
    const testEmail = `evidence_test_${Date.now()}@forces.gov.in`;
    const testPersonnelId = `PERS-EV-${Date.now().toString().slice(-4)}`;

    const regRes = await fetch(`${BACKEND_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password@123',
        fullName: 'Subedar Evidence Tester',
        personnelId: testPersonnelId,
        rank: 'Subedar',
        unit: 'Frontier Rifles',
        role: 'personnel'
      })
    });
    const regData = await regRes.json();
    const token = regData.token || (regData.data && regData.data.token);
    assert(regRes.status === 201, 'Test personnel registered');

    // Submit Check-in with 4 / 5 data sources (No Wearable)
    const checkinRes = await fetch(`${BACKEND_URL}/api/v1/checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        duty_type: 'High-Pace Watch',
        prolonged_duty_hours: 14.0,
        night_duty_hours: 16.0,
        shift_continuity_days: 6.0,
        workload_hours: 70.0,
        work_pressure_rating: 9.0,
        recovery_sleep_hours: 4.5,
        rest_interval_hours: 5.0,
        recovery_pattern: 'SLEEP_DEBT',
        pss_score: 31.0,
        wearable_synced: false
      })
    });
    const checkinData = await checkinRes.json();
    assert(checkinRes.status === 201, 'Backend check-in submitted successfully');
    const cData = checkinData.data;

    assert(cData.welfareConcernDisplay === 'WELFARE CONCERN — HIGH', `Check-in returned welfareConcernDisplay: 'WELFARE CONCERN — HIGH' (got: ${cData.welfareConcernDisplay})`);
    assert(cData.evidenceDisplay === 'EVIDENCE — MODERATE', `Check-in returned evidenceDisplay: 'EVIDENCE — MODERATE' (got: ${cData.evidenceDisplay})`);
    assert(cData.dataAvailableDisplay === 'DATA AVAILABLE — 4 / 5', `Check-in returned dataAvailableDisplay: 'DATA AVAILABLE — 4 / 5' (got: ${cData.dataAvailableDisplay})`);
    assert(cData.dataAvailableCount === 4, `Check-in dataAvailableCount is 4 (got: ${cData.dataAvailableCount})`);

    // Test GET /prediction/latest
    const latestRes = await fetch(`${BACKEND_URL}/api/v1/prediction/latest`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const latestData = await latestRes.json();
    assert(latestRes.status === 200, 'GET /prediction/latest returns 200');
    assert(latestData.data.welfareConcernDisplay === 'WELFARE CONCERN — HIGH', 'latest exposes welfareConcernDisplay');
    assert(latestData.data.evidenceDisplay === 'EVIDENCE — MODERATE', 'latest exposes evidenceDisplay');
    assert(latestData.data.dataAvailableDisplay === 'DATA AVAILABLE — 4 / 5', 'latest exposes dataAvailableDisplay');

    // Test GET /prediction/explainability
    const expRes = await fetch(`${BACKEND_URL}/api/v1/prediction/explainability`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const expData = await expRes.json();
    assert(expRes.status === 200, 'GET /prediction/explainability returns 200');
    assert(expData.data.welfareConcernDisplay === 'WELFARE CONCERN — HIGH', 'explainability exposes welfareConcernDisplay');
    assert(expData.data.evidenceDisplay === 'EVIDENCE — MODERATE', 'explainability exposes evidenceDisplay');
    assert(expData.data.dataAvailableDisplay === 'DATA AVAILABLE — 4 / 5', 'explainability exposes dataAvailableDisplay');

    // Test Welfare Officer Alerts Queue
    const offLoginRes = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'officer.welfare@crpf.gov.in',
        password: 'Password@123'
      })
    });
    const offData = await offLoginRes.json();
    assert(offData.success === true, 'Welfare Officer authenticated');
    const offToken = offData.token || (offData.data && offData.data.token);

    const alertsRes = await fetch(`${BACKEND_URL}/api/v1/officer/alerts`, {
      headers: { 'Authorization': `Bearer ${offToken}` }
    });
    const alertsData = await alertsRes.json();
    assert(alertsRes.status === 200, 'GET /officer/alerts returns 200');
    const alerts = alertsData.data || [];
    const alert = alerts.find(a => a.personnelId === testPersonnelId);
    assert(alert !== undefined, `Officer triage queue contains alert for ${testPersonnelId}`);
    assert(alert.welfareConcernDisplay === 'WELFARE CONCERN — HIGH', `Alert exposes welfareConcernDisplay (got: ${alert.welfareConcernDisplay})`);
    assert(alert.evidenceDisplay === 'EVIDENCE — MODERATE', `Alert exposes evidenceDisplay (got: ${alert.evidenceDisplay})`);
    assert(alert.dataAvailableDisplay === 'DATA AVAILABLE — 4 / 5', `Alert exposes dataAvailableDisplay (got: ${alert.dataAvailableDisplay})`);
  } catch (err) {
    assert(false, `Failed in Test 6: ${err.message}`);
  }

  console.log('\n======================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
