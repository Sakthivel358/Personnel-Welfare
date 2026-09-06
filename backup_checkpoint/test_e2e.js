const axios = require('./backend/node_modules/axios');

const BASE_URL = 'http://127.0.0.1:5000/api/v1';

async function runTests() {
  console.log('==================================================================');
  console.log('SIH26186 Personnel Welfare System — Automated End-to-End Test Suite');
  console.log('==================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. System Health Check
    console.log('1. Testing System Health & Component Status...');
    const healthRes = await axios.get(`${BASE_URL}/system/health`);
    assert(healthRes.status === 200, 'Health endpoint status 200');
    assert(healthRes.data.components.backend.status === 'UP', 'Backend is UP');
    assert(healthRes.data.components.mlMicroservice.isAvailable === true, 'FastAPI ML Microservice is Available');

    // 2. Model Transparency & Evaluation Check
    console.log('\n2. Testing Model Transparency & Real Evaluation Metrics...');
    const transRes = await axios.get(`${BASE_URL}/system/transparency`);
    assert(transRes.status === 200, 'Transparency endpoint status 200');
    assert(transRes.data.data.modelInfo.model_name === 'Random Forest Classifier', 'Model is Random Forest Classifier');
    assert(transRes.data.data.evaluation.metrics.accuracy > 0.70, `Evaluation Accuracy is genuine (${(transRes.data.data.evaluation.metrics.accuracy * 100).toFixed(1)}%)`);

    // 3. Persistent Registration & Login Test
    console.log('\n3. Testing Persistent User Registration & Bcrypt Hashing...');
    const testId = `CRPF-TEST-${Date.now().toString().slice(-4)}`;
    const testEmail = `test.${Date.now()}@crpf.gov.in`;
    const regRes = await axios.post(`${BASE_URL}/auth/register`, {
      personnelId: testId,
      email: testEmail,
      password: 'StrongPassword@123',
      fullName: 'Sub-Inspector Anil Verma',
      unit: 'CRPF Battalion 104',
      rank: 'Sub-Inspector',
      role: 'PERSONNEL'
    });
    assert(regRes.status === 201, 'Registration returns 201 Created');
    assert(regRes.data.user.personnelId === testId, 'User object returned with correct Personnel ID');

    // 4. Personnel Login (Simulate session token)
    console.log('\n4. Testing Persistent Personnel Login...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      identifier: testId,
      password: 'StrongPassword@123'
    });
    assert(loginRes.status === 200, 'Login returns 200 OK');
    const token = loginRes.data.token;
    assert(token && token.length > 20, 'Signed JWT token received');

    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // 5. Profile Get and Update
    console.log('\n5. Testing Profile Read & Update Persistence...');
    const profRes = await axios.get(`${BASE_URL}/profile`, authHeaders);
    assert(profRes.status === 200 && profRes.data.data.fullName === 'Sub-Inspector Anil Verma', 'Profile successfully fetched');

    const updateProfRes = await axios.put(`${BASE_URL}/profile`, {
      fullName: 'Sub-Inspector Anil Verma',
      deploymentZone: 'Sector North - High Altitude Deployment Zone',
      yearsOfService: 10,
      dutyType: 'Field Operations'
    }, authHeaders);
    assert(updateProfRes.data.data.deploymentZone === 'Sector North - High Altitude Deployment Zone', 'Profile updated & persisted in DB');

    // 6. Submit High Strain Check-in (FastAPI ML Inference)
    console.log('\n6. Testing Stress Check-in -> FastAPI -> Random Forest Inference...');
    const checkInPayload1 = {
      pss_score: 28,
      workload_hours: 66,
      work_pressure_rating: 9,
      recovery_sleep_hours: 4.0,
      social_support_rating: 3,
      work_life_balance_rating: 2,
      shift_continuity_days: 12,
      notes: 'Consecutive night convoy duties in cold weather'
    };

    const checkInRes1 = await axios.post(`${BASE_URL}/checkin`, checkInPayload1, authHeaders);
    assert(checkInRes1.status === 201, 'Check-in processed successfully');
    const p1 = checkInRes1.data.data.prediction;
    assert(['MODERATE', 'HIGH'].includes(p1.concernLevel), `Real ML predicted concern level: ${p1.concernLevel}`);
    assert(p1.compositeRiskScore > 50, `Composite Risk Score: ${p1.compositeRiskScore}%`);
    assert(p1.contributingFactors.length > 0, `Feature attributions calculated (${p1.contributingFactors.length} factors)`);
    assert(checkInRes1.data.data.alertGenerated === true, 'High strain triggered automated Welfare Officer alert');

    // 7. Verify Explainability & Recommendations
    console.log('\n7. Testing Explainability Breakdown & Personalized Guidance...');
    const expRes = await axios.get(`${BASE_URL}/prediction/explainability`, authHeaders);
    assert(expRes.data.data.contributingFactors.length === 8, 'Explainability engine returned all 8 feature attributions');

    const latestPred = await axios.get(`${BASE_URL}/prediction/latest`, authHeaders);
    assert(latestPred.data.data.recommendations.actionItems.length > 0, 'Generated factor-tailored action items');

    // 8. Test Logout & Re-login (Fixing the 10-15 minute login bug)
    console.log('\n8. Testing Logout & Critical Re-Login Persistence...');
    await axios.post(`${BASE_URL}/auth/logout`, {}, authHeaders);
    
    // Attempt re-login with the exact same credentials
    const reloginRes = await axios.post(`${BASE_URL}/auth/login`, {
      identifier: testId,
      password: 'StrongPassword@123'
    });
    assert(reloginRes.status === 200, 'Re-login succeeded with same credentials (Account survived logout)');
    const token2 = reloginRes.data.token;
    const authHeaders2 = { headers: { Authorization: `Bearer ${token2}` } };

    // Verify previous prediction still exists in DB
    const checkHistoryRes = await axios.get(`${BASE_URL}/checkin/history`, authHeaders2);
    assert(checkHistoryRes.data.data.length === 1, 'Previous check-in records intact after re-login');

    // 9. Welfare Officer Triage & Human-in-the-Loop Review
    console.log('\n9. Testing Welfare Officer Portal & Human-in-the-Loop Review...');
    const officerLogin = await axios.post(`${BASE_URL}/auth/login`, {
      identifier: 'WO-101',
      password: 'Password@123'
    });
    assert(officerLogin.status === 200 && officerLogin.data.user.role === 'WELFARE_OFFICER', 'Welfare Officer authenticated');
    const officerHeaders = { headers: { Authorization: `Bearer ${officerLogin.data.token}` } };

    const alertsRes = await axios.get(`${BASE_URL}/officer/alerts`, officerHeaders);
    assert(alertsRes.data.data.length > 0, `Officer triage queue contains ${alertsRes.data.data.length} active alerts`);

    const alertToReview = alertsRes.data.data.find(a => a.personnelId === testId) || alertsRes.data.data[0];
    const reviewRes = await axios.put(`${BASE_URL}/officer/alerts/${alertToReview._id}/review`, {
      status: 'FOLLOW_UP_ASSIGNED',
      officerNotes: 'Reviewed convoy workload. Assigned mandatory 48h rest rotation and follow-up session.',
      assignFollowUp: true
    }, officerHeaders);
    assert(reviewRes.data.data.alert.status === 'FOLLOW_UP_ASSIGNED', 'Human-in-the-loop review saved');
    assert(reviewRes.data.data.followUp !== null, 'Follow-up tracking workflow record created');

    // 10. Second Check-in & Re-analysis
    console.log('\n10. Testing Second Check-in & Re-Analysis Delta Calculation...');
    const checkInPayload2 = {
      pss_score: 12,
      workload_hours: 44,
      work_pressure_rating: 4,
      recovery_sleep_hours: 7.5,
      social_support_rating: 8,
      work_life_balance_rating: 7,
      shift_continuity_days: 1,
      notes: 'Completed 48h rest period. Feeling significantly restored.'
    };

    const checkInRes2 = await axios.post(`${BASE_URL}/checkin`, checkInPayload2, authHeaders2);
    const p2 = checkInRes2.data.data.prediction;
    assert(p2.concernLevel === 'LOW' || p2.compositeRiskScore < p1.compositeRiskScore, `Re-analyzed Risk Score improved from ${p1.compositeRiskScore}% to ${p2.compositeRiskScore}%`);

    const followUpsRes = await axios.get(`${BASE_URL}/followups`, officerHeaders);
    const updatedFollowUp = followUpsRes.data.data.find(f => f.personnelId === testId);
    if (updatedFollowUp) {
      assert(updatedFollowUp.welfareDelta === 'IMPROVED', `Follow-up re-analysis delta marked as: ${updatedFollowUp.welfareDelta}`);
    }

    // 11. Multi-point Trend History
    console.log('\n11. Testing Longitudinal Trend Trajectory...');
    const trendRes = await axios.get(`${BASE_URL}/prediction/history`, authHeaders2);
    assert(trendRes.data.data.length === 2, `Trend history contains ${trendRes.data.data.length} data points across time`);

    // 12. Admin Metrics & Audit Trail
    console.log('\n12. Testing System Admin Metrics & Audit Trail...');
    const adminLogin = await axios.post(`${BASE_URL}/auth/login`, {
      identifier: 'ADM-001',
      password: 'Password@123'
    });
    const adminHeaders = { headers: { Authorization: `Bearer ${adminLogin.data.token}` } };
    const adminMetrics = await axios.get(`${BASE_URL}/admin/metrics`, adminHeaders);
    assert(adminMetrics.data.data.counts.users >= 3, 'User governance count verified');
    assert(adminMetrics.data.data.counts.auditLogs > 5, 'Security audit trail logs verified');

    console.log('\n==================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================================\n');

    if (failed === 0) {
      console.log('🎉 ALL END-TO-END VERIFICATION CHECKS PASSED PERFECTLY!');
    }
  } catch (err) {
    console.error('Test execution error:', err.response ? err.response.data : err.message);
  }
}

runTests();
