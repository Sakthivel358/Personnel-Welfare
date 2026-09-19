const http = require('http');
const assert = require('assert');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 VERIFYING TASKS 31, 32 & 33 IMPLEMENTATION');
  console.log('================================================================\n');

  // 1. Login as Personnel
  console.log('[1] Logging in as Personnel (CRPF-9042)...');
  const pLogin = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identifier: 'CRPF-9042', password: 'Password@123' });

  assert.strictEqual(pLogin.status, 200, 'Personnel login failed');
  const pToken = (pLogin.data.data && pLogin.data.data.token) || pLogin.data.token;
  console.log('   ✓ Personnel login successful');

  // 2. Login as Welfare Officer
  console.log('\n[2] Logging in as Welfare Officer (WO-101)...');
  const oLogin = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identifier: 'WO-101', password: 'Password@123' });

  assert.strictEqual(oLogin.status, 200, 'Officer login failed');
  const oToken = (oLogin.data.data && oLogin.data.data.token) || oLogin.data.token;
  console.log('   ✓ Officer login successful');

  // 3. Test Task 31: 5-element Welfare Concern Display
  console.log('\n[3] Testing Task 31: 5-element Welfare Concern Display...');
  const predRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/prediction/latest',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${pToken}` }
  });

  assert.strictEqual(predRes.status, 200, 'Failed to fetch latest prediction');
  const pred = predRes.data.data;
  console.log('   Latest prediction data retrieved:');
  console.log(`   - 1. Welfare Concern: "${pred.welfareConcernDisplay || pred.welfareConcern}"`);
  console.log(`   - 2. Evidence:        "${pred.evidenceDisplay || pred.evidence}"`);
  console.log(`   - 3. Data Available:  "${pred.dataAvailableDisplay || (pred.dataAvailableCount + ' / ' + pred.dataAvailableTotal)}"`);
  console.log(`   - 4. Main Contributors: ${JSON.stringify(pred.mainContributors?.map(c => c.name || c.factor))}`);
  console.log(`   - 5. Recommended Next Action: "${pred.recommendedNextAction || pred.recommendedAction}"`);

  // Verify exact elements
  assert.ok(pred.welfareConcern !== undefined, 'Missing welfareConcern');
  assert.ok(pred.welfareConcernDisplay !== undefined, 'Missing welfareConcernDisplay');
  assert.ok(pred.evidence !== undefined, 'Missing evidence');
  assert.ok(pred.evidenceDisplay !== undefined, 'Missing evidenceDisplay');
  assert.ok(pred.dataAvailableCount !== undefined, 'Missing dataAvailableCount');
  assert.ok(pred.dataAvailableTotal !== undefined, 'Missing dataAvailableTotal');
  assert.ok(pred.dataAvailableDisplay !== undefined, 'Missing dataAvailableDisplay');
  assert.ok(Array.isArray(pred.mainContributors), 'mainContributors must be an array');
  assert.ok(pred.recommendedNextAction, 'Missing recommendedNextAction');
  console.log('   ✓ Task 31: All 5 elements verified in Welfare Concern response!');

  // 4. Test Task 32: 7-Stage Non-Punitive Welfare Officer Workflow
  console.log('\n[4] Testing Task 32: 7-Stage Welfare Officer Workflow...');
  const alertsRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/officer/alerts',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${oToken}` }
  });

  assert.strictEqual(alertsRes.status, 200, 'Failed to fetch alerts');
  const alerts = alertsRes.data.data;
  assert.ok(alerts.length > 0, 'No alerts found for testing');
  const targetAlert = alerts[0];
  const alertId = targetAlert._id;
  console.log(`   Testing workflow for Alert ID: ${alertId}...`);

  const workflowRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/v1/officer/alerts/${alertId}/workflow`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${oToken}` }
  });

  assert.strictEqual(workflowRes.status, 200, 'Failed to fetch alert workflow');
  const wf = workflowRes.data.data;
  
  // Verify stages
  console.log('   Checking 7 stages:');
  assert.ok(wf.stage1_alert, 'Missing stage1_alert (Alert)');
  console.log(`   - Stage 1 (Alert): Alert type=${wf.stage1_alert.type}, Priority=${wf.stage1_alert.priority}`);
  
  assert.ok(wf.stage2_evidence, 'Missing stage2_evidence (Evidence)');
  console.log(`   - Stage 2 (Evidence): Strength=${wf.stage2_evidence.evidenceStrength}, Score=${wf.stage2_evidence.evidenceScore}`);

  assert.ok(wf.stage3_contributors, 'Missing stage3_contributors (Contributors)');
  console.log(`   - Stage 3 (Contributors): ${wf.stage3_contributors.contributors?.length || 0} real contributors listed`);

  assert.ok(wf.stage4_whatChanged, 'Missing stage4_whatChanged (What Changed)');
  console.log(`   - Stage 4 (What Changed): Baseline Status=${wf.stage4_whatChanged.status}`);

  assert.ok(wf.stage5_officerReview, 'Missing stage5_officerReview (Officer Review)');
  console.log(`   - Stage 5 (Officer Review): Allowed decisions=${wf.stage5_officerReview.allowedDecisions?.join(', ')}`);

  assert.ok(wf.stage6_supportAction, 'Missing stage6_supportAction (Support Action)');
  console.log(`   - Stage 6 (Support Action): Restorative options=${wf.stage6_supportAction.restorativeActions?.length || 0}`);

  assert.ok(wf.stage7_followUp, 'Missing stage7_followUp (Follow-up)');
  console.log(`   - Stage 7 (Follow-up): Scheduled Date=${wf.stage7_followUp.scheduledDate || 'None'}`);

  // Verify non-punitive guarantee
  assert.strictEqual(wf.isNonPunitive, true, 'Workflow must be strictly non-punitive');
  assert.ok(wf.stage1_alert.nonPunitiveNotice, 'Missing non-punitive notice');
  console.log(`   - Non-punitive notice confirmed: "${wf.stage1_alert.nonPunitiveNotice.substring(0, 60)}..."`);

  // Submit Alert Review with Support Action & Follow-up
  console.log('\n   Submitting Officer Review with Support Action & Scheduled Follow-up...');
  const reviewPayload = {
    status: 'RESOLVED',
    reviewDecision: 'SUPPORT_DISPATCHED',
    supportAction: 'MANDATORY_REST_PERIOD',
    officerNotes: 'Authorized 48h rest rotation and post-duty clinical check-in. Non-punitive care intervention.',
    assignFollowUp: true,
    scheduledDate: new Date(Date.now() + 86400000 * 3).toISOString()
  };

  const reviewRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/v1/officer/alerts/${alertId}/review`,
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${oToken}`,
      'Content-Type': 'application/json'
    }
  }, reviewPayload);

  assert.strictEqual(reviewRes.status, 200, 'Failed to submit alert review');
  console.log('   ✓ Task 32: 7-stage non-punitive officer review completed successfully!');

  // 5. Test Task 33: Welfare Support & Unconditional Access
  console.log('\n[5] Testing Task 33: Welfare Support & Unconditional Accessibility...');
  
  // 5.1 Test support options endpoint
  const optionsRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/support/options',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${pToken}` }
  });

  assert.strictEqual(optionsRes.status, 200, 'Failed to get support options');
  const optData = optionsRes.data.data;
  assert.ok(optData.policy.accessibleToAll, 'Policy must declare accessibleToAll: true');
  assert.ok(optData.categories.length >= 4, 'Must provide full support categories catalogue');
  console.log(`   - Policy Statement: "${optData.policy.statement}"`);
  console.log(`   - Categories count: ${optData.categories.length}`);

  // 5.2 Test self-directed support request submission regardless of concern level
  console.log('\n   Personnel submitting self-requested support...');
  const reqPayload = {
    requestType: 'CONFIDENTIAL_COUNSELING',
    urgency: 'PRIORITY',
    preferredContactMethod: 'CONFIDENTIAL_IN_PERSON',
    notes: 'Voluntary self-request for stress decompression consultation.'
  };

  const submitReqRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/support',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${pToken}`,
      'Content-Type': 'application/json'
    }
  }, reqPayload);

  assert.strictEqual(submitReqRes.status, 201, 'Failed to submit support request');
  const createdReq = submitReqRes.data.data;
  assert.strictEqual(createdReq.accessibleRegardlessOfConcern, true, 'Must allow request regardless of concern');
  assert.strictEqual(createdReq.isSelfRequested, true, 'Must flag as self-requested');
  console.log(`   - Request created: Reference=${createdReq.referenceId}, Urgency=${createdReq.urgency}`);

  // 5.3 Test getMyRequests lifecycle tracking
  console.log('\n   Verifying Personnel request lifecycle tracking...');
  const myReqsRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/support/my',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${pToken}` }
  });

  assert.strictEqual(myReqsRes.status, 200, 'Failed to get my requests');
  const myReqs = myReqsRes.data.data;
  assert.ok(myReqs.length > 0, 'No requests found for personnel');
  const foundReq = myReqs.find(r => r.referenceId === createdReq.referenceId);
  assert.ok(foundReq, 'Newly submitted request not found in user list');
  console.log(`   - Lifecycle record verified for ${foundReq.referenceId}`);
  console.log(`   - Officer assignment status: ${foundReq.assignedOfficerName}`);
  console.log('   ✓ Task 33: Unconditional support access and lifecycle tracking verified!');

  console.log('\n================================================================');
  console.log('🎉 ALL TASKS 31, 32 & 33 TESTS PASSED PERFECTLY!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
