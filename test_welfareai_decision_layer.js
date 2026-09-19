/**
 * test_welfareai_decision_layer.js
 * Verification test suite for Task 20: Create WelfareAI Decision Layer
 *
 * Verifies:
 * 1. FastAPI /decision-layer/info returns engine specification & architecture flow.
 * 2. FastAPI /decision-layer/evaluate returns welfareConcern, evidenceStrength, mainContributors, and humanWelfareReview.
 * 3. Model 1 Wearable + Operational data produces HIGH evidence strength and biometric attribution.
 * 4. Model 2 Fallback data produces MODERATE evidence strength and non-sensor attribution.
 * 5. Elevated strain check-in triggers requiresHumanReview: true with HIGH/CRITICAL priority and recommended action.
 * 6. Low strain check-in results in requiresHumanReview: false and STANDARD_MONITORING priority.
 * 7. Backend /api/v1/checkin persists decisionLayer on Prediction and Alert.
 * 8. Backend /api/v1/prediction/latest and /explainability expose decisionLayer.
 * 9. Backend /api/v1/officer/alerts exposes decision layer review package.
 * 10. Backend /api/v1/system/transparency exposes decision layer pillars.
 */

const ML_SERVICE_URL = 'http://127.0.0.1:8000';
const BACKEND_URL = 'http://127.0.0.1:5000';

async function runTests() {
  console.log('======================================================================');
  console.log('🧪 VERIFYING TASK 20: WELFAREAI DECISION LAYER ARCHITECTURE');
  console.log('======================================================================\n');

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

  // -------------------------------------------------------------
  // Test 1: Decision Layer Architecture Info Endpoint
  // -------------------------------------------------------------
  console.log('[Step 1] Inspecting GET /decision-layer/info on FastAPI service...');
  try {
    const res = await fetch(`${ML_SERVICE_URL}/decision-layer/info`);
    const info = await res.json();
    assert(res.status === 200, 'GET /decision-layer/info returns 200 OK');
    assert(info.engine === 'WelfareAI Decision Layer', 'Engine identified as WelfareAI Decision Layer');
    assert(Array.isArray(info.architecture_flow) && info.architecture_flow.length === 6, 'Architecture flow defines all 6 pipeline stages');
    assert(info.evidence_strength_levels.HIGH !== undefined, 'HIGH evidence strength level defined');
    assert(info.evidence_strength_levels.MODERATE !== undefined, 'MODERATE evidence strength level defined');
    assert(info.evidence_strength_levels.EMERGING !== undefined, 'EMERGING evidence strength level defined');
    assert(info.review_priorities.includes('CRITICAL'), 'Review priorities include CRITICAL');
    assert(info.review_priorities.includes('HIGH'), 'Review priorities include HIGH');
    assert(info.review_priorities.includes('ROUTINE'), 'Review priorities include ROUTINE');
  } catch (err) {
    assert(false, `Failed to call /decision-layer/info: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 2: High Strain Biometric Checkin (Model 1 -> Decision Layer)
  // -------------------------------------------------------------
  console.log('\n[Step 2] Testing High Strain Wearable + Operational Data through Decision Layer...');
  try {
    const highStrainInput = {
      workload_hours: 64.0,
      work_pressure_rating: 8.5,
      recovery_sleep_hours: 4.0,
      shift_continuity_days: 7.0,
      prolonged_duty_hours: 16.0,
      night_duty_hours: 22.0,
      duty_type: 'Quick Reaction Team Tactical Watch',
      deploymentZone: 'High Threat Coastal Sector',
      social_support_rating: 3.5,
      pss_score: 28.0,
      resting_heart_rate: 94.0,
      hrv_ms: 18.0,
      respiration_rate: 26.0,
      skin_temperature_c: 38.1,
      fatigue_physical_strain: 82.0,
      wearable_synced: true
    };

    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(highStrainInput)
    });
    const json = await res.json();
    assert(json.success === true, 'Inference request succeeds');
    const data = json.data;

    assert(data.decisionLayer !== undefined, 'Response includes decisionLayer payload');
    const dl = data.decisionLayer;

    // Pillar 1: Welfare Concern
    assert(dl.welfareConcern !== undefined, 'Pillar 1: welfareConcern is defined');
    assert(dl.welfareConcern.concernLevel === 'HIGH', `Welfare concern level is HIGH (got: ${dl.welfareConcern.concernLevel})`);
    assert(dl.welfareConcern.compositeRiskScore >= 70.0, `Composite risk score is elevated (got: ${dl.welfareConcern.compositeRiskScore}%)`);
    assert(dl.welfareConcern.compoundStrainDetected === true, 'Compounding operational strain detected');

    // Pillar 2: Evidence Strength
    assert(dl.evidenceStrength !== undefined, 'Pillar 2: evidenceStrength is defined');
    assert(dl.evidenceStrength.level === 'HIGH', `Evidence strength is HIGH with verified biometrics (got: ${dl.evidenceStrength.level})`);
    assert(dl.evidenceStrength.score >= 0.75, `Evidence strength score is >= 0.75 (got: ${dl.evidenceStrength.score})`);
    assert(dl.evidenceStrength.hasWearableTelemetry === true, 'Evidence strength flags hasWearableTelemetry = true');
    assert(dl.evidenceStrength.sourcesCount === 5, 'All 5 authorized sources present in evidence');

    // Pillar 3: Main Contributors
    assert(Array.isArray(dl.mainContributors), 'Pillar 3: mainContributors is an array');
    assert(dl.mainContributors.length >= 10, `Main contributors count is >= 10 (got: ${dl.mainContributors.length})`);
    const topContributor = dl.mainContributors[0];
    assert(topContributor.title !== undefined, `Top contributor identified: ${topContributor.title}`);
    assert(topContributor.impactLevel === 'HIGH', `Top contributor impact level is HIGH (got: ${topContributor.impactLevel})`);
    assert(topContributor.category !== undefined, `Top contributor categorized: ${topContributor.category}`);

    // Pillar 4: Human Welfare Review
    assert(dl.humanWelfareReview !== undefined, 'Pillar 4: humanWelfareReview is defined');
    assert(dl.humanWelfareReview.requiresHumanReview === true, 'Human welfare review is required');
    assert(['CRITICAL', 'HIGH'].includes(dl.humanWelfareReview.priority), `Review priority is HIGH or CRITICAL (got: ${dl.humanWelfareReview.priority})`);
    assert(dl.humanWelfareReview.reviewTriggers.length >= 2, `Review triggers populated (count: ${dl.humanWelfareReview.reviewTriggers.length})`);
    assert(dl.humanWelfareReview.recommendedOfficerAction.length > 20, 'Recommended officer action provides tailored guidelines');
    assert(dl.humanWelfareReview.status === 'PENDING_REVIEW', 'Human welfare review status is PENDING_REVIEW');
  } catch (err) {
    assert(false, `Failed in Step 2: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 3: Fallback Pathway (Model 2 -> Decision Layer)
  // -------------------------------------------------------------
  console.log('\n[Step 3] Testing Fallback Pathway (Zero Wearable Biometrics) through Decision Layer...');
  try {
    const fallbackInput = {
      workload_hours: 50.0,
      work_pressure_rating: 6.0,
      recovery_sleep_hours: 6.5,
      shift_continuity_days: 3.0,
      prolonged_duty_hours: 8.0,
      night_duty_hours: 4.0,
      duty_type: 'Standard Administration & Logistics',
      deploymentZone: 'Base Headquarters',
      social_support_rating: 7.0,
      pss_score: 14.0
      // Zero sensor data provided
    };

    const res = await fetch(`${ML_SERVICE_URL}/predict/model2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fallbackInput)
    });
    const json = await res.json();
    assert(json.success === true, 'Model 2 inference request succeeds');
    const dl = json.data.decisionLayer;

    assert(dl !== undefined, 'Model 2 response contains decisionLayer');
    assert(dl.welfareConcern.modelUsed === 'MODEL_2_PSS_OPERATIONAL', `Model used indicates Model 2: ${dl.welfareConcern.modelUsed}`);
    assert(dl.evidenceStrength.hasWearableTelemetry === false, 'Evidence strength hasWearableTelemetry is false');
    assert(dl.evidenceStrength.level === 'MODERATE', `Evidence strength is MODERATE without biometrics (got: ${dl.evidenceStrength.level})`);
    assert(dl.evidenceStrength.sourcesCount === 4, `Active sources count is 4 (got: ${dl.evidenceStrength.sourcesCount})`);
  } catch (err) {
    assert(false, `Failed in Step 3: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 4: Low Strain Checkin -> Standard Monitoring
  // -------------------------------------------------------------
  console.log('\n[Step 4] Testing Low Strain Check-in -> Standard Monitoring (No Review Required)...');
  try {
    const lowStrainInput = {
      workload_hours: 38.0,
      work_pressure_rating: 3.0,
      recovery_sleep_hours: 8.0,
      shift_continuity_days: 1.0,
      prolonged_duty_hours: 4.0,
      night_duty_hours: 0.0,
      duty_type: 'Scheduled Maintenance',
      deploymentZone: 'Peace Station Base',
      social_support_rating: 9.0,
      pss_score: 8.0,
      resting_heart_rate: 62.0,
      hrv_ms: 68.0,
      respiration_rate: 14.0,
      skin_temperature_c: 36.6,
      fatigue_physical_strain: 18.0,
      wearable_synced: true
    };

    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lowStrainInput)
    });
    const json = await res.json();
    const dl = json.data.decisionLayer;

    assert(dl.welfareConcern.concernLevel === 'LOW', `Welfare concern is LOW (got: ${dl.welfareConcern.concernLevel})`);
    assert(dl.humanWelfareReview.requiresHumanReview === false, 'requiresHumanReview is false for low strain');
    assert(dl.humanWelfareReview.priority === 'STANDARD_MONITORING', `Review priority is STANDARD_MONITORING (got: ${dl.humanWelfareReview.priority})`);
    assert(dl.humanWelfareReview.status === 'MONITORING_ONLY', 'Human welfare review status is MONITORING_ONLY');
  } catch (err) {
    assert(false, `Failed in Step 4: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 5: Backend End-to-End Persistence & Officer Review Alert
  // -------------------------------------------------------------
  console.log('\n[Step 5] Testing Backend End-to-End Check-in and Officer Triage Integration...');
  try {
    // 1. Register a test personnel
    const testEmail = `welfare_decision_${Date.now()}@forces.gov.in`;
    const testPersonnelId = `PERS-DEC-${Date.now().toString().slice(-4)}`;
    const regRes = await fetch(`${BACKEND_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password@123',
        fullName: 'Subedar Decision Tester',
        personnelId: testPersonnelId,
        rank: 'Subedar',
        unit: '1st Mechanized Division',
        role: 'personnel'
      })
    });
    const regData = await regRes.json();
    assert(regRes.status === 201, 'Personnel registered successfully');
    const token = regData.token || (regData.data && regData.data.token);

    // 2. Submit high strain check-in
    const checkinRes = await fetch(`${BACKEND_URL}/api/v1/checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        workload_hours: 68.0,
        work_pressure_rating: 9.0,
        recovery_sleep_hours: 4.0,
        shift_continuity_days: 8.0,
        prolonged_duty_hours: 18.0,
        night_duty_hours: 24.0,
        duty_type: 'High Threat Coastal Watch',
        deploymentZone: 'Tactical Forward Sector',
        social_support_rating: 3.0,
        pss_score: 30.0,
        resting_heart_rate: 96.0,
        hrv_ms: 16.0,
        respiration_rate: 28.0,
        skin_temperature_c: 38.3,
        fatigue_physical_strain: 88.0,
        wearable_synced: true
      })
    });
    const checkinData = await checkinRes.json();
    assert(checkinRes.status === 201, 'Check-in processed successfully (Status 201)');
    assert(checkinData.data.decisionLayer !== undefined, 'Check-in response includes decisionLayer');
    assert(checkinData.data.prediction.decisionLayer !== undefined, 'Prediction record persisted decisionLayer');
    assert(checkinData.data.prediction.evidenceStrength === 'HIGH', 'Prediction record persisted evidenceStrength: HIGH');
    assert(checkinData.data.prediction.requiresHumanReview === true, 'Prediction record marked requiresHumanReview: true');
    assert(checkinData.data.alertGenerated === true, 'Welfare alert automatically triggered for officer review');

    // 3. Verify /api/v1/prediction/latest exposes decisionLayer
    const latestRes = await fetch(`${BACKEND_URL}/api/v1/prediction/latest`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const latestData = await latestRes.json();
    assert(latestData.success === true, 'GET /prediction/latest returns 200');
    assert(latestData.data.decisionLayer !== undefined, 'GET /prediction/latest returns decisionLayer');

    // 4. Verify /api/v1/prediction/explainability exposes decisionLayer
    const expRes = await fetch(`${BACKEND_URL}/api/v1/prediction/explainability`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const expData = await expRes.json();
    assert(expData.success === true, 'GET /prediction/explainability returns 200');
    assert(expData.data.decisionLayer !== undefined, 'GET /prediction/explainability returns decisionLayer');
    assert(expData.data.evidenceStrength !== undefined, 'GET /prediction/explainability returns evidenceStrength');

    // 5. Verify Officer Triage alerts expose decision layer details
    // Login as welfare officer
    const officerLoginRes = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'officer.welfare@crpf.gov.in',
        password: 'Password@123'
      })
    });
    const officerLogin = await officerLoginRes.json();
    assert(officerLogin.success === true, 'Welfare Officer authenticated');
    const officerToken = officerLogin.token || (officerLogin.data && officerLogin.data.token);

    const alertsRes = await fetch(`${BACKEND_URL}/api/v1/officer/alerts?status=PENDING_REVIEW`, {
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });
    const alertsData = await alertsRes.json();
    assert(alertsData.success === true, 'GET /officer/alerts returns 200');
    const createdAlert = alertsData.data.find(a => a.personnelId === testPersonnelId);
    assert(createdAlert !== undefined, `Officer triage queue contains newly created alert for ${testPersonnelId}`);
    assert(createdAlert.evidenceStrength === 'HIGH', `Alert exposes evidenceStrength: HIGH (got: ${createdAlert.evidenceStrength})`);
    assert(createdAlert.reviewTriggers.length > 0, 'Alert exposes specific reviewTriggers for human officer review');
    assert(createdAlert.recommendedOfficerAction.length > 20, 'Alert exposes recommendedOfficerAction tailored to strain');
  } catch (err) {
    assert(false, `Failed in Step 5: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 6: System Transparency Endpoint Exposes Decision Layer
  // -------------------------------------------------------------
  console.log('\n[Step 6] Verifying Backend Transparency Exposes Decision Layer Pillars...');
  try {
    const transRes = await fetch(`${BACKEND_URL}/api/v1/system/transparency`);
    const trans = await transRes.json();
    assert(trans.success === true, 'GET /system/transparency returns 200');
    assert(trans.data.decisionLayer !== undefined, 'Transparency exposes decisionLayer architecture');
    assert(trans.data.decisionLayer.name === 'WelfareAI Decision Layer', 'Decision layer name matches');
    assert(trans.data.decisionLayer.pillars.length === 4, 'All 4 decision layer pillars documented');
  } catch (err) {
    assert(false, `Failed in Step 6: ${err.message}`);
  }

  console.log('\n======================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

runTests();
