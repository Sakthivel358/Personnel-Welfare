/**
 * Master Verification Suite: Final SIH Validation against SIH26186 Requirements
 *
 * Comprehensive validation across all 16 system subsystems:
 *  1. Core Infrastructure & Dual-Service Health (Node Backend + FastAPI ML Engine)
 *  2. Personnel Authentication & Session Security (Bcrypt, Sliding JWT, Revocation)
 *  3. HR, Duty & Operational Profile Telemetry (Leave, Deployment, Training, Shift Continuity)
 *  4. Self-Assessment & Holistic Wellness Check-in (Optional PSS-10, Wellness Info, Support Request)
 *  5. Tactical Smart Jacket Wearable Ingestion & Offline Sync (Physiological Bounds, Idempotency)
 *  6. Personal Baseline & What Changed Engine (Normal Patterns, Surge Deltas, Sleep Deficit)
 *  7. Dual Independent Random Forest Models (Model 1: 20 features, Model 2: 13 features)
 *  8. WelfareAI Decision Layer (Evidence Strength, Main Contributors, Zero-Guessing)
 *  9. Personalized Recommendations & Interventions (5 Structured Interventions, Tele-Counseling)
 * 10. Real-time Welfare Alert & Notification Center (Thresholds, Tokens, Ack/Close, Non-Punitive)
 * 11. Human Welfare Review & Support Queue (Unconditional Access, Officer Follow-ups)
 * 12. Workload Balancing Support (Advisory Proposals, Non-Autonomous Roster Pacing)
 * 13. HRMS Integration Gateway (Synthetic 6-Domain Operational Data, Simulation Notices)
 * 14. RBAC, Privacy Sandbox & Security Audit (Role Enforcement, Pseudonymization, Audit Trail)
 * 15. ML Model Monitoring & Admin Transparency (Metrics, Dual Confusion Matrices, Class Distributions)
 * 16. Responsive UI & 100% Navigation Integrity (Breakpoints, Off-canvas, Link Integrity)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

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

async function runMasterValidation() {
  console.log('===================================================================================');
  console.log('🇮🇳 SIH26186 WELFAREAI — MASTER END-TO-END SYSTEM VALIDATION SUITE');
  console.log('===================================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // ---------------------------------------------------------------------------------
    // DOMAIN 1: Core Infrastructure & Dual-Service Health
    // ---------------------------------------------------------------------------------
    console.log('--- Domain 1: Core Infrastructure & Dual-Service Health ---');
    const healthRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/system/health',
      method: 'GET'
    });
    assert(healthRes.status === 200, 'Node.js backend responds with HTTP 200 on /system/health');
    assert(healthRes.body.components?.backend?.status === 'UP', 'Backend component status is UP');
    assert(healthRes.body.components?.mlMicroservice?.isAvailable === true, 'FastAPI ML service on Port 8000 is reachable and active');

    // ---------------------------------------------------------------------------------
    // DOMAIN 2: Personnel Authentication & Session Security
    // ---------------------------------------------------------------------------------
    console.log('\n--- Domain 2: Personnel Authentication & Session Security ---');
    const uniqueId = `VAL-${Date.now().toString().slice(-5)}`;
    const uniqueEmail = `val.${uniqueId.toLowerCase()}@crpf.gov.in`;

    const registerRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      personnelId: uniqueId,
      email: uniqueEmail,
      password: 'StrongPassword@123',
      fullName: 'Head Constable Ramesh Chand',
      rank: 'Head Constable',
      unit: 'CRPF Battalion 104',
      role: 'PERSONNEL'
    });
    assert(registerRes.status === 201, 'Registration returns HTTP 201 Created');
    assert(!registerRes.body.user?.password, 'Password hash is excluded from response payload');

    const loginRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      identifier: uniqueId,
      password: 'StrongPassword@123'
    });
    assert(loginRes.status === 200, 'Login succeeds with HTTP 200');
    assert(loginRes.body.token != null, 'Cryptographically signed JWT token issued');
    const personnelToken = loginRes.body.token;

    // Officer Login
    const officerLogin = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { identifier: 'WO-101', password: 'Password@123' });
    assert(officerLogin.status === 200, 'Welfare Officer WO-101 authenticated successfully');
    const officerToken = officerLogin.body.token;

    // Admin Login
    const adminLogin = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { identifier: 'ADM-001', password: 'Password@123' });
    assert(adminLogin.status === 200, 'Admin ADM-001 authenticated successfully');
    const adminToken = adminLogin.body.token;

    // ---------------------------------------------------------------------------------
    // DOMAIN 3: HR, Duty & Operational Profile Telemetry
    // ---------------------------------------------------------------------------------
    console.log('\n--- Domain 3: HR, Duty & Operational Profile Telemetry ---');
    const profileRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/profile',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${personnelToken}` }
    });
    assert(profileRes.status === 200, 'Profile endpoint returns HTTP 200');
    assert(profileRes.body.data?.personnelId === uniqueId, 'Profile correctly identifies registered personnel');
    assert(profileRes.body.data?.leavePattern != null, 'HR Leave pattern structure exists');
    assert(profileRes.body.data?.dutySchedule != null, 'Operational duty schedule structure exists');
    assert(profileRes.body.data?.workloadTrends != null, 'Workload trends structure exists');

    // ---------------------------------------------------------------------------------
    // DOMAIN 4: Self-Assessment & Holistic Wellness Check-in
    // ---------------------------------------------------------------------------------
    console.log('\n--- Domain 4: Self-Assessment & Holistic Wellness Check-in ---');
    // Check-in with optional PSS-10 omitted + wellness information
    const checkin1Res = await makeRequest({
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
      sleepHours: 7.5,
      workload_hours: 42,
      recovery_sleep_hours: 7.5,
      duty_type: 'Regular Post Duty',
      resting_heart_rate: 68,
      wellnessInfo: {
        energyLevel: 4,
        moraleLevel: 4,
        tensionLevel: 2,
        nutritionHydration: 4,
        wellnessNotes: 'Feeling rested and balanced on standard shift.'
      },
      requestWelfareSupport: false
    });
    assert(checkin1Res.status === 201, 'Check-in processed successfully with optional PSS-10 omitted');
    assert(checkin1Res.body.data?.wellnessInfo?.energyLevel === 4, 'Holistic wellness info stored in checkin record');
    assert(checkin1Res.body.data?.alertGenerated === false, 'Standard baseline checkin does not generate alert');

    // ---------------------------------------------------------------------------------
    // DOMAIN 5: Tactical Smart Jacket Wearable Ingestion & Offline Sync
    // ---------------------------------------------------------------------------------
    console.log('\n--- Domain 5: Tactical Smart Jacket Wearable Ingestion & Offline Sync ---');
    const validWearableRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/wearable/ingest',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${personnelToken}`
      }
    }, {
      deviceId: 'TSJ-VAL-01',
      deviceType: 'TACTICAL_SMART_JACKET',
      idempotencyKey: `tsj-${uniqueId}-01`,
      timestamp: new Date().toISOString(),
      resting_heart_rate: 68,
      hrv_ms: 55,
      respiration_rate: 16,
      skin_temperature_c: 36.4,
      fatigue_physical_strain: 25
    });
    assert(validWearableRes.status === 201, 'Valid Smart Jacket packet ingested (HTTP 201)');

    // Boundary rejection test: impossible heart rate
    const invalidWearableRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/wearable/ingest',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${personnelToken}`
      }
    }, {
      deviceId: 'TSJ-VAL-01',
      resting_heart_rate: 280 // Physiologically impossible
    });
    assert(invalidWearableRes.status === 400, 'Physiologically impossible biometric (280 BPM) rejected with HTTP 400');

    // Wearable Deduplication Test
    const duplicateWearableRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/wearable/ingest',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${personnelToken}`
      }
    }, {
      deviceId: 'TSJ-VAL-01',
      idempotencyKey: `tsj-${uniqueId}-01`,
      resting_heart_rate: 68
    });
    assert(duplicateWearableRes.status === 200 && duplicateWearableRes.body.isDuplicate === true,
      'Idempotent ingestion detects duplicate packet and prevents duplicate record');

    // ---------------------------------------------------------------------------------
    // DOMAIN 6: Personal Baseline & What Changed Engine
    // ---------------------------------------------------------------------------------
    console.log('\n--- Domain 6: Personal Baseline & What Changed Engine ---');
    // Submit Checkin 2 (2nd prior record needed to establish baseline)
    await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/checkin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${personnelToken}`
      }
    }, {
      workload_hours: 44,
      recovery_sleep_hours: 7.1,
      duty_type: 'Field Patrol',
      fatigue_physical_strain: 24,
      resting_heart_rate: 70
    });

    // Submit Checkin 3 with high strain to compare against established baseline
    const checkin3Res = await makeRequest({
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
      duty_type: 'Night Tactical Patrol',
      fatigue_physical_strain: 78,
      resting_heart_rate: 88,
      hrv_ms: 22,
      respiration_rate: 22,
      skin_temperature_c: 37.2,
      pss_score: 30,
      wellnessInfo: {
        energyLevel: 1,
        moraleLevel: 1,
        tensionLevel: 5,
        nutritionHydration: 2,
        wellnessNotes: 'Severe exhaustion following extended night patrols.'
      },
      requestWelfareSupport: true,
      welfareSupportType: 'FATIGUE_RECOVERY',
      welfareSupportNotes: 'Requesting shift rotation due to severe fatigue.'
    });
    assert(checkin3Res.status === 201, 'High strain check-in processed successfully');
    assert(checkin3Res.body.data?.linkedSupportRequest != null, 'Automatic support request created from check-in');

    const whatChangedRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/prediction/what-changed',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${personnelToken}` }
    });
    assert(whatChangedRes.status === 200, 'GET /prediction/what-changed returns HTTP 200');
    assert(whatChangedRes.body.baselineEstablished === true, 'Personal baseline established after >=2 check-ins');
    assert(whatChangedRes.body.comparisonCategories?.workload != null, 'Workload variance category calculated');
    assert(whatChangedRes.body.comparisonCategories?.rest != null, 'Rest deficit category calculated');

    // ---------------------------------------------------------------------------------
    // DOMAIN 7: Dual Independent Random Forest Models
    // ---------------------------------------------------------------------------------
    console.log('\n--- Domain 7: Dual Independent Random Forest Models ---');
    const modelsRegistry = await makeRequest({
      hostname: '127.0.0.1',
      port: 8000,
      path: '/models',
      method: 'GET'
    });
    assert(modelsRegistry.status === 200, 'FastAPI /models endpoint reports dual architecture');
    assert(modelsRegistry.body.model1?.features_count === 20, 'Model 1 evaluates exactly 20 features (with wearable telemetry)');
    assert(modelsRegistry.body.model2?.features_count === 13, 'Model 2 evaluates exactly 13 features (strictly sensor-free)');
    assert(modelsRegistry.body.independence_guarantee?.strictly_independent === true, 'Models are strictly independent');

    // ---------------------------------------------------------------------------------
    // DOMAIN 8: WelfareAI Decision Layer
    // ---------------------------------------------------------------------------------
    console.log('\n--- Domain 8: WelfareAI Decision Layer ---');
    const latestPredRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/prediction/latest',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${personnelToken}` }
    });
    assert(latestPredRes.status === 200, 'GET /prediction/latest returns HTTP 200');
    assert(latestPredRes.body.data?.welfareConcernDisplay?.includes('WELFARE CONCERN'), 'Pillar 1: Welfare Concern Display verified');
    assert(latestPredRes.body.data?.evidenceDisplay?.includes('EVIDENCE'), 'Pillar 2: Evidence Strength Display verified');
    assert(latestPredRes.body.data?.dataAvailableDisplay?.includes('DATA AVAILABLE'), 'Pillar 3: Data Availability Display verified');
    assert(latestPredRes.body.data?.guidanceText || latestPredRes.body.data?.recommendations?.primaryAction, 'Pillar 4: Personalized Action Guidance verified');

    // ---------------------------------------------------------------------------------
    // DOMAIN 9: Personalized Recommendations & Interventions
    // ---------------------------------------------------------------------------------
    console.log('\n--- Domain 9: Personalized Recommendations & Interventions ---');
    const recs = checkin3Res.body.data?.recommendations;
    assert(recs != null, 'Recommendations object generated');
    assert(Array.isArray(recs.actionItems) && recs.actionItems.length > 0, 'Personalized actionable recovery tips present');
    const helplineItem = (recs.welfareResourceSuggestions || []).find(r => r.contact && r.contact.includes('1800-180-4024'));
    assert(helplineItem != null, 'Confidential 24/7 tele-counseling helpline (1800-180-4024) verified');

    // ---------------------------------------------------------------------------------
    // DOMAIN 10: Real-time Welfare Alert & Notification Center
    // ---------------------------------------------------------------------------------
    console.log('\n--- Domain 10: Real-time Welfare Alert & Notification Center ---');
    assert(checkin3Res.body.data?.alertGenerated === true, 'High strain breach triggered Welfare Alert generation');
    const generatedAlert = checkin3Res.body.data?.alert;
    assert(generatedAlert != null, 'Alert payload populated in response');
    assert(generatedAlert.userToken && generatedAlert.userToken.startsWith('USR_'), `Cryptographic userToken present: ${generatedAlert.userToken}`);
    assert(generatedAlert.isNonDisciplinary === true, 'Alert tagged strictly isNonDisciplinary: true');
    assert(generatedAlert.disciplinaryActionPermitted === false, 'Alert prohibits disciplinary action: disciplinaryActionPermitted: false');

    const alertId = generatedAlert._id;

    // Officer Acknowledge Action
    const ackRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/officer/alerts/${alertId}/acknowledge`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      }
    }, {
      officerNotes: 'Welfare Officer acknowledged signal. Placed in monitoring.'
    });
    assert(ackRes.status === 200, 'POST /officer/alerts/:id/acknowledge succeeded');
    assert(ackRes.body.data?.status === 'ACKNOWLEDGED', 'Alert status transitioned to ACKNOWLEDGED');

    // Non-disciplinary guardrail on close
    const punitiveClose = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/officer/alerts/${alertId}/close`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      }
    }, {
      resolutionReason: 'DISCIPLINARY_CHARGE',
      officerNotes: 'Issued disciplinary penalty charge against personnel.'
    });
    assert(punitiveClose.status === 400 && punitiveClose.body.error === 'NON_DISCIPLINARY_VIOLATION',
      'Punitive close attempt strictly blocked with NON_DISCIPLINARY_VIOLATION');

    // Supportive close action
    const supportiveClose = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/v1/officer/alerts/${alertId}/close`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      }
    }, {
      resolutionReason: 'REST_ROTATION_COMPLETED',
      officerNotes: 'Personnel completed 48-hour rest rotation; baseline conditions stabilized.'
    });
    assert(supportiveClose.status === 200, 'POST /officer/alerts/:id/close succeeded with supportive rationale');
    assert(supportiveClose.body.data?.status === 'CLOSED', 'Alert status transitioned to CLOSED');

    // ---------------------------------------------------------------------------------
    // DOMAIN 11: Human Welfare Review & Support Queue
    // ---------------------------------------------------------------------------------
    console.log('\n--- Domain 11: Human Welfare Review & Support Queue ---');
    const supportReqs = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/support/all',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });
    assert(supportReqs.status === 200, 'Officer retrieved support requests queue (HTTP 200)');
    const foundReq = supportReqs.body.data?.find(r => r.personnelId === uniqueId);
    assert(foundReq != null, 'Personnel support request accessible in officer queue');

    // ---------------------------------------------------------------------------------
    // DOMAIN 12: Workload Balancing Support
    // ---------------------------------------------------------------------------------
    console.log('\n--- Domain 12: Workload Balancing Support ---');
    const wlbRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/officer/workload-balancing',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${officerToken}` }
    });
    assert(wlbRes.status === 200, 'GET /officer/workload-balancing returns HTTP 200');
    assert(Array.isArray(wlbRes.body.data?.proposals), 'Proposals array returned');
    assert(wlbRes.body.data?.proposals[0]?.advisoryOnly === true, 'Workload balancing proposal explicitly marked advisoryOnly: true');
    assert(wlbRes.body.data?.proposals[0]?.automatedActionTaken === false, 'Workload balancing proposal explicitly confirms automatedActionTaken: false');

    // ---------------------------------------------------------------------------------
    // DOMAIN 13: HRMS Integration Gateway
    // ---------------------------------------------------------------------------------
    console.log('\n--- Domain 13: HRMS Integration Gateway ---');
    const hrmsStatus = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/hrms/status',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${personnelToken}` }
    });
    assert(hrmsStatus.status === 200, 'GET /hrms/status returns HTTP 200');
    assert(hrmsStatus.body.data?.isSimulated === true, 'HRMS gateway explicitly declared isSimulated: true');
    assert(hrmsStatus.body.data?.disclaimer?.toLowerCase().includes('simulat') || hrmsStatus.body.data?.disclaimer?.toLowerCase().includes('prototype'), 'Simulation prototype disclaimer present');

    // ---------------------------------------------------------------------------------
    // DOMAIN 14: RBAC, Privacy Sandbox & Security Audit
    // ---------------------------------------------------------------------------------
    console.log('\n--- Domain 14: RBAC, Privacy Sandbox & Security Audit ---');
    const rbacDenial = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/admin/metrics',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${personnelToken}` }
    });
    assert(rbacDenial.status === 403, 'RBAC: Personnel attempting to access /admin/metrics blocked with HTTP 403');

    const sandboxRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/privacy/sandbox/transform',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      }
    }, {
      name: 'Suresh Raina',
      serviceId: 'BSF-99102',
      age: 38,
      workloadHours: 70,
      stressScore: 78
    });
    assert(sandboxRes.status === 200, 'Privacy Sandbox transform succeeded (HTTP 200)');
    assert(sandboxRes.body.data?.after?.userToken?.startsWith('USR_'), 'Privacy Sandbox generated userToken');
    assert(sandboxRes.body.data?.after?.ageGroup === '36–40', 'Privacy Sandbox applied age cohort data minimization');

    // ---------------------------------------------------------------------------------
    // DOMAIN 15: ML Model Monitoring & Admin Transparency
    // ---------------------------------------------------------------------------------
    console.log('\n--- Domain 15: ML Model Monitoring & Admin Transparency ---');
    const transRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/system/transparency',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(transRes.status === 200, 'GET /system/transparency returns HTTP 200');
    const { models } = transRes.body.data;
    assert(models.model1?.trainingDataType === 'Synthetic Prototype Training Data', 'Model 1 explicitly labeled Synthetic Prototype Training Data');
    assert(models.model2?.trainingDataType === 'Synthetic Prototype Training Data', 'Model 2 explicitly labeled Synthetic Prototype Training Data');
    assert(models.model1?.confusionMatrix != null, 'Model 1 confusion matrix documented');
    assert(models.model2?.confusionMatrix != null, 'Model 2 confusion matrix documented');

    // ---------------------------------------------------------------------------------
    // DOMAIN 16: Responsive UI & 100% Navigation Integrity
    // ---------------------------------------------------------------------------------
    console.log('\n--- Domain 16: Responsive UI & 100% Navigation Integrity ---');
    const cssPath = path.join(__dirname, 'frontend', 'css', 'main.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    assert(cssContent.includes('@media (max-width: 1024px)'), 'Tablet responsive breakpoint (1024px) verified in main.css');
    assert(cssContent.includes('@media (max-width: 640px)'), 'Mobile responsive breakpoint (640px) verified in main.css');

    // Scan all html files for broken href links
    const frontendDir = path.join(__dirname, 'frontend');
    const htmlFiles = fs.readdirSync(frontendDir).filter(f => f.endsWith('.html'));
    let linkCount = 0;
    let brokenLinks = 0;
    for (const f of htmlFiles) {
      const content = fs.readFileSync(path.join(frontendDir, f), 'utf8');
      const hrefRegex = /href="([^"#:]+\.html)"/g;
      let match;
      while ((match = hrefRegex.exec(content)) !== null) {
        linkCount++;
        const target = match[1];
        if (!fs.existsSync(path.join(frontendDir, target))) {
          brokenLinks++;
          console.error(`Broken link in ${f} -> ${target}`);
        }
      }
    }
    assert(brokenLinks === 0, `All ${linkCount} internal navigation links across ${htmlFiles.length} HTML files are valid`);

    // ---------------------------------------------------------------------------------
    // Final Summary
    // ---------------------------------------------------------------------------------
    console.log('\n===================================================================================');
    console.log(`🏁 MASTER VALIDATION COMPLETE: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log('===================================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during master validation:', err);
    process.exit(1);
  }
}

runMasterValidation();
