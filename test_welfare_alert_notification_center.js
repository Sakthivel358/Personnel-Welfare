/**
 * Automated Verification Suite for:
 * Real-time Welfare Alert & Notification Center
 *
 * Requirements:
 * 1. Generate alerts only when authorized data (>=3 sources) and configured evidence thresholds indicate a welfare concern.
 * 2. Show personnel token/ID, concern level, evidence strength, main contributors, and timestamp.
 * 3. Allow officer to acknowledge, review, and close the alert.
 * 4. Do not generate alerts from insufficient evidence.
 * 5. Do not use alerts for disciplinary action (strictly non-punitive).
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
  console.log('🧪 VERIFICATION SUITE: REAL-TIME WELFARE ALERT & NOTIFICATION CENTER');
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

  try {
    // 1. Authentication
    console.log('--- Step 1: Authentication & Provisioning ---');
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

    // 2. Insufficient Evidence Alert Suppression Test
    console.log('\n--- Step 2: Insufficient Evidence Alert Suppression ---');
    const sparseCheckin = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/checkin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${personnelToken}`
      }
    }, {
      dutyHours: 8,
      sleepHours: 7,
      wellnessInfo: {
        energyLevel: 4,
        moraleLevel: 4,
        tensionLevel: 2,
        nutritionHydration: 4
      }
    });

    assert(sparseCheckin.status === 201 && sparseCheckin.body.success, 'Sparse baseline check-in submitted successfully');
    const sparseData = sparseCheckin.body.data;
    assert(sparseData.alertGenerated === false, 'RULE ENFORCED: No alert generated from normal/insufficient evidence');

    // 3. Configured Evidence Threshold Alert Generation
    console.log('\n--- Step 3: Configured Evidence Threshold Alert Generation ---');
    const highStrainCheckin = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/checkin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${personnelToken}`
      }
    }, {
      workload_hours: 68,
      recovery_sleep_hours: 3.5,
      night_duty_hours: 14,
      shift_continuity_days: 9,
      pss_score: 32,
      fatigue_physical_strain: 78,
      work_pressure_rating: 5,
      resting_heart_rate: 88,
      wellnessInfo: {
        energyLevel: 1,
        moraleLevel: 1,
        tensionLevel: 5,
        nutritionHydration: 2,
        wellnessNotes: 'Severe physical fatigue and high strain following extended deployment'
      }
    });

    assert(highStrainCheckin.status === 201 && highStrainCheckin.body.success, 'High-strain check-in submitted successfully');
    const highStrainData = highStrainCheckin.body.data;
    assert(highStrainData.alertGenerated === true, 'Welfare alert generated when authorized multi-source thresholds breached');
    assert(highStrainData.alert != null, 'Alert object returned in response payload');

    const alert = highStrainData.alert;
    assert(alert.userToken && alert.userToken.startsWith('USR_'), `Personnel cryptographic token present: ${alert.userToken}`);
    assert(alert.personnelId === 'CRPF-9042', `Personnel ID matched: ${alert.personnelId}`);
    assert(alert.concernLevel === 'HIGH' || alert.concernLevel === 'MODERATE', `Concern level correctly flagged: ${alert.concernLevel}`);
    assert(alert.evidenceStrength === 'STRONG' || alert.evidenceStrength === 'ROBUST' || alert.evidenceStrength === 'SUFFICIENT' || alert.evidenceStrength === 'HIGH', `Evidence strength verified: ${alert.evidenceStrength}`);
    assert(Array.isArray(alert.mainContributors) && alert.mainContributors.length > 0, `Main contributors populated: ${alert.mainContributors.join(', ')}`);
    assert(alert.createdAt || alert.timestamp, 'Timestamp present on alert record');
    assert(alert.isNonDisciplinary === true, 'Alert tagged non-disciplinary: isNonDisciplinary=true');
    assert(alert.disciplinaryActionPermitted === false, 'Alert prohibits disciplinary action: disciplinaryActionPermitted=false');
    assert(alert.nonDisciplinaryStatement.includes('disciplinary'), 'Non-disciplinary force welfare statement confirmed on alert');

    const createdAlertId = alert._id;
    assert(createdAlertId, `Alert ID registered in database: ${createdAlertId}`);

    // 4. Officer Notifications Dispatch
    console.log('\n--- Step 4: Real-time Welfare Officer Notification Center ---');
    const officerNotificationsRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/notifications',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });

    assert(officerNotificationsRes.status === 200, 'Officer notifications endpoint returns 200');
    const notifications = officerNotificationsRes.body.data || [];
    const alertNotification = notifications.find(n => n.type === 'WELFARE_ALERT' || n.title?.includes('Welfare Alert') || n.personnelId === 'CRPF-9042');
    assert(alertNotification != null, 'Real-time alert notification delivered to Welfare Officer inbox');

    // 5. Query Alerts via Officer API
    console.log('\n--- Step 5: Officer Alerts Querying & Filtering ---');
    const alertsQuery = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/officer/alerts?status=PENDING_REVIEW',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });

    assert(alertsQuery.status === 200, 'GET /api/v1/officer/alerts?status=PENDING_REVIEW returned 200');
    const pendingList = alertsQuery.body.data || [];
    const targetAlert = pendingList.find(a => String(a._id) === String(createdAlertId) || a.personnelId === 'CRPF-9042');
    assert(targetAlert != null, 'Created alert retrieved in officer triage queue with PENDING_REVIEW status');
    assert(targetAlert.userToken, `Triage alert exposes userToken: ${targetAlert.userToken}`);
    assert(targetAlert.evidenceStrength, `Triage alert exposes evidenceStrength: ${targetAlert.evidenceStrength}`);

    const alertToActOn = targetAlert ? targetAlert._id : createdAlertId;

    // 6. Officer Acknowledge Alert Action
    console.log('\n--- Step 6: Officer Acknowledge Alert Action ---');
    const ackRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/officer/alerts/${alertToActOn}/acknowledge`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      }
    }, {
      officerNotes: 'Welfare Officer WO-101 acknowledged high-strain signal. Assigning peer check.'
    });

    assert(ackRes.status === 200, 'POST /api/v1/officer/alerts/:alertId/acknowledge returns 200');
    assert(ackRes.body.success === true, 'Acknowledge response reports success=true');
    assert(ackRes.body.data?.status === 'ACKNOWLEDGED', 'Alert status updated to ACKNOWLEDGED');
    assert(ackRes.body.data?.acknowledgedAt != null, 'acknowledgedAt timestamp recorded');
    assert(ackRes.body.data?.acknowledgedBy === 'WO-101', 'acknowledgedBy officer ID recorded');

    // 7. Non-Disciplinary Policy Guardrail on Close Alert
    console.log('\n--- Step 7: Non-Disciplinary Directive Enforcement ---');
    const punitiveCloseAttempt = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/officer/alerts/${alertToActOn}/close`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      }
    }, {
      resolutionReason: 'RESOLVED',
      officerNotes: 'Issued disciplinary penalty charge sheet against personnel for missed duty.'
    });

    assert(punitiveCloseAttempt.status === 400, 'PUNITIVE ATTEMPT REJECTED: HTTP 400 Bad Request returned');
    assert(punitiveCloseAttempt.body.error === 'NON_DISCIPLINARY_VIOLATION', 'Error code is NON_DISCIPLINARY_VIOLATION');
    assert(punitiveCloseAttempt.body.message.includes('disciplinary'), 'Protective message confirms non-disciplinary mandate');

    // 8. Legitimate Supportive Alert Close Action
    console.log('\n--- Step 8: Supportive Officer Close Alert Action ---');
    const supportiveCloseRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/officer/alerts/${alertToActOn}/close`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      }
    }, {
      resolutionReason: 'REST_ROTATION_COMPLETED',
      officerNotes: 'Personnel completed 48-hour restorative sleep rotation. Normal baseline restored.'
    });

    assert(supportiveCloseRes.status === 200, 'POST /api/v1/officer/alerts/:alertId/close returns 200');
    assert(supportiveCloseRes.body.success === true, 'Alert successfully closed with supportive rationale');
    assert(supportiveCloseRes.body.data?.status === 'CLOSED', 'Alert status updated to CLOSED');
    assert(supportiveCloseRes.body.data?.closedAt != null, 'closedAt timestamp recorded');
    assert(supportiveCloseRes.body.data?.resolutionReason === 'REST_ROTATION_COMPLETED', 'Supportive resolution reason saved');

    // 9. Query Closed Alerts Filter
    console.log('\n--- Step 9: Query Closed Alerts Verification ---');
    const closedQuery = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/officer/alerts?status=CLOSED',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });

    assert(closedQuery.status === 200, 'GET /api/v1/officer/alerts?status=CLOSED returned 200');
    const closedList = closedQuery.body.data || [];
    const foundClosed = closedList.find(a => String(a._id) === String(alertToActOn));
    assert(foundClosed != null, 'Closed alert correctly retrieved under CLOSED filter in Alert Center');

    // Summary
    console.log('\n========================================================================');
    console.log(`🏁 RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during test run:', err);
    process.exit(1);
  }
}

runTests();
