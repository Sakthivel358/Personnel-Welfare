/**
 * Automated Verification Suite for:
 * Task 4: Personnel Self-Check / Check-in (Wellness inputs, Optional PSS-10, Voluntary Support request)
 * Task 5: HRMS Integration API Layer (Synthetic 6-domain operational data, Simulated labels, Profile sync)
 * Task 6: Human Welfare Review & Support Workflow (Unconditional support access, Officer action recording, Follow-up scheduling)
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
  console.log('🧪 VERIFICATION SUITE: CHECK-IN, HRMS INTEGRATION & HUMAN WELFARE REVIEW');
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

  // 1. Authentication
  console.log('--- Step 1: Authentication & RBAC Provisioning ---');
  const officerLogin = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identifier: 'WO-101', password: 'Password@123' });

  assert(officerLogin.status === 200 && officerLogin.body.token, 'Welfare Officer WO-101 authenticated successfully');
  const officerToken = officerLogin.body.token;

  const personnelLogin = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identifier: 'CRPF-9042', password: 'Password@123' });

  assert(personnelLogin.status === 200 && personnelLogin.body.token, 'Personnel CRPF-9042 authenticated successfully');
  const personnelToken = personnelLogin.body.token;

  // 2. Task 4: Personnel Self-Check / Check-in
  console.log('\n--- Step 2: Task 4 - Personnel Self-Check with Wellness Info & Support Request ---');

  // 2a. Check-in with wellness info and optional PSS skipped / partial
  const checkInPayload1 = {
    responses: [], // PSS-10 questions completely optional / skipped
    dutyHours: 9,
    sleepHours: 7,
    wellnessInfo: {
      energyLevel: 4,
      moraleLevel: 4,
      tensionLevel: 2,
      nutritionHydration: 5,
      wellnessNotes: 'Feeling rested after regular rotation shift.'
    },
    requestWelfareSupport: false
  };

  const resCheckin1 = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${personnelToken}`
    }
  }, checkInPayload1);

  console.log('Checkin 1 status:', resCheckin1.status, 'body:', resCheckin1.body);
  assert(resCheckin1.status === 201 && resCheckin1.body.success, 'Personnel self-checkin succeeded with optional PSS-10 omitted');
  assert(resCheckin1.body.data && resCheckin1.body.data.wellnessInfo && resCheckin1.body.data.wellnessInfo.energyLevel === 4, 'Wellness info stored in checkin record');

  // 2b. Check-in with wellness info AND voluntary Request Welfare Support
  const checkInPayload2 = {
    responses: [2, 3, 2, 1, 2, 3, 2, 2, 2, 1], // Full PSS-10
    dutyHours: 13,
    sleepHours: 4.5,
    wellnessInfo: {
      energyLevel: 2,
      moraleLevel: 2,
      tensionLevel: 4,
      nutritionHydration: 3,
      wellnessNotes: 'Consecutive night patrols leading to fatigue.'
    },
    requestWelfareSupport: true,
    supportType: 'REST_AND_RECUPERATION',
    supportNotes: 'Requesting confidential officer consultation and duty pacing review.'
  };

  const resCheckin2 = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${personnelToken}`
    }
  }, checkInPayload2);

  console.log('Checkin 2 status:', resCheckin2.status, 'body:', resCheckin2.body);

  assert(resCheckin2.status === 201 && resCheckin2.body.success, 'Personnel check-in with Request Welfare Support succeeded');
  assert(resCheckin2.body.data && resCheckin2.body.data.linkedSupportRequestId, 'Automatic Support Request record created and linked to checkin');

  // 3. Task 5: HRMS Integration API Layer
  console.log('\n--- Step 3: Task 5 - HRMS Integration Layer (Synthetic Prototype Gateway) ---');

  // 3a. Verify HRMS Status & Simulation Labels
  const hrmsStatus = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/hrms/status',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${personnelToken}` }
  });

  assert(hrmsStatus.status === 200 && hrmsStatus.body.success, 'GET /api/v1/hrms/status returned 200 OK');
  assert(hrmsStatus.body.data.isSimulated === true, 'HRMS status explicitly flagged isSimulated: true');
  assert(hrmsStatus.body.data.disclaimer.toLowerCase().includes('simulation') || hrmsStatus.body.data.disclaimer.toLowerCase().includes('prototype'), 'HRMS returns clear prototype simulation disclaimer');

  // 3b. Personnel retrieves own simulated HRMS record
  const myHRMSRecord = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/hrms/my-record',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${personnelToken}` }
  });

  assert(myHRMSRecord.status === 200 && myHRMSRecord.body.success, 'Personnel can fetch their synthetic HRMS dossier');
  assert(myHRMSRecord.body.data.leave && myHRMSRecord.body.data.duty && myHRMSRecord.body.data.deployment, 'HRMS record contains Leave, Duty, and Deployment categories');
  assert(myHRMSRecord.body.data.training && myHRMSRecord.body.data.workload, 'HRMS record contains Training and Workload categories');

  // 3c. Welfare Officer retrieves personnel HRMS record by ID
  const officerHRMSQuery = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/hrms/personnel/BSF-882190',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });

  assert(officerHRMSQuery.status === 200 && officerHRMSQuery.body.success, 'Welfare Officer can inspect personnel HRMS record by ID');
  assert(officerHRMSQuery.body.data.personnelId === 'BSF-882190', 'Correct personnel record BSF-882190 retrieved');

  // 3d. Query specific category (Leave)
  const leaveCategoryQuery = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/hrms/category/leave?personnelId=BSF-882190',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });

  assert(leaveCategoryQuery.status === 200 && leaveCategoryQuery.body.data.category === 'leave', 'Category endpoint returns leave category data');

  // 3e. Personnel HRMS Sync into profile
  const syncRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/hrms/sync',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${personnelToken}`
    }
  }, {});

  assert(syncRes.status === 200 && syncRes.body.success, 'POST /api/v1/hrms/sync synchronized user profile operational data');
  assert(syncRes.body.data.isSimulated === true, 'Sync response confirms simulated data source');

  // 4. Task 6: Human Welfare Review & Support Queue
  console.log('\n--- Step 4: Task 6 - Human Welfare Review & Support Queue ---');

  // 4a. Personnel submits unconditional support request (e.g. peer buddy or counseling)
  const createSupportRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/support',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${personnelToken}`
    }
  }, {
    requestType: 'HUMAN_WELFARE_REVIEW',
    urgency: 'HIGH',
    preferredContactMethod: 'CONFIDENTIAL_IN_PERSON',
    notes: 'Requesting confidential human officer dialogue regarding deployment stress.'
  });

  assert(createSupportRes.status === 201 && createSupportRes.body.success, 'Personnel submitted Human Welfare Review request');
  const supportRequestId = createSupportRes.body.data._id;
  assert(createSupportRes.body.data.accessibleRegardlessOfConcern === true, 'Support request marked accessible regardless of concern level');

  // 4b. Welfare Officer lists all support requests
  const officerSupportQueue = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/support/all',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });

  assert(officerSupportQueue.status === 200 && Array.isArray(officerSupportQueue.body.data), 'Welfare Officer successfully retrieved support queue');
  const targetReq = officerSupportQueue.body.data.find(r => String(r._id) === String(supportRequestId));
  assert(targetReq != null, 'Newly created support request appears in officer queue');
  assert(targetReq && targetReq.personnelName, 'Support request in officer queue enriched with personnelName, rank, and unit');

  // 4c. Welfare Officer records supportive intervention and schedules follow-up
  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + 5);

  const reviewPayload = {
    supportActionTaken: 'REST_ROTATION',
    status: 'FOLLOW_UP_SCHEDULED',
    officerNotes: 'Conducted confidential 1-on-1 welfare dialogue. Authorized 48-hour restorative downtime and assigned peer mentor support.',
    scheduledFollowUpDate: followUpDate.toISOString().split('T')[0]
  };

  const reviewRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: `/api/v1/support/${supportRequestId}/review`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${officerToken}`
    }
  }, reviewPayload);

  assert(reviewRes.status === 200 && reviewRes.body.success, 'Officer successfully recorded supportive intervention and scheduled follow-up');
  assert(reviewRes.body.data.supportActionTaken === 'REST_ROTATION', 'Support action correctly recorded as REST_ROTATION');
  assert(reviewRes.body.data.status === 'FOLLOW_UP_SCHEDULED', 'Request status transitioned to FOLLOW_UP_SCHEDULED');

  // 4d. Verify linked follow-up created
  const followUpsRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/followups',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });

  assert(followUpsRes.status === 200 && Array.isArray(followUpsRes.body.data), 'Officer follow-ups list retrieved successfully');
  const linkedFollowUp = followUpsRes.body.data.find(f => String(f.supportRequestId) === String(supportRequestId));
  assert(linkedFollowUp != null, 'Linked FollowUps session created with scheduled date and officer notes');

  // 4e. Personnel views updated support request status and assigned officer
  const myRequestsRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/support/my',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${personnelToken}` }
  });

  assert(myRequestsRes.status === 200 && Array.isArray(myRequestsRes.body.data), 'Personnel retrieved their own support requests list');
  const myUpdatedReq = myRequestsRes.body.data.find(r => String(r._id) === String(supportRequestId));
  assert(myUpdatedReq && myUpdatedReq.assignedOfficerName, 'Personnel can view assigned officer name on their support request');
  assert(myUpdatedReq && myUpdatedReq.linkedFollowUp, 'Personnel can view scheduled follow-up consultation details');

  console.log('\n========================================================================');
  console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Unhandled test execution error:', err);
  process.exit(1);
});
