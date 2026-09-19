/**
 * Comprehensive Automated Verification Suite for:
 * 1. Welfare Intervention Recommendations (Requirement 1)
 * 2. Complete HR / Operational Data (Requirement 2)
 * 3. Workload Balancing (Requirement 3)
 */

const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('========================================================================');
  console.log('🧪 VERIFICATION SUITE: WELFARE INTERVENTIONS, HR DATA & WORKLOAD BALANCING');
  console.log('========================================================================\n');

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

  // 1. Authenticate Welfare Officer and Personnel
  console.log('--- Step 1: Authentication & Token Provisioning ---');
  const officerLogin = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identifier: 'WO-101', password: 'Password@123' });

  assert(officerLogin.status === 200 && officerLogin.body.token, 'Welfare Officer WO-101 logged in successfully');
  const officerToken = officerLogin.body.token;

  const personnelLogin = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identifier: 'CRPF-9042', password: 'Password@123' });

  assert(personnelLogin.status === 200 && personnelLogin.body.token, 'Personnel CRPF-9042 logged in successfully');
  const personnelToken = personnelLogin.body.token;

  // 2. Test RBAC Enforcement on new endpoints
  console.log('\n--- Step 2: RBAC Enforcement ---');
  const unauthInterventions = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/officer/interventions',
    method: 'GET'
  });
  assert(unauthInterventions.status === 401, 'Unauthenticated access to /interventions rejected (401)');

  const unauthWorkload = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/officer/workload-balancing',
    method: 'GET'
  });
  assert(unauthWorkload.status === 401, 'Unauthenticated access to /workload-balancing rejected (401)');

  const personnelInterventionsReq = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/officer/interventions',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${personnelToken}` }
  });
  assert(personnelInterventionsReq.status === 403, 'Personnel role accessing officer interventions rejected (403 Forbidden)');

  const personnelWorkloadReq = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/officer/workload-balancing',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${personnelToken}` }
  });
  assert(personnelWorkloadReq.status === 403, 'Personnel role accessing officer workload balancing rejected (403 Forbidden)');

  // 3. Test Complete HR & Operational Data
  console.log('\n--- Step 3: Complete HR & Operational Data Verification ---');
  const profileRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/profile',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${personnelToken}` }
  });

  assert(profileRes.status === 200, 'Profile retrieved successfully');
  const prof = profileRes.body.data;
  assert(prof.leavePattern != null, 'Profile includes leavePattern dimension');
  assert(typeof prof.leavePattern.daysEarned === 'number' && typeof prof.leavePattern.daysRemaining === 'number', 'leavePattern has daysEarned & daysRemaining');
  assert(Array.isArray(prof.deploymentHistory) && prof.deploymentHistory.length > 0, 'Profile includes deploymentHistory array');
  assert(prof.dutySchedule != null && prof.dutySchedule.shiftType != null, 'Profile includes dutySchedule dimension');
  assert(prof.transferFrequency != null && typeof prof.transferFrequency.transfersCount === 'number', 'Profile includes transferFrequency dimension');
  assert(Array.isArray(prof.trainingCommitments) && prof.trainingCommitments.length > 0, 'Profile includes trainingCommitments array');
  assert(prof.workloadTrends != null && typeof prof.workloadTrends.averageWeeklyHours === 'number', 'Profile includes workloadTrends dimension');

  // Test updating HR fields
  const updatedProfileRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/profile',
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${personnelToken}`, 'Content-Type': 'application/json' },
  }, {
    leavePattern: { daysEarned: 60, daysAvailed: 12, daysRemaining: 48, lastLeaveDate: '2026-02-14', leaveDeficitWarning: false },
    workloadTrends: { averageWeeklyHours: 54, peakWeeklyHours: 66, surgeWeeksCount: 2, trajectory: 'Stable' }
  });
  assert(updatedProfileRes.status === 200, 'Profile updated with HR operational parameters');
  assert(updatedProfileRes.body.data.leavePattern.daysRemaining === 48, 'Updated leave remaining persisted');
  assert(updatedProfileRes.body.data.workloadTrends.trajectory === 'Stable', 'Updated workload trajectory persisted');

  // 4. Test Welfare Intervention Recommendations (Requirement 1)
  console.log('\n--- Step 4: Welfare Intervention Recommendations ---');
  const interventionsAll = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/officer/interventions',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  assert(interventionsAll.status === 200, 'Welfare Officer retrieved all unit interventions');
  assert(Array.isArray(interventionsAll.body.data.welfareInterventions), 'welfareInterventions array returned');

  const crpfInterventions = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/officer/interventions/CRPF-9042',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  assert(crpfInterventions.status === 200, 'Interventions retrieved for CRPF-9042');
  const ints = crpfInterventions.body.data.interventions;
  assert(Array.isArray(ints) && ints.length === 5, 'Generates exactly 5 structured welfare interventions');

  const categories = ints.map(i => i.category);
  assert(categories.includes('welfare_checkin'), 'Contains welfare_checkin intervention');
  assert(categories.includes('officer_followup'), 'Contains officer_followup intervention');
  assert(categories.includes('rest_recovery_review'), 'Contains rest_recovery_review intervention');
  assert(categories.includes('workload_review'), 'Contains workload_review intervention');
  assert(categories.includes('support_referral'), 'Contains support_referral intervention');

  // Strict Non-Punitive Validation
  let allNonDisciplinary = true;
  let allNonAutomated = true;
  let allRequireOfficer = true;
  let punitiveKeywordsFound = false;
  const punitiveTerms = ['disciplinary penalty', 'demotion', 'court martial', 'inquiry reprimand', 'punitive charge'];

  ints.forEach(item => {
    if (item.isDisciplinary !== false) allNonDisciplinary = false;
    if (item.autoActionTaken !== false) allNonAutomated = false;
    if (item.requiresOfficerConfirmation !== true) allRequireOfficer = false;

    const fullText = `${item.title} ${item.suggestedAction} ${item.evidenceBasis}`.toLowerCase();
    punitiveTerms.forEach(term => {
      if (fullText.includes(term)) punitiveKeywordsFound = true;
    });
  });

  assert(allNonDisciplinary, 'All recommendations strictly flagged isDisciplinary: false');
  assert(allNonAutomated, 'All recommendations strictly flagged autoActionTaken: false');
  assert(allRequireOfficer, 'All recommendations strictly require human officer confirmation');
  assert(!punitiveKeywordsFound, 'Zero punitive or disciplinary terminology in recommendations');

  // 5. Test Workload Balancing (Requirement 3)
  console.log('\n--- Step 5: Workload Balancing Support ---');
  const workloadRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/officer/workload-balancing',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  assert(workloadRes.status === 200, 'Workload balancing proposals retrieved successfully');
  const wbData = workloadRes.body.data;
  assert(wbData.sustainedWorkloadCount >= 0, 'Sustained workload count computed');
  assert(Array.isArray(wbData.proposals) && wbData.proposals.length > 0, 'Workload balancing proposals identified for high/sustained duty personnel');

  const sampleProposal = wbData.proposals[0];
  assert(sampleProposal.proposalId.startsWith('WLB-'), 'Proposal ID adheres to WLB convention');
  assert(Array.isArray(sampleProposal.patternsDetected) && sampleProposal.patternsDetected.length > 0, 'Proposal identifies sustained workload patterns');
  assert(sampleProposal.suggestedReviewAction && sampleProposal.suggestedReviewAction.length > 10, 'Proposal formulates suggested review action for officer');
  assert(sampleProposal.advisoryOnly === true, 'Proposal explicitly marked advisoryOnly: true');
  assert(sampleProposal.automatedActionTaken === false, 'Proposal explicitly confirms automatedActionTaken: false');

  // Test Reviewing/Endorsing Workload Proposal
  const reviewRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/v1/officer/workload-balancing/proposals/${sampleProposal.proposalId}/review`,
    method: 'POST',
    headers: { 'Authorization': `Bearer ${officerToken}`, 'Content-Type': 'application/json' }
  }, {
    reviewAction: 'DISPATCH_TO_ADJUTANT',
    officerNotes: 'Welfare Officer reviewed sustained duty exposure. Endorsed for Adjutant watch split schedule.',
    personnelId: sampleProposal.personnelId
  });

  assert(reviewRes.status === 200, 'Workload proposal review recorded');
  assert(reviewRes.body.data.automatedActionTaken === false, 'Review response guarantees automatedActionTaken: false');
  assert(reviewRes.body.data.status === 'REVIEWED_BY_OFFICER', 'Review status transitioned to REVIEWED_BY_OFFICER');

  // 6. Test Personnel Search integration with HR and Interventions
  console.log('\n--- Step 6: Officer Personnel Search with HR Data & Interventions ---');
  const searchRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/officer/personnel/search?q=CRPF-9042',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  assert(searchRes.status === 200, 'Personnel search executed successfully');
  const record = searchRes.body.data[0];
  assert(record.personnelId === 'CRPF-9042', 'Found matching record for CRPF-9042');
  assert(record.leavePattern != null, 'Search record includes leavePattern');
  assert(record.deploymentHistory != null, 'Search record includes deploymentHistory');
  assert(record.dutySchedule != null, 'Search record includes dutySchedule');
  assert(record.transferFrequency != null, 'Search record includes transferFrequency');
  assert(record.trainingCommitments != null, 'Search record includes trainingCommitments');
  assert(record.workloadTrends != null, 'Search record includes workloadTrends');
  assert(Array.isArray(record.welfareInterventions) && record.welfareInterventions.length === 5, 'Search record includes 5 welfareInterventions');

  // 7. Test Check-in incorporating HR context
  console.log('\n--- Step 7: Check-in Incorporating HR Context ---');
  const checkinRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${personnelToken}`, 'Content-Type': 'application/json' }
  }, {
    workload_hours: 64,
    shift_continuity_days: 8,
    prolonged_duty_hours: 13,
    night_duty_hours: 18,
    recovery_sleep_hours: 4.8,
    work_pressure_rating: 8,
    social_support_rating: 4,
    work_life_balance_rating: 3,
    pss_score: 28,
    wearable_synced: false
  });

  assert(checkinRes.status === 201 || checkinRes.status === 200, 'Check-in processed successfully with HR context');
  const checkinData = checkinRes.body.data;
  assert(checkinData.prediction != null, 'Prediction generated');
  assert(checkinData.recommendations != null, 'Recommendations generated');
  assert(Array.isArray(checkinData.recommendations.welfareInterventions) && checkinData.recommendations.welfareInterventions.length === 5, 'Check-in recommendations contain 5 welfareInterventions');

  console.log('\n========================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
