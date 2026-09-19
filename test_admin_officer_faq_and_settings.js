/**
 * Test Suite: Tasks 37, 38, 39, and 40
 * - Task 37: Admin Page (Database-backed counts, no demo stats or hardcoded accuracy)
 * - Task 38: Welfare Officer Page (Authorized data, dynamic PDF modal, clean empty states)
 * - Task 39: FAQ (All 14 distinct sections: General, Personnel, Welfare Officer, Admin, ML, Wearables, PSS-10, Privacy, Security, Offline mode, Data, Alerts, Welfare Support, Ethics)
 * - Task 40: Settings (6 functional tabs + Two-Stage Change Password flow: confirmation first, fields revealed on verification)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';

function makeRequest(method, endpoint, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, body: json || data });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING VERIFICATION FOR TASKS 37, 38, 39 & 40');
  console.log('================================================================\n');

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

  // Helper auth login
  let officerToken = '';
  let adminToken = '';
  let personnelToken = '';

  const randId = Math.floor(1000 + Math.random() * 9000);
  const testPersonnelId = `TEST_P_${randId}`;
  const testPassword = 'Password123!';
  const updatedPassword = 'NewPassword456!';

  try {
    // 0. Register accounts
    console.log('🔹 Setting up test accounts...');
    const regRes = await makeRequest('POST', '/api/v1/auth/register', {
      personnelId: testPersonnelId,
      email: `test_p_${randId}@welfare.mil.in`,
      password: testPassword,
      confirmPassword: testPassword,
      fullName: `Test Personnel ${randId}`,
      role: 'PERSONNEL'
    });
    assert(regRes.status === 201, 'Personnel account registered successfully');
    personnelToken = regRes.body?.token;

    const adminRegRes = await makeRequest('POST', '/api/v1/auth/register', {
      personnelId: `TEST_ADM_${randId}`,
      email: `test_adm_${randId}@welfare.mil.in`,
      password: 'AdminPassword123!',
      confirmPassword: 'AdminPassword123!',
      fullName: `Test Admin ${randId}`,
      role: 'ADMIN'
    });
    assert(adminRegRes.status === 201, 'Admin account registered successfully');
    adminToken = adminRegRes.body?.token;

    const officerRegRes = await makeRequest('POST', '/api/v1/auth/register', {
      personnelId: `TEST_WO_${randId}`,
      email: `test_wo_${randId}@welfare.mil.in`,
      password: 'OfficerPassword123!',
      confirmPassword: 'OfficerPassword123!',
      fullName: `Test Officer ${randId}`,
      role: 'WELFARE_OFFICER'
    });
    assert(officerRegRes.status === 201, 'Officer account registered successfully');
    officerToken = officerRegRes.body?.token;

    // -------------------------------------------------------------
    // TASK 37: Admin Page Tests
    // -------------------------------------------------------------
    console.log('\n🔹 [TASK 37] Testing Admin Page & Backend Metrics...');
    const adminMetricsRes = await makeRequest('GET', '/api/v1/admin/metrics', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert(adminMetricsRes.status === 200, 'Admin metrics endpoint returned HTTP 200');
    assert(adminMetricsRes.body.success === true, 'Admin metrics response declares success: true');
    const counts = adminMetricsRes.body?.data?.counts || {};
    assert(typeof counts.users === 'number' && counts.users >= 1, `Authorized database user count: ${counts.users}`);
    assert(typeof counts.personnel === 'number' && counts.personnel >= 1, `Authorized database personnel count: ${counts.personnel}`);
    assert(typeof counts.checkIns === 'number', `Authorized database check-ins count: ${counts.checkIns}`);
    assert(typeof counts.predictions === 'number', `Authorized database predictions count: ${counts.predictions}`);
    assert(typeof counts.alerts === 'number', `Authorized database alerts count: ${counts.alerts}`);
    assert(typeof counts.supportRequests === 'number', `Authorized database supportRequests count: ${counts.supportRequests}`);
    assert(typeof counts.followUps === 'number', `Authorized database followUps count: ${counts.followUps}`);
    assert(typeof counts.auditLogs === 'number', `Authorized database auditLogs count: ${counts.auditLogs}`);

    // Verify admin.html static content has no fake accuracy or demo tags
    const adminHtml = fs.readFileSync(path.join(__dirname, 'frontend', 'admin.html'), 'utf-8');
    assert(!adminHtml.includes('>81.5%<'), 'admin.html does NOT contain hardcoded 81.5% accuracy');
    assert(!adminHtml.includes('>54.9%<'), 'admin.html does NOT contain hardcoded 54.9% precision');
    assert(!adminHtml.includes('[126, 32, 0]'), 'admin.html does NOT contain hardcoded confusion matrix');
    assert(!adminHtml.includes('class="demo-banner"'), 'admin.html does NOT use demo-banner class');
    assert(adminHtml.includes('id="cnt-personnel"'), 'admin.html includes personnel database volume count element');

    // -------------------------------------------------------------
    // TASK 38: Welfare Officer Page Tests
    // -------------------------------------------------------------
    console.log('\n🔹 [TASK 38] Testing Welfare Officer Page & Authorized Information...');
    const officerDashRes = await makeRequest('GET', '/api/v1/officer/dashboard', null, {
      Authorization: `Bearer ${officerToken}`
    });
    assert(officerDashRes.status === 200, 'Officer dashboard endpoint returned HTTP 200');
    assert(officerDashRes.body.success === true, 'Officer dashboard declares success: true');
    assert(typeof officerDashRes.body?.data?.totalMonitoredPersonnel === 'number', 'Officer dashboard computes live monitored personnel count');
    assert(typeof officerDashRes.body?.data?.riskDistribution === 'object', 'Officer dashboard computes live risk distribution');

    const officerHtml = fs.readFileSync(path.join(__dirname, 'frontend', 'welfare-officer.html'), 'utf-8');
    assert(!officerHtml.includes('>68%<'), 'welfare-officer.html PDF modal does NOT contain hardcoded 68%');
    assert(!officerHtml.includes('>24%<'), 'welfare-officer.html PDF modal does NOT contain hardcoded 24%');
    assert(!officerHtml.includes('>91.4%<'), 'welfare-officer.html PDF modal does NOT contain hardcoded 91.4%');
    assert(!officerHtml.includes('CRPF Battalion 104</div>'), 'welfare-officer.html does NOT hardcode CRPF Battalion 104 in PDF modal');
    assert(!officerHtml.includes('class="demo-banner"'), 'welfare-officer.html does NOT use demo-banner class');
    assert(officerHtml.includes('id="pdf-cnt-low"'), 'welfare-officer.html uses dynamic span for pdf-cnt-low');
    assert(officerHtml.includes('openExecutivePDFModal()'), 'welfare-officer.html uses dynamic openExecutivePDFModal() calculation');

    // -------------------------------------------------------------
    // TASK 39: FAQ Page 14 Sections Tests
    // -------------------------------------------------------------
    console.log('\n🔹 [TASK 39] Testing FAQ Page (help.html) for all 14 requested sections...');
    const helpHtml = fs.readFileSync(path.join(__dirname, 'frontend', 'help.html'), 'utf-8');
    const expectedSections = [
      'General',
      'Personnel',
      'Welfare Officer',
      'Admin',
      'ML',
      'Wearables',
      'PSS-10',
      'Privacy',
      'Security',
      'Offline mode',
      'Data',
      'Alerts',
      'Welfare Support',
      'Ethics'
    ];

    expectedSections.forEach(sec => {
      const hasHeading = helpHtml.toLowerCase().includes(sec.toLowerCase());
      assert(hasHeading, `help.html contains section heading/topic for: "${sec}"`);
    });

    assert(helpHtml.includes('faq-filter-pills'), 'help.html contains category filter pills navigation');
    assert(helpHtml.includes('faq-search-input'), 'help.html contains real-time search input');

    // -------------------------------------------------------------
    // TASK 40: Settings Page & Two-Stage Change Password Tests
    // -------------------------------------------------------------
    console.log('\n🔹 [TASK 40] Testing Settings Page & Two-Stage Password Verification...');
    const settingsHtml = fs.readFileSync(path.join(__dirname, 'frontend', 'settings.html'), 'utf-8');
    
    // Check for all 6 required tabs
    const expectedTabs = [
      'tab-btn-general',
      'tab-btn-notifications',
      'tab-btn-appearance',
      'tab-btn-privacy',
      'tab-btn-security',
      'tab-btn-account'
    ];
    expectedTabs.forEach(t => {
      assert(settingsHtml.includes(`id="${t}"`), `settings.html contains tab button #${t}`);
    });

    // Check for Two-Stage Password markup
    assert(settingsHtml.includes('id="pwd-stage-1-confirm"'), 'settings.html contains Stage 1 secure confirmation screen (#pwd-stage-1-confirm)');
    assert(settingsHtml.includes('id="pwd-stage-2-change"'), 'settings.html contains Stage 2 password change input fields (#pwd-stage-2-change)');
    assert(settingsHtml.includes('handleVerifyCurrentPassword()'), 'settings.html implements handleVerifyCurrentPassword()');

    // API Test: POST /api/v1/auth/verify-password with incorrect password
    console.log('\n🔹 Testing /api/v1/auth/verify-password endpoint...');
    const badVerifyRes = await makeRequest('POST', '/api/v1/auth/verify-password', {
      password: 'WrongPassword123'
    }, {
      Authorization: `Bearer ${personnelToken}`
    });
    assert(badVerifyRes.status === 401, 'verify-password rejects incorrect current password with HTTP 401');
    assert(badVerifyRes.body.verified !== true, 'verify-password body indicates verification failed');

    // API Test: POST /api/v1/auth/verify-password with correct password
    const goodVerifyRes = await makeRequest('POST', '/api/v1/auth/verify-password', {
      password: testPassword
    }, {
      Authorization: `Bearer ${personnelToken}`
    });
    assert(goodVerifyRes.status === 200, 'verify-password accepts correct current password with HTTP 200');
    assert(goodVerifyRes.body.verified === true, 'verify-password body confirms identity: verified: true');

    // API Test: POST /api/v1/auth/change-password
    console.log('\n🔹 Testing /api/v1/auth/change-password endpoint...');
    const changePwdRes = await makeRequest('POST', '/api/v1/auth/change-password', {
      currentPassword: testPassword,
      newPassword: updatedPassword
    }, {
      Authorization: `Bearer ${personnelToken}`
    });
    assert(changePwdRes.status === 200, 'change-password successfully updates password with HTTP 200');
    assert(changePwdRes.body.success === true, 'change-password returns success: true');

    // Re-verify with updated password
    const reVerifyRes = await makeRequest('POST', '/api/v1/auth/verify-password', {
      password: updatedPassword
    }, {
      Authorization: `Bearer ${personnelToken}`
    });
    assert(reVerifyRes.status === 200 && reVerifyRes.body.verified === true, 'Updated password is valid and verified by Bcrypt');

  } catch (err) {
    console.error('💥 Unhandled exception during testing:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
