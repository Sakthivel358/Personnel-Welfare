/**
 * Comprehensive Logic & Calculation Test Suite
 * Verifies that zero-values, nulls, division-by-zero guards, and formula calculations
 * operate accurately without invented/fallback numbers.
 */

const axios = require('./backend/node_modules/axios');

const BASE_URL = 'http://127.0.0.1:5000/api/v1';

async function runLogicTests() {
  console.log('\n======================================================');
  console.log('🧪 Starting Logic & Edge-Case Verification Suite');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Authenticate as Admin
    const adminLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      identifier: 'ADM-001',
      password: 'Password@123'
    });
    const adminToken = adminLoginRes.data.token;
    const adminHeaders = { headers: { Authorization: `Bearer ${adminToken}` } };
    assert(!!adminToken, 'Admin authenticated');

    // 2. Authenticate as Welfare Officer
    const officerLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      identifier: 'WO-101',
      password: 'Password@123'
    });
    const officerToken = officerLoginRes.data.token;
    const officerHeaders = { headers: { Authorization: `Bearer ${officerToken}` } };
    assert(!!officerToken, 'Welfare Officer authenticated');

    // 3. Register a fresh test personnel to test pure 0 values
    const uniqueSuffix = Date.now().toString().slice(-4);
    const testId = `CRPF-LOGIC-${uniqueSuffix}`;
    const testEmail = `logic.test.${uniqueSuffix}@crpf.gov.in`;
    const regRes = await axios.post(`${BASE_URL}/auth/register`, {
      personnelId: testId,
      fullName: `Logic Tester ${uniqueSuffix}`,
      email: testEmail,
      password: 'Password@123',
      role: 'PERSONNEL',
      rank: 'Lance Naik',
      unit: '9 Para SF',
      deploymentZone: 'Northern Command',
      yearsOfService: 4,
      dutyType: 'Field Patrol'
    });

    const personnelToken = regRes.data.token;
    const personnelHeaders = { headers: { Authorization: `Bearer ${personnelToken}` } };
    assert(!!personnelToken, 'Fresh personnel account created for logic testing');

    // 4. Test CheckIn with PSS score = 0 (valid zero value)
    const checkin1 = await axios.post(`${BASE_URL}/checkin`, {
      pss_score: 0,
      workload_hours: 40,
      work_pressure_rating: 2,
      recovery_sleep_hours: 8,
      social_support_rating: 9,
      work_life_balance_rating: 8,
      shift_continuity_days: 0,
      notes: 'Testing zero stress and zero shift continuity'
    }, personnelHeaders);

    assert(checkin1.data.success === true, 'Check-in with PSS=0 and ShiftDays=0 succeeded');
    const pred1 = checkin1.data.data.prediction;
    assert(pred1.compositeRiskScore !== undefined && !isNaN(pred1.compositeRiskScore), 'Composite risk score is a valid number');
    assert(pred1.concernLevel === 'LOW', 'Low stress parameters produce LOW concern level');

    // 5. Test getPredictionHistory returns all necessary fields without client-side fallback
    const historyRes = await axios.get(`${BASE_URL}/prediction/history`, personnelHeaders);
    assert(historyRes.data.success === true, 'Prediction history retrieved');
    const historyItem = historyRes.data.data[0];
    assert(historyItem.pss_score === 0, `History records authentic PSS score of 0 (got: ${historyItem.pss_score})`);
    assert(historyItem.shift_continuity_days === 0, `History records authentic shift_continuity_days of 0 (got: ${historyItem.shift_continuity_days})`);
    assert(Array.isArray(historyItem.contributingFactors), 'History includes contributingFactors array from model');

    // 6. Test second check-in to verify recent_trend_indicator calculation with previous pss=0
    const checkin2 = await axios.post(`${BASE_URL}/checkin`, {
      pss_score: 12,
      workload_hours: 48,
      work_pressure_rating: 5,
      recovery_sleep_hours: 6.5,
      social_support_rating: 7,
      work_life_balance_rating: 6,
      shift_continuity_days: 2,
      notes: 'Second check-in for trend calculation'
    }, personnelHeaders);
    assert(checkin2.data.success === true, 'Second check-in recorded successfully');

    // 7. Test What-Changed comparison endpoint for edge cases
    const whatChangedRes = await axios.get(`${BASE_URL}/prediction/what-changed`, personnelHeaders);
    assert(whatChangedRes.data.success === true, 'What-Changed endpoint returned successfully');
    const metrics = whatChangedRes.data.metrics;
    assert(metrics.pss_score.previous === 0, `What-Changed correctly identified previous PSS score as 0 (got: ${metrics.pss_score.previous})`);
    assert(metrics.pss_score.diff === 12, `What-Changed correctly calculated diff as 12 (got: ${metrics.pss_score.diff})`);
    assert(!isNaN(metrics.workload_hours.diff), 'Workload delta is not NaN');
    assert(!isNaN(metrics.compositeRiskScore.diff), 'Risk score delta is not NaN');

    // 8. Test Officer Dashboard risk distribution sum matches total personnel
    const officerDashRes = await axios.get(`${BASE_URL}/officer/dashboard`, officerHeaders);
    assert(officerDashRes.data.success === true, 'Officer dashboard retrieved');
    const { totalMonitoredPersonnel, riskDistribution } = officerDashRes.data.data;
    const distSum = riskDistribution.HIGH + riskDistribution.MODERATE + riskDistribution.LOW + riskDistribution.UNASSESSED;
    assert(distSum === totalMonitoredPersonnel, `Risk distribution sum (${distSum}) strictly equals total personnel (${totalMonitoredPersonnel})`);
    assert(riskDistribution.UNASSESSED >= 0, 'UNASSESSED count is non-negative');

    // 9. Test Roster Optimization: no fabricated 40% risk, deterministic IDs, genuine battalion average
    const rosterRes = await axios.get(`${BASE_URL}/officer/roster-optimizer`, officerHeaders);
    assert(rosterRes.data.success === true, 'Roster optimization proposals retrieved');
    assert(!isNaN(parseFloat(rosterRes.data.data.estimatedBattalionFatigueReduction)), 'Battalion fatigue reduction is a valid percentage');
    rosterRes.data.data.proposals.forEach(p => {
      assert(p.currentRiskScore > 50, `Proposed personnel ${p.personnelId} has verified elevated risk (${p.currentRiskScore}%)`);
      assert(p.predictedRiskDelta < 0, `Predicted risk delta is negative (${p.predictedRiskDelta}%)`);
      assert(p.proposalId.startsWith('PROP-'), `Proposal ID format is standard (${p.proposalId})`);
    });

    // 10. Test Intervention Effectiveness: handles empty / real follow-ups without NaN or default 70
    const interventionRes = await axios.get(`${BASE_URL}/officer/intervention-effectiveness`, officerHeaders);
    assert(interventionRes.data.success === true, 'Intervention effectiveness retrieved');
    assert(!isNaN(interventionRes.data.data.averageRiskDelta), `Average risk delta is a valid number (got: ${interventionRes.data.data.averageRiskDelta})`);
    interventionRes.data.data.comparativeRecords.forEach(rec => {
      if (rec.initialRiskScore !== null && rec.reAnalyzedRiskScore !== null) {
        assert(!isNaN(rec.observedChange), 'Observed change is not NaN for evaluated record');
      }
    });

    // 11. Test System Transparency
    const transpRes = await axios.get(`${BASE_URL}/system/transparency`);
    assert(transpRes.data.success === true, 'System transparency retrieved');
    assert(transpRes.data.data.modelInfo !== null, 'Model info is returned');

  } catch (err) {
    console.error('Test execution error:', err.response ? err.response.data : err.message);
    failed++;
  }

  console.log('\n======================================================');
  console.log(`📊 Logic Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLogicTests();
