/**
 * WELFAREAI — Explainable AI Display Verification Test Suite
 * Validates:
 * 1. Welfare Concern display
 * 2. Evidence Strength display (with explicit "INSUFFICIENT EVIDENCE" when insufficient)
 * 3. Data Available display (e.g. 4/5 or 4/6)
 * 4. Main Contributing Indicators (e.g. "Contributors: ↑ workload, ↓ recovery, ↑ night duty")
 * 5. Personal Baseline status when available
 * 6. Explicit disclaimers: Never a medical diagnosis or disciplinary decision
 * 7. Zero fabricated contributors or fake explanations
 */

const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:5000/api/v1';

function request(method, reqPath, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + reqPath);
    const bodyStr = data ? JSON.stringify(data) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (bodyStr) {
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

let passed = 0;
let failed = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runExplainableAITests() {
  console.log('================================================================================');
  console.log('🧠 WELFAREAI — EXPLAINABLE AI RESULT DISPLAY VERIFICATION');
  console.log('================================================================================\n');

  try {
    // -----------------------------------------------------------------------------------
    // 1. Unassessed User / Insufficient Evidence Scenario
    // -----------------------------------------------------------------------------------
    console.log('--- 1. Insufficient Evidence Scenario (Zero-Guessing) ---');
    const sparseId = `SPARSE-${Date.now().toString().slice(-4)}`;
    const regSparse = await request('POST', '/auth/register', {
      personnelId: sparseId,
      fullName: 'Sparse Telemetry Personnel',
      email: `sparse.${Date.now()}@crpf.gov.in`,
      password: 'Password@123',
      role: 'PERSONNEL'
    });
    check(regSparse.status === 201, 'Unassessed user registered successfully');
    const sparseToken = regSparse.body.token;

    const sparsePred = await request('GET', '/prediction/latest', null, { Authorization: `Bearer ${sparseToken}` });
    check(sparsePred.status === 200, 'GET /prediction/latest returns HTTP 200 for unassessed user');
    check(sparsePred.body.welfareConcern === 'UNDETERMINED', 'Welfare Concern: UNDETERMINED');
    check(sparsePred.body.evidenceNotice === 'INSUFFICIENT EVIDENCE' || sparsePred.body.evidenceStrength === 'INSUFFICIENT', 'Evidence Strength: Clearly indicates INSUFFICIENT EVIDENCE');
    check(sparsePred.body.evidenceDisplay.includes('INSUFFICIENT'), 'Evidence Display clearly shows INSUFFICIENT');
    check(sparsePred.body.dataAvailableCount === 0, 'Data Available: 0/5 count accurately reported');
    check(sparsePred.body.contributorsSummary === 'INSUFFICIENT EVIDENCE', 'Contributors: Strictly shows "INSUFFICIENT EVIDENCE" without invented factors');
    check(sparsePred.body.personalBaselineStatus === 'NOT_ESTABLISHED', 'Personal Baseline status: NOT_ESTABLISHED');
    check(sparsePred.body.nonMedicalDisclaimer.includes('Never a medical diagnosis'), 'Non-medical disclaimer explicitly present');
    check(sparsePred.body.nonDisciplinaryDisclaimer.includes('Never a disciplinary decision'), 'Non-disciplinary disclaimer explicitly present');

    const sparseExplain = await request('GET', '/prediction/explainability', null, { Authorization: `Bearer ${sparseToken}` });
    check(sparseExplain.status === 200, 'GET /prediction/explainability returns HTTP 200');
    check(sparseExplain.body.evidenceStrength === 'INSUFFICIENT' || sparseExplain.body.evidenceNotice === 'INSUFFICIENT EVIDENCE', 'Explainability endpoint confirms INSUFFICIENT EVIDENCE');
    check(sparseExplain.body.contributorsSummary === 'INSUFFICIENT EVIDENCE', 'Explainability contributors: Strictly INSUFFICIENT EVIDENCE');

    // -----------------------------------------------------------------------------------
    // 2. Assessed User / Active Prediction Scenario
    // -----------------------------------------------------------------------------------
    console.log('\n--- 2. Active AI Welfare Result with Sufficient Evidence ---');
    const assessedId = `ASSESSED-${Date.now().toString().slice(-4)}`;
    const regAssessed = await request('POST', '/auth/register', {
      personnelId: assessedId,
      fullName: 'Active Operational Personnel',
      email: `assessed.${Date.now()}@crpf.gov.in`,
      password: 'Password@123',
      role: 'PERSONNEL'
    });
    const assessedToken = regAssessed.body.token;

    // Baseline check-in 1
    await request('POST', '/checkin', {
      shift_duration_hours: 8,
      weekly_duty_hours: 44,
      sleep_hours_per_night: 7.5,
      recovery_pattern: 'BALANCED',
      fatigue_physical_strain: 25,
      work_pressure_rating: 4,
      night_duty_hours: 4,
      prolonged_duty_hours: 0,
      shift_continuity_days: 2,
      rest_interval_hours: 14
    }, { Authorization: `Bearer ${assessedToken}` });

    // Active strain check-in 2 (creates high duty, night shift, lower recovery)
    const checkin2 = await request('POST', '/checkin', {
      shift_duration_hours: 14,
      weekly_duty_hours: 68,
      sleep_hours_per_night: 4.5,
      recovery_pattern: 'IRREGULAR',
      fatigue_physical_strain: 82,
      work_pressure_rating: 8,
      night_duty_hours: 18,
      prolonged_duty_hours: 16,
      shift_continuity_days: 8,
      rest_interval_hours: 4
    }, { Authorization: `Bearer ${assessedToken}` });
    check(checkin2.status === 201, 'Operational check-in 2 submitted successfully (HTTP 201)');

    const activePred = await request('GET', '/prediction/latest', null, { Authorization: `Bearer ${assessedToken}` });
    check(activePred.status === 200, 'GET /prediction/latest returns HTTP 200 for assessed user');

    // 1. Welfare Concern
    check(['HIGH', 'MODERATE', 'LOW'].includes(activePred.body.welfareConcern), `Welfare Concern clearly classified: ${activePred.body.welfareConcern}`);
    check(activePred.body.welfareConcernText.startsWith('Welfare Concern:'), `Welfare Concern formatted text: "${activePred.body.welfareConcernText}"`);

    // 2. Evidence Strength
    check(['HIGH', 'MODERATE', 'LOW', 'EMERGING'].includes(activePred.body.evidenceStrength), `Evidence Strength classified: ${activePred.body.evidenceStrength}`);
    check(activePred.body.evidenceText.startsWith('Evidence:'), `Evidence formatted text: "${activePred.body.evidenceText}"`);

    // 3. Data Available
    check(activePred.body.dataAvailableCount >= 3, `Data Available count: ${activePred.body.dataAvailableCount} / ${activePred.body.dataAvailableTotal}`);
    check(activePred.body.dataAvailableText.startsWith('Data Available:'), `Data Available formatted text: "${activePred.body.dataAvailableText}"`);

    // 4. Main Contributing Indicators
    check(activePred.body.mainContributors && activePred.body.mainContributors.length > 0, 'Main Contributing Indicators array populated from real feature attribution');
    check(activePred.body.contributorsSummary.length > 0, `Contributors Summary: "${activePred.body.contributorsSummary}"`);
    check(activePred.body.contributorsText.startsWith('Contributors:'), `Contributors formatted text: "${activePred.body.contributorsText}"`);
    // Check directional indicators exist (e.g. contains ↑ or ↓)
    check(activePred.body.contributorsSummary.includes('↑') || activePred.body.contributorsSummary.includes('↓'), 'Contributors include directional indicator arrows (↑ / ↓)');

    // 5. Personal Baseline status
    check(activePred.body.personalBaselineStatus === 'ESTABLISHED', 'Personal Baseline status correctly identified as ESTABLISHED (>=2 check-ins)');
    check(activePred.body.personalBaselineText.includes('Established'), `Personal Baseline formatted text: "${activePred.body.personalBaselineText}"`);

    // 6. Ethical Disclaimers
    check(activePred.body.nonMedicalDisclaimer.includes('Never a medical diagnosis'), 'Medical diagnosis explicitly disclaimed in API response');
    check(activePred.body.nonDisciplinaryDisclaimer.includes('Never a disciplinary decision'), 'Disciplinary decision explicitly disclaimed in API response');

    // -----------------------------------------------------------------------------------
    // 3. Frontend UI Markup & Disclaimer Integrity
    // -----------------------------------------------------------------------------------
    console.log('\n--- 3. Frontend UI Explainability & Ethical Guardrail Verification ---');
    const dashboardHtml = fs.readFileSync(path.join(__dirname, 'frontend', 'dashboard.html'), 'utf-8');
    check(dashboardHtml.includes('Welfare Concern:'), 'Dashboard includes Welfare Concern row');
    check(dashboardHtml.includes('Evidence Strength:'), 'Dashboard includes Evidence Strength row');
    check(dashboardHtml.includes('Data Available:'), 'Dashboard includes Data Available row');
    check(dashboardHtml.includes('Personal Baseline:'), 'Dashboard includes Personal Baseline row');
    check(dashboardHtml.includes('Main Contributing Indicators:'), 'Dashboard includes Main Contributing Indicators section');
    check(dashboardHtml.includes('Never a medical diagnosis or disciplinary decision'), 'Dashboard includes explicit non-medical and non-disciplinary guardrail statement');

    const aiAnalysisHtml = fs.readFileSync(path.join(__dirname, 'frontend', 'ai-analysis.html'), 'utf-8');
    check(aiAnalysisHtml.includes('INSUFFICIENT EVIDENCE'), 'AI Analysis portal supports INSUFFICIENT EVIDENCE display');
    check(aiAnalysisHtml.includes('Never a medical diagnosis or disciplinary decision'), 'AI Analysis portal contains explicit non-medical and non-disciplinary standard');

    const whyResultHtml = fs.readFileSync(path.join(__dirname, 'frontend', 'why-result.html'), 'utf-8');
    check(whyResultHtml.includes('NOT a Medical Diagnosis'), 'Why Result page declares NOT a Medical Diagnosis');
    check(whyResultHtml.includes('NOT for Disciplinary Use'), 'Why Result page declares NOT for Disciplinary Use');

    console.log('\n================================================================================');
    console.log(`🏁 EXPLAINABLE AI TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log('================================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test Suite Fatal Error:', err);
    process.exit(1);
  }
}

runExplainableAITests();
