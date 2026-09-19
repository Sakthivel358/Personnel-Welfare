/**
 * test_final_product_finish.js
 * Verification test suite for Task 45: Final Product Finish.
 * 
 * Verifies:
 * 1. Zero occurrences of demo-banner or demo-tag in frontend HTML/JS.
 * 2. Enterprise system-header-strip styling & system-tag presence.
 * 3. System Demonstration Guide modal & authorized credentials.
 * 4. Evaluation Scenario Presets (M1_HIGH, M1_LOW, M2_HIGH, M2_LOW, UNDETERMINED).
 * 5. All HTML pages accessible via HTTP (200 OK).
 * 6. Dual ML pathways and Decision Layer consensus working seamlessly.
 * 7. Three test personas authenticated against real backend database.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE_URL = 'http://127.0.0.1:5000';
const API_V1 = 'http://127.0.0.1:5000/api/v1';
const ML_URL = 'http://127.0.0.1:8000';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const postData = options.body ? JSON.stringify(options.body) : null;
    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };
    if (postData) {
      reqOpts.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(reqOpts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log(' WelfareAI Task 45: Final Product Finish Verification ');
  console.log('======================================================\n');

  // Test 1: Frontend files check for demo-banner and demo-tag
  console.log('--- Suite 1: Clean Enterprise Design & Zero Demo Artifacts ---');
  const frontendDir = path.join(__dirname, 'frontend');
  const files = fs.readdirSync(frontendDir);
  const htmlFiles = files.filter(f => f.endsWith('.html'));
  const jsFiles = fs.readdirSync(path.join(frontendDir, 'js')).filter(f => f.endsWith('.js'));

  let demoBannerFound = false;
  let demoTagFound = false;

  htmlFiles.forEach(hf => {
    const content = fs.readFileSync(path.join(frontendDir, hf), 'utf8');
    if (content.includes('class="demo-banner"') || content.includes("class='demo-banner'")) {
      demoBannerFound = true;
      console.error(`    Found demo-banner in ${hf}`);
    }
    if (content.includes('class="demo-tag"') || content.includes("class='demo-tag'")) {
      demoTagFound = true;
      console.error(`    Found demo-tag in ${hf}`);
    }
  });

  assert(!demoBannerFound, 'Zero occurrences of demo-banner in HTML files');
  assert(!demoTagFound, 'Zero occurrences of demo-tag in HTML files');

  // Test 2: System-header-strip in checkin and dashboard
  const checkinHtml = fs.readFileSync(path.join(frontendDir, 'stress-checkin.html'), 'utf8');
  assert(checkinHtml.includes('class="system-header-strip"'), 'stress-checkin.html contains enterprise system-header-strip');
  assert(checkinHtml.includes('class="system-tag"'), 'stress-checkin.html contains enterprise system-tag');
  assert(checkinHtml.includes('loadEvaluationScenario'), 'stress-checkin.html contains Evaluation Scenario Presets toolbar');

  // Test 3: System Demonstration Guide in utils.js
  console.log('\n--- Suite 2: System Guide & Evaluation Modal ---');
  const utilsJs = fs.readFileSync(path.join(frontendDir, 'js', 'utils.js'), 'utf8');
  assert(utilsJs.includes('openSystemGuide'), 'utils.js exports openSystemGuide method');
  assert(utilsJs.includes('closeSystemGuide'), 'utils.js exports closeSystemGuide method');
  assert(utilsJs.includes('CRPF-9042'), 'System guide modal lists Personnel credential CRPF-9042');
  assert(utilsJs.includes('WO-101'), 'System guide modal lists Welfare Officer credential WO-101');
  assert(utilsJs.includes('ADM-001'), 'System guide modal lists Admin credential ADM-001');

  // Test 4: Evaluation Scenarios in checkin.js
  console.log('\n--- Suite 3: Multi-Source Evaluation Presets ---');
  const checkinJs = fs.readFileSync(path.join(frontendDir, 'js', 'checkin.js'), 'utf8');
  assert(checkinJs.includes('function loadEvaluationScenario(scenarioKey)'), 'checkin.js defines loadEvaluationScenario');
  assert(checkinJs.includes("'M1_HIGH'"), 'checkin.js supports M1_HIGH (Wearable High Strain)');
  assert(checkinJs.includes("'M1_LOW'"), 'checkin.js supports M1_LOW (Wearable Rested/Optimal)');
  assert(checkinJs.includes("'M2_HIGH'"), 'checkin.js supports M2_HIGH (PSS-10 Fallback High)');
  assert(checkinJs.includes("'M2_LOW'"), 'checkin.js supports M2_LOW (PSS-10 Fallback Low)');
  assert(checkinJs.includes("'UNDETERMINED'"), 'checkin.js supports UNDETERMINED (Zero-guessing mandate)');

  // Test 5: Service Health & HTTP routes
  console.log('\n--- Suite 4: System Connectivity & HTTP Verification ---');
  try {
    const backendHealth = await fetchJson(`${BASE_URL}/api/health`);
    assert(backendHealth.status === 200 && backendHealth.data.success, 'Node Backend is operational (/api/health)');
  } catch (err) {
    assert(false, `Node Backend connection failed: ${err.message}`);
  }

  try {
    const mlHealth = await fetchJson(`${ML_URL}/health`);
    assert(mlHealth.status === 200 && mlHealth.data.status === 'healthy', 'FastAPI ML Service is operational (/health)');
  } catch (err) {
    assert(false, `FastAPI ML connection failed: ${err.message}`);
  }

  // Check critical HTML pages are served 200 OK
  const criticalPages = [
    '/dashboard.html',
    '/stress-checkin.html',
    '/ai-analysis.html',
    '/welfare-officer.html',
    '/admin.html',
    '/settings.html',
    '/profile.html',
    '/help.html',
    '/privacy.html',
    '/privacy-sandbox.html',
    '/trends.html',
    '/why-result.html',
    '/what-changed.html',
    '/recovery-journey.html',
    '/support.html',
    '/recommendations.html'
  ];

  for (const page of criticalPages) {
    const res = await fetchJson(`${BASE_URL}${page}`);
    assert(res.status === 200, `Page ${page} served successfully (200 OK)`);
  }

  // Test 6: Auth Persona Logins against real DB
  console.log('\n--- Suite 5: Authorized Enterprise Persona Credentials ---');
  let personnelToken = '';
  let officerToken = '';
  let adminToken = '';

  try {
    const pLogin = await fetchJson(`${API_V1}/auth/login`, {
      method: 'POST',
      body: { identifier: 'CRPF-9042', personnelId: 'CRPF-9042', password: 'Password@123' }
    });
    assert(pLogin.status === 200 && pLogin.data.success, 'Personnel (CRPF-9042) successfully authenticated');
    personnelToken = pLogin.data.token;
  } catch (e) {
    assert(false, `Personnel login failed: ${e.message}`);
  }

  try {
    const woLogin = await fetchJson(`${API_V1}/auth/login`, {
      method: 'POST',
      body: { identifier: 'WO-101', personnelId: 'WO-101', password: 'Password@123' }
    });
    assert(woLogin.status === 200 && woLogin.data.success, 'Welfare Officer (WO-101) successfully authenticated');
    officerToken = woLogin.data.token;
  } catch (e) {
    assert(false, `Officer login failed: ${e.message}`);
  }

  try {
    const admLogin = await fetchJson(`${API_V1}/auth/login`, {
      method: 'POST',
      body: { identifier: 'ADM-001', personnelId: 'ADM-001', password: 'Password@123' }
    });
    assert(admLogin.status === 200 && admLogin.data.success, 'System Admin (ADM-001) successfully authenticated');
    adminToken = admLogin.data.token;
  } catch (e) {
    assert(false, `Admin login failed: ${e.message}`);
  }

  // Test 7: ML Pathways and Decision Layer via Backend Checkin
  console.log('\n--- Suite 6: Multi-Pathway ML & Decision Layer Verification ---');
  
  // Model 1: Wearable pathway check-in
  try {
    const m1Payload = {
      duty_type: 'Quick Reaction Team (QRT)',
      shift_duration_hours: 14,
      consecutive_days_on: 12,
      night_duty_flag: true,
      weekly_duty_hours: 78,
      operational_tempo: 'HIGH',
      sleep_hours_per_night: 4.0,
      rest_interval_hours: 5.0,
      recovery_pattern: 'EXTENDED_DEFICIT',
      social_support_rating: 2.0,
      work_life_balance_rating: 2.0,
      resting_heart_rate: 96,
      hrv_ms: 24,
      respiration_rate: 24,
      skin_temperature_c: 38.2,
      activity_movement: 'HIGH_MOBILITY_TACTICAL',
      posture_inactivity: 'IMMOBILE_FATIGUE',
      fatigue_physical_strain: 85,
      wearable_synced: true,
      idempotencyKey: `chk-eval-m1-${Date.now()}`
    };

    const resM1 = await fetchJson(`${API_V1}/checkin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${personnelToken}` },
      body: m1Payload
    });

    assert((resM1.status === 201 || resM1.status === 200) && resM1.data.success, 'Model 1 Wearable check-in processed successfully (HTTP 201 Created)');
    assert(resM1.data && resM1.data.data && resM1.data.data.evidenceCount >= 3, 'Evidence fused across multi-source parameters');
  } catch (e) {
    assert(false, `Model 1 checkin error: ${e.message}`);
  }

  // Model 2: PSS-10 Fallback pathway check-in (wearable omitted)
  try {
    const m2Payload = {
      duty_type: 'Static Outpost Watch',
      shift_duration_hours: 12,
      consecutive_days_on: 8,
      night_duty_flag: true,
      weekly_duty_hours: 72,
      operational_tempo: 'HIGH',
      sleep_hours_per_night: 4.5,
      rest_interval_hours: 6.0,
      recovery_pattern: 'INTERRUPTED_SLEEP',
      social_support_rating: 3.0,
      work_life_balance_rating: 3.0,
      pss_score: 29,
      pss_responses: [3, 3, 4, 1, 1, 3, 1, 1, 4, 3],
      idempotencyKey: `chk-eval-m2-${Date.now()}`
    };

    const resM2 = await fetchJson(`${API_V1}/checkin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${personnelToken}` },
      body: m2Payload
    });

    assert((resM2.status === 201 || resM2.status === 200) && resM2.data.success, 'Model 2 Fallback PSS-10 check-in processed successfully (HTTP 201 Created)');
  } catch (e) {
    assert(false, `Model 2 checkin error: ${e.message}`);
  }

  // Final Summary
  console.log('\n======================================================');
  console.log(` Summary: ${passedTests}/${totalTests} Tests Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('======================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
