/**
 * test_model_selection_logic.js
 * Verification test suite for Task 21: Model Selection Logic
 *
 * Requirements:
 * 1. Wearable + operational data available -> Model 1
 * 2. No wearable, but PSS-10 + operational data available -> Model 2
 * 3. Both wearable and PSS available -> use available evidence from both models through the decision layer
 * 4. Insufficient evidence -> UNDETERMINED
 * 5. Never guess a welfare concern when evidence is insufficient.
 */

const ML_SERVICE_URL = 'http://127.0.0.1:8000';
const BACKEND_URL = 'http://127.0.0.1:5000';

async function runTests() {
  console.log('======================================================================');
  console.log('🧪 VERIFYING TASK 21: MODEL SELECTION LOGIC & SUFFICIENCY GATE');
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
  // Test 1: Pathway 1 — Wearable + Operational Data (No PSS) -> Model 1
  // -------------------------------------------------------------
  console.log('[Pathway 1] Testing Wearable + Operational data available (no PSS)...');
  try {
    const inputP1 = {
      workload_hours: 55.0,
      work_pressure_rating: 7.5,
      recovery_sleep_hours: 5.5,
      shift_continuity_days: 5.0,
      prolonged_duty_hours: 12.0,
      night_duty_hours: 14.0,
      duty_type: 'Active Patrol Watch',
      deploymentZone: 'Field Deployment Sector',
      social_support_rating: 6.0,
      resting_heart_rate: 82.0,
      hrv_ms: 32.0,
      respiration_rate: 20.0,
      skin_temperature_c: 37.4,
      fatigue_physical_strain: 58.0,
      wearable_synced: true,
      pss_score: null // No PSS self-check
    };

    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputP1)
    });
    const json = await res.json();
    assert(json.success === true, 'Pathway 1 inference succeeds');
    const data = json.data;

    assert(data.modelUsed === 'MODEL_1_WEARABLE_OPERATIONAL', `Pathway 1 routes to Model 1: got ${data.modelUsed}`);
    assert(data.concernLevel !== 'UNDETERMINED', `Concern level is evaluated: ${data.concernLevel}`);
    assert(data.compositeRiskScore !== null && data.compositeRiskScore > 0, `Composite risk score is computed: ${data.compositeRiskScore}%`);
    assert(data.evidenceSources.includes('WEARABLE'), 'Evidence sources includes WEARABLE');
    assert(!data.evidenceSources.includes('SELF_CHECK'), 'Evidence sources strictly excludes SELF_CHECK');
  } catch (err) {
    assert(false, `Failed in Pathway 1: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 2: Pathway 2 — No Wearable, but PSS-10 + Operational -> Model 2
  // -------------------------------------------------------------
  console.log('\n[Pathway 2] Testing No Wearable, but PSS-10 + Operational data available...');
  try {
    const inputP2 = {
      workload_hours: 54.0,
      work_pressure_rating: 7.0,
      recovery_sleep_hours: 5.5,
      shift_continuity_days: 4.0,
      prolonged_duty_hours: 10.0,
      night_duty_hours: 12.0,
      duty_type: 'Static Facility Watch',
      deploymentZone: 'Base Sector',
      social_support_rating: 5.5,
      pss_score: 22.0
      // Zero wearable biometrics provided
    };

    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputP2)
    });
    const json = await res.json();
    assert(json.success === true, 'Pathway 2 inference succeeds');
    const data = json.data;

    assert(data.modelUsed === 'MODEL_2_PSS_OPERATIONAL', `Pathway 2 routes to Model 2: got ${data.modelUsed}`);
    assert(data.concernLevel !== 'UNDETERMINED', `Concern level is evaluated: ${data.concernLevel}`);
    assert(data.compositeRiskScore !== null && data.compositeRiskScore > 0, `Composite risk score is computed: ${data.compositeRiskScore}%`);
    assert(!data.evidenceSources.includes('WEARABLE'), 'Evidence sources strictly excludes WEARABLE');
    assert(data.evidenceSources.includes('SELF_CHECK'), 'Evidence sources includes SELF_CHECK');
  } catch (err) {
    assert(false, `Failed in Pathway 2: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 3: Pathway 3 — Both Wearable and PSS Available -> Decision Layer Consensus
  // -------------------------------------------------------------
  console.log('\n[Pathway 3] Testing Both Wearable and PSS-10 available (Dual Model Evidence)...');
  try {
    const inputP3 = {
      workload_hours: 60.0,
      work_pressure_rating: 8.0,
      recovery_sleep_hours: 5.0,
      shift_continuity_days: 6.0,
      prolonged_duty_hours: 14.0,
      night_duty_hours: 18.0,
      duty_type: 'Forward Surveillance',
      deploymentZone: 'Northern High Altitude Sector',
      social_support_rating: 4.0,
      pss_score: 26.0,
      resting_heart_rate: 88.0,
      hrv_ms: 24.0,
      respiration_rate: 22.0,
      skin_temperature_c: 37.6,
      fatigue_physical_strain: 72.0,
      wearable_synced: true
    };

    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputP3)
    });
    const json = await res.json();
    assert(json.success === true, 'Pathway 3 inference succeeds');
    const data = json.data;

    assert(data.modelUsed === 'DUAL_MODEL_CONSENSUS', `Pathway 3 routes to DUAL_MODEL_CONSENSUS: got ${data.modelUsed}`);
    assert(Array.isArray(data.modelsEvaluated), 'modelsEvaluated is an array');
    assert(data.modelsEvaluated.includes('MODEL_1_WEARABLE_OPERATIONAL'), 'Evaluated Model 1');
    assert(data.modelsEvaluated.includes('MODEL_2_PSS_OPERATIONAL'), 'Evaluated Model 2');
    assert(data.evidenceSources.includes('WEARABLE'), 'Evidence includes WEARABLE');
    assert(data.evidenceSources.includes('SELF_CHECK'), 'Evidence includes SELF_CHECK');
    assert(data.evidenceStrength === 'HIGH', 'Evidence strength is HIGH with dual evidence');
    assert(data.decisionLayer.welfareConcern.modelUsed === 'DUAL_MODEL_CONSENSUS', 'Decision layer confirms consensus model');
  } catch (err) {
    assert(false, `Failed in Pathway 3: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 4: Pathway 4 — Insufficient Evidence -> UNDETERMINED
  // -------------------------------------------------------------
  console.log('\n[Pathway 4] Testing Insufficient Evidence (No Wearable AND No PSS)...');
  try {
    // Only operational duty inputs, with NO wearable and NO PSS
    const inputP4 = {
      workload_hours: 50.0,
      work_pressure_rating: 6.0,
      recovery_sleep_hours: 7.0,
      shift_continuity_days: 3.0,
      prolonged_duty_hours: 8.0,
      night_duty_hours: 4.0,
      duty_type: 'General Logistics',
      deploymentZone: 'Base Depot',
      social_support_rating: 6.0,
      pss_score: null,
      wearable_synced: false
      // resting_heart_rate, hrv_ms, etc. all omitted
    };

    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputP4)
    });
    const json = await res.json();
    assert(json.success === true, 'Request processed without error');
    const data = json.data;

    assert(data.concernLevel === 'UNDETERMINED', `Concern level is strictly UNDETERMINED (got: ${data.concernLevel})`);
    assert(data.compositeRiskScore === null, `Composite risk score is strictly null (zero guessing) (got: ${data.compositeRiskScore})`);
    assert(data.isUndetermined === true, 'isUndetermined flag is true');
    assert(data.evidenceStrength === 'INSUFFICIENT', `Evidence strength is INSUFFICIENT (got: ${data.evidenceStrength})`);
    assert(data.requiresHumanReview === false, 'Zero false alarm officer review triggered');
    assert(data.disclaimer.includes('Never guess a welfare concern when evidence is insufficient'), 'Explicit non-guessing disclaimer present');
  } catch (err) {
    assert(false, `Failed in Pathway 4: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 5: Pathway 5 — Missing Operational Data -> UNDETERMINED
  // -------------------------------------------------------------
  console.log('\n[Pathway 5] Testing Empty / Missing Operational Data -> UNDETERMINED...');
  try {
    const emptyInput = {};

    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emptyInput)
    });
    const json = await res.json();
    assert(json.success === true, 'Empty check-in processed without error');
    const data = json.data;

    assert(data.concernLevel === 'UNDETERMINED', `Empty input yields UNDETERMINED (got: ${data.concernLevel})`);
    assert(data.compositeRiskScore === null, 'Composite risk score is strictly null');
    assert(data.isUndetermined === true, 'isUndetermined flag is true');
  } catch (err) {
    assert(false, `Failed in Pathway 5: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 6: Backend Check-in End-to-End with Model Selection & Undetermined Safety
  // -------------------------------------------------------------
  console.log('\n[Pathway 6] Testing Backend End-to-End Integration Across Pathways...');
  try {
    // 1. Register test personnel
    const testEmail = `model_select_${Date.now()}@forces.gov.in`;
    const testPersonnelId = `PERS-SEL-${Date.now().toString().slice(-4)}`;
    const regRes = await fetch(`${BACKEND_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password@123',
        fullName: 'Naik Selection Tester',
        personnelId: testPersonnelId,
        rank: 'Naik',
        unit: 'Signals Corps',
        role: 'personnel'
      })
    });
    const regData = await regRes.json();
    const token = regData.token || (regData.data && regData.data.token);
    assert(regRes.status === 201, 'Test personnel registered');

    // 2. Check-in with insufficient evidence (NO wearable AND NO PSS)
    const checkinUndetermined = await fetch(`${BACKEND_URL}/api/v1/checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        workload_hours: 45.0,
        work_pressure_rating: 5.0,
        recovery_sleep_hours: 7.0,
        shift_continuity_days: 2.0,
        pss_score: null,
        wearable_synced: false
        // Zero sensor data
      })
    });
    const undetData = await checkinUndetermined.json();
    assert(checkinUndetermined.status === 201, 'Insufficient evidence check-in saved');
    assert(undetData.data.prediction.concernLevel === 'UNDETERMINED', 'Database persisted concernLevel: UNDETERMINED');
    assert(undetData.data.prediction.compositeRiskScore === null, 'Database persisted compositeRiskScore: null');
    assert(undetData.data.prediction.isUndetermined === true, 'Database persisted isUndetermined: true');
    assert(undetData.data.alertGenerated === false, 'Zero false alarm alert generated for UNDETERMINED');
    assert(undetData.data.recommendations.primaryAction.includes('insufficient'), 'Recommendation advises providing evidence without guessing');

    // 3. Check-in with Both Wearable + PSS (Dual-Model consensus)
    const checkinDual = await fetch(`${BACKEND_URL}/api/v1/checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        workload_hours: 58.0,
        work_pressure_rating: 8.0,
        recovery_sleep_hours: 5.0,
        shift_continuity_days: 6.0,
        pss_score: 24.0,
        resting_heart_rate: 86.0,
        hrv_ms: 28.0,
        respiration_rate: 22.0,
        skin_temperature_c: 37.5,
        fatigue_physical_strain: 70.0,
        wearable_synced: true
      })
    });
    const dualData = await checkinDual.json();
    assert(checkinDual.status === 201, 'Dual-evidence check-in saved');
    assert(dualData.data.prediction.modelUsed === 'DUAL_MODEL_CONSENSUS', `Prediction saved modelUsed: DUAL_MODEL_CONSENSUS (got: ${dualData.data.prediction.modelUsed})`);
    assert(dualData.data.prediction.concernLevel !== 'UNDETERMINED', `Concern level is evaluated: ${dualData.data.prediction.concernLevel}`);
    assert(dualData.data.prediction.compositeRiskScore !== null, `Risk score is computed: ${dualData.data.prediction.compositeRiskScore}%`);

    // 4. Check-in with Wearable only (no PSS)
    const checkinWearableOnly = await fetch(`${BACKEND_URL}/api/v1/checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        workload_hours: 50.0,
        work_pressure_rating: 6.0,
        recovery_sleep_hours: 6.5,
        shift_continuity_days: 3.0,
        pss_score: null, // PSS omitted
        resting_heart_rate: 78.0,
        hrv_ms: 45.0,
        respiration_rate: 16.0,
        skin_temperature_c: 36.8,
        fatigue_physical_strain: 40.0,
        wearable_synced: true
      })
    });
    const wearData = await checkinWearableOnly.json();
    assert(checkinWearableOnly.status === 201, 'Wearable-only check-in saved');
    assert(wearData.data.prediction.modelUsed === 'MODEL_1_WEARABLE_OPERATIONAL', `Saved modelUsed: MODEL_1_WEARABLE_OPERATIONAL (got: ${wearData.data.prediction.modelUsed})`);

    // 5. Check-in with PSS only (no wearable)
    const checkinPssOnly = await fetch(`${BACKEND_URL}/api/v1/checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        workload_hours: 50.0,
        work_pressure_rating: 6.0,
        recovery_sleep_hours: 6.5,
        shift_continuity_days: 3.0,
        pss_score: 16.0,
        wearable_synced: false
        // Wearable omitted
      })
    });
    const pssData = await checkinPssOnly.json();
    assert(checkinPssOnly.status === 201, 'PSS-only check-in saved');
    assert(pssData.data.prediction.modelUsed === 'MODEL_2_PSS_OPERATIONAL', `Saved modelUsed: MODEL_2_PSS_OPERATIONAL (got: ${pssData.data.prediction.modelUsed})`);

    // 6. Verify prediction history safely handles the null score of the undetermined checkin
    const histRes = await fetch(`${BACKEND_URL}/api/v1/prediction/history`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const histData = await histRes.json();
    assert(histData.success === true, 'GET /prediction/history returns 200');
    assert(histData.data.length === 4, `History contains 4 entries (got: ${histData.data.length})`);
    const undetHistoryEntry = histData.data.find(h => h.concernLevel === 'UNDETERMINED');
    assert(undetHistoryEntry !== undefined, 'History includes UNDETERMINED entry');
    assert(undetHistoryEntry.compositeRiskScore === null, 'History entry preserves compositeRiskScore: null');
  } catch (err) {
    assert(false, `Failed in Pathway 6: ${err.message}`);
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
