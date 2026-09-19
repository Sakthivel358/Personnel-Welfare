/**
 * test_ml_explainability_evaluation_synthetic_transparency.js
 * Comprehensive automated test suite verifying Tasks 28, 29, & 30:
 * - Task 28: ML Explainability (contributing indicators, non-medical diagnosis statement)
 * - Task 29: ML Evaluation (authentic Random Forest train/test validation, precision, recall, macro-F1, confusion matrix)
 * - Task 30: Synthetic Dataset Transparency (labeled as synthetic prototype training data, not real-world validated)
 */

const http = require('http');

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
  console.log('STARTING TASKS 28, 29 & 30 VERIFICATION SUITE');
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
  const medicalStatement = "The model identifies welfare-risk patterns/concerns, not a medical diagnosis.";

  // -------------------------------------------------------------
  // Test Suite 1: Task 29 - ML Evaluation (FastAPI /evaluation endpoints)
  // -------------------------------------------------------------
  console.log('--- Test Suite 1: Task 29 - ML Evaluation & Honest Metrics ---');
  
  // Model 1 Evaluation
  const m1EvalRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/evaluation/model1',
    method: 'GET'
  });

  assert(m1EvalRes.status === 200, 'FastAPI GET /evaluation/model1 returned 200 OK');
  const m1Data = m1EvalRes.body;
  assert(m1Data.status === 'success', 'Model 1 evaluation status is success');
  assert(typeof m1Data.accuracy === 'number' && m1Data.accuracy >= 0.70 && m1Data.accuracy <= 0.90, 
    `Model 1 evaluation accuracy is authentic (${m1Data.accuracy}) - not artificially inflated`);
  assert(typeof m1Data.precision_macro === 'number' && m1Data.precision_macro > 0.70, 
    `Model 1 macro-precision evaluated: ${m1Data.precision_macro}`);
  assert(typeof m1Data.recall_macro === 'number' && m1Data.recall_macro > 0.70, 
    `Model 1 macro-recall evaluated: ${m1Data.recall_macro}`);
  assert(typeof m1Data.f1_macro === 'number' && m1Data.f1_macro > 0.70, 
    `Model 1 macro-F1 evaluated: ${m1Data.f1_macro}`);
  const m1Matrix = Array.isArray(m1Data.confusion_matrix) ? m1Data.confusion_matrix : (m1Data.confusion_matrix?.matrix || m1Data.matrix || []);
  assert(Array.isArray(m1Matrix) && m1Matrix.length === 3, 
    'Model 1 includes 3x3 confusion matrix for Low/Moderate/High classes');
  assert(m1Data.per_class && m1Data.per_class.LOW && m1Data.per_class.HIGH, 
    'Model 1 provides per-class precision, recall, and f1-scores');
  assert(m1Data.train_samples === 2800 && m1Data.test_samples === 700, 
    'Model 1 used valid 80/20 train/test split validation (2800 train, 700 test)');

  // Model 2 Evaluation
  const m2EvalRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/evaluation/model2',
    method: 'GET'
  });

  assert(m2EvalRes.status === 200, 'FastAPI GET /evaluation/model2 returned 200 OK');
  const m2Data = m2EvalRes.body;
  assert(m2Data.status === 'success', 'Model 2 evaluation status is success');
  assert(typeof m2Data.accuracy === 'number' && m2Data.accuracy >= 0.70 && m2Data.accuracy <= 0.90, 
    `Model 2 evaluation accuracy is authentic (${m2Data.accuracy}) - not artificially inflated`);
  assert(typeof m2Data.precision_macro === 'number' && m2Data.precision_macro > 0.70, 
    `Model 2 macro-precision evaluated: ${m2Data.precision_macro}`);
  assert(typeof m2Data.recall_macro === 'number' && m2Data.recall_macro > 0.70, 
    `Model 2 macro-recall evaluated: ${m2Data.recall_macro}`);
  assert(typeof m2Data.f1_macro === 'number' && m2Data.f1_macro > 0.70, 
    `Model 2 macro-F1 evaluated: ${m2Data.f1_macro}`);
  const m2Matrix = Array.isArray(m2Data.confusion_matrix) ? m2Data.confusion_matrix : (m2Data.confusion_matrix?.matrix || m2Data.matrix || []);
  assert(Array.isArray(m2Matrix) && m2Matrix.length === 3, 
    'Model 2 includes 3x3 confusion matrix for Low/Moderate/High classes');
  assert(m2Data.train_samples === 2800 && m2Data.test_samples === 700, 
    'Model 2 used valid 80/20 train/test split validation (2800 train, 700 test)');

  // -------------------------------------------------------------
  // Test Suite 2: Task 30 - Synthetic Dataset Transparency
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 2: Task 30 - Synthetic Dataset Transparency ---');

  // Verify Model 1 Evaluation Transparency fields
  assert(m1Data.dataset_label === 'Synthetic Prototype Training Data', 
    'Model 1 dataset_label is explicitly "Synthetic Prototype Training Data"');
  assert(m1Data.dataset_type === 'SYNTHETIC_PROTOTYPE_TRAINING_DATA', 
    'Model 1 dataset_type is "SYNTHETIC_PROTOTYPE_TRAINING_DATA"');
  assert(m1Data.real_world_validated_accuracy === false, 
    'Model 1 real_world_validated_accuracy is false (not presented as real-world validated)');
  assert(typeof m1Data.prototype_accuracy_notice === 'string' && m1Data.prototype_accuracy_notice.includes('prototype'), 
    'Model 1 contains prototype accuracy notice disclaimer');

  // Verify Model 2 Evaluation Transparency fields
  assert(m2Data.dataset_label === 'Synthetic Prototype Training Data', 
    'Model 2 dataset_label is explicitly "Synthetic Prototype Training Data"');
  assert(m2Data.real_world_validated_accuracy === false, 
    'Model 2 real_world_validated_accuracy is false');
  assert(typeof m2Data.prototype_accuracy_notice === 'string', 
    'Model 2 contains prototype accuracy notice disclaimer');

  // Verify Backend System Transparency Endpoint
  const sysTransparencyRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/system/transparency',
    method: 'GET'
  });
  assert(sysTransparencyRes.status === 200, 'Backend GET /api/v1/system/transparency returned 200 OK');
  const sysTransparency = sysTransparencyRes.body.data;
  assert(sysTransparency.dataset_label === 'Synthetic Prototype Training Data', 
    'System transparency dataset_label is "Synthetic Prototype Training Data"');
  assert(sysTransparency.dataset_type === 'SYNTHETIC_PROTOTYPE_TRAINING_DATA', 
    'System transparency dataset_type is "SYNTHETIC_PROTOTYPE_TRAINING_DATA"');
  assert(sysTransparency.real_world_validated_accuracy === false, 
    'System transparency real_world_validated_accuracy is false');
  assert(sysTransparency.prototype_accuracy_notice.includes('Prototype evaluation accuracy is derived from synthetic prototype training data'), 
    'System transparency includes prototype accuracy notice');
  assert(sysTransparency.statement === medicalStatement, 
    'System transparency declares: "The model identifies welfare-risk patterns/concerns, not a medical diagnosis."');
  assert(sysTransparency.models && (sysTransparency.models.model1?.info?.dataset_label === 'Synthetic Prototype Training Data' || sysTransparency.models.model1?.evaluation?.dataset_label === 'Synthetic Prototype Training Data'),
    'System transparency model1 includes dataset_label');
  assert(sysTransparency.models && (sysTransparency.models.model2?.info?.real_world_validated_accuracy === false || sysTransparency.models.model2?.evaluation?.real_world_validated_accuracy === false),
    'System transparency model2 includes real_world_validated_accuracy = false');

  // -------------------------------------------------------------
  // Test Suite 3: Task 28 - ML Explainability & Non-Medical Diagnosis Statement
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 3: Task 28 - ML Explainability & Medical Non-Diagnosis Statement ---');

  // Create test user and check-in
  const testUserEmail = `explain_test_${timestamp}@defence.gov.in`;
  const regRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    fullName: 'Subedar Explainability Spec',
    personnelId: `EXP${timestamp.toString().slice(-6)}`,
    rank: 'Subedar',
    unit: '15 Kumaon',
    role: 'personnel',
    email: testUserEmail,
    password: 'Password@123'
  });

  assert(regRes.status === 201, 'Test user registered successfully');
  const authToken = regRes.body.token || (regRes.body.data && regRes.body.data.token);
  assert(!!authToken, 'Auth token acquired');
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  };

  // Perform a check-in with high workload to produce understandable contributing indicators
  const checkinRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: authHeaders
  }, {
    pss_score: 30,
    workload_hours: 68,
    recovery_sleep_hours: 4.0,
    duty_type: 'HIGH_ALTITUDE_PATROL',
    work_pressure_rating: 9,
    night_duty_hours: 9.0,
    prolonged_duty_hours: 12.0,
    shift_continuity_days: 6,
    social_support_rating: 2,
    work_life_balance_rating: 2,
    fatigue_physical_strain: 75,
    resting_heart_rate: 88,
    hrv_ms: 32,
    respiration_rate: 20,
    skin_temperature_c: 37.8,
    wearable_synced: true
  });

  assert(checkinRes.status === 201, 'Check-in submitted successfully');
  const checkinData = checkinRes.body.data;
  assert(checkinData.prediction.statement === medicalStatement, 
    'Checkin response contains exact statement: "The model identifies welfare-risk patterns/concerns, not a medical diagnosis."');
  assert(checkinData.prediction.medicalDisclaimer === medicalStatement, 
    'Checkin response contains matching medicalDisclaimer');
  assert(checkinData.prediction.notMedicalDiagnosis === true, 
    'Checkin response contains notMedicalDiagnosis: true');
  assert(checkinData.prediction.datasetLabel === 'Synthetic Prototype Training Data', 
    'Checkin response contains datasetLabel: "Synthetic Prototype Training Data"');
  assert(checkinData.prediction.realWorldValidatedAccuracy === false, 
    'Checkin response contains realWorldValidatedAccuracy: false');

  // Verify GET /api/v1/prediction/latest
  const latestPredRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/latest',
    method: 'GET',
    headers: authHeaders
  });

  assert(latestPredRes.status === 200, 'GET /api/v1/prediction/latest returned 200 OK');
  const latestPred = latestPredRes.body.data;
  assert(latestPred.statement === medicalStatement, 
    'Latest prediction endpoint contains medical non-diagnosis statement');
  assert(latestPred.medicalDisclaimer === medicalStatement, 
    'Latest prediction endpoint contains medicalDisclaimer');
  assert(latestPred.notMedicalDiagnosis === true, 
    'Latest prediction endpoint contains notMedicalDiagnosis: true');
  assert(latestPred.datasetLabel === 'Synthetic Prototype Training Data', 
    'Latest prediction endpoint contains datasetLabel');
  assert(latestPred.realWorldValidatedAccuracy === false, 
    'Latest prediction endpoint contains realWorldValidatedAccuracy: false');
  assert(latestPred.prototypeAccuracyNotice.includes('Prototype evaluation accuracy is derived from synthetic prototype training data'), 
    'Latest prediction endpoint contains prototypeAccuracyNotice');

  // Verify Understandable Contributing Indicators
  assert(Array.isArray(latestPred.mainContributors) && latestPred.mainContributors.length > 0, 
    'Latest prediction contains understandable mainContributors array');
  const topContributor = latestPred.mainContributors[0];
  const contributorLabel = topContributor.directionalTitle || topContributor.title || topContributor.factor;
  assert(typeof contributorLabel === 'string' && contributorLabel.length > 0, 
    `Contributor factor clearly labeled: "${contributorLabel}"`);
  assert(typeof topContributor.direction === 'string' && ['UP', 'DOWN', 'STABLE'].includes(topContributor.direction), 
    `Contributor direction provided: "${topContributor.direction}"`);
  const contributorImpact = topContributor.impactLevel || topContributor.impact;
  assert(typeof contributorImpact === 'string', 
    `Contributor impact evaluated: "${contributorImpact}"`);

  // Verify GET /api/v1/prediction/explainability
  const explainRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/prediction/explainability',
    method: 'GET',
    headers: authHeaders
  });

  assert(explainRes.status === 200, 'GET /api/v1/prediction/explainability returned 200 OK');
  const explainData = explainRes.body.data;
  assert(explainData.statement === medicalStatement, 
    'Explainability endpoint contains statement');
  assert(explainData.medicalDisclaimer === medicalStatement, 
    'Explainability endpoint contains medicalDisclaimer');
  assert(explainData.notMedicalDiagnosis === true, 
    'Explainability endpoint contains notMedicalDiagnosis: true');
  assert(explainData.datasetLabel === 'Synthetic Prototype Training Data', 
    'Explainability endpoint contains datasetLabel');
  assert(explainData.realWorldValidatedAccuracy === false, 
    'Explainability endpoint contains realWorldValidatedAccuracy: false');
  assert(Array.isArray(explainData.contributingIndicators) && explainData.contributingIndicators.length > 0, 
    'Explainability endpoint provides understandable contributingIndicators');

  // -------------------------------------------------------------
  // Test Suite 4: Decision Layer & FastAPI Direct Endpoint Transparency
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 4: Direct FastAPI Endpoints & Decision Layer ---');

  const fastApiInfoRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/model1-info',
    method: 'GET'
  });
  assert(fastApiInfoRes.status === 200, 'FastAPI GET /model1-info returned 200 OK');
  assert(fastApiInfoRes.body.statement === medicalStatement, 'FastAPI /model1-info includes statement');
  assert(fastApiInfoRes.body.dataset_label === 'Synthetic Prototype Training Data', 
    'FastAPI /model1-info includes dataset_label');
  assert(fastApiInfoRes.body.real_world_validated_accuracy === false, 
    'FastAPI /model1-info includes real_world_validated_accuracy: false');

  const fastApiDecLayerRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/decision-layer/info',
    method: 'GET'
  });
  assert(fastApiDecLayerRes.status === 200, 'FastAPI GET /decision-layer/info returned 200 OK');
  assert(fastApiDecLayerRes.body.statement === medicalStatement, 'FastAPI /decision-layer/info includes statement');
  assert(fastApiDecLayerRes.body.dataset_label === 'Synthetic Prototype Training Data', 
    'FastAPI /decision-layer/info includes dataset_label');

  // -------------------------------------------------------------
  // Test Suite 5: Frontend Template Verification
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 5: Frontend Template Statements ---');

  const whyResultHtml = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/why-result.html',
    method: 'GET'
  });
  assert(whyResultHtml.status === 200, 'GET /why-result.html returned 200 OK');
  assert(whyResultHtml.body.includes(medicalStatement), 
    'why-result.html contains exact medical non-diagnosis statement');
  assert(whyResultHtml.body.includes('Synthetic Prototype Training Data'), 
    'why-result.html displays Synthetic Prototype Training Data badge');

  const aiAnalysisHtml = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/ai-analysis.html',
    method: 'GET'
  });
  assert(aiAnalysisHtml.status === 200, 'GET /ai-analysis.html returned 200 OK');
  assert(aiAnalysisHtml.body.includes(medicalStatement), 
    'ai-analysis.html contains exact medical non-diagnosis statement');
  assert(aiAnalysisHtml.body.includes('Synthetic Prototype Training Data'), 
    'ai-analysis.html displays Synthetic Prototype Training Data badge');

  const dashboardHtml = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/dashboard.html',
    method: 'GET'
  });
  assert(dashboardHtml.status === 200, 'GET /dashboard.html returned 200 OK');
  assert(dashboardHtml.body.includes(medicalStatement), 
    'dashboard.html contains exact medical non-diagnosis statement');

  console.log('\n==================================================================');
  console.log(`TEST RESULTS: ${passed} / ${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
  console.log('==================================================================');

  if (passed === total) {
    console.log('\n🎯 ALL TASKS 28, 29 & 30 REQUIREMENTS VERIFIED SUCCESSFULLY!\n');
    process.exit(0);
  } else {
    console.error(`\n❌ ${total - passed} assertions failed.\n`);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
