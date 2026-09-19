/**
 * Automated Verification Suite for:
 * 1. Task 11: Profile Separation from Dynamic Welfare Inputs
 * 2. Task 12: Duty Data Connection to Welfare Analysis System
 */

const http = require('http');

const BASE_URL = 'http://127.0.0.1:5000/api/v1';
let personnelToken = '';
let officerToken = '';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  const list = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
  const cookies = {};
  list.forEach(c => {
    const parts = c.split(';')[0].split('=');
    cookies[parts[0].trim()] = parts[1] ? parts[1].trim() : '';
  });
  return cookies;
}

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log('  PASS: ' + message);
    passedTests++;
  } else {
    console.error('  FAIL: ' + message);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('  RUNNING TESTS: PROFILE SEPARATION & DUTY DATA INTEGRATION');
  console.log('===============================================================\n');

  // Step 0: Authenticate Personnel & Welfare Officer
  console.log('[Step 0] Authenticating Personnel & Officer...');
  const pLogin = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    identifier: 'CRPF-9042',
    password: 'Password@123'
  });

  assert(pLogin.status === 200 && pLogin.data.success, 'Personnel logged in successfully');
  const pCookies = parseCookies(pLogin.headers['set-cookie']);
  personnelToken = (pLogin.data.data && pLogin.data.data.token) || pLogin.data.token || pCookies['sih_auth_token'] || pCookies['token'];

  const oLogin = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    identifier: 'WO-101',
    password: 'Password@123'
  });

  assert(oLogin.status === 200 && oLogin.data.success, 'Welfare Officer logged in successfully');
  const oCookies = parseCookies(oLogin.headers['set-cookie']);
  officerToken = (oLogin.data.data && oLogin.data.data.token) || oLogin.data.token || oCookies['sih_auth_token'] || oCookies['token'];

  // Step 1: Verify Profile GET returns personal & service data without dynamic welfare inputs
  console.log('\n[Step 1] Verifying Profile Data Boundary (Task 11)...');
  const profileGet = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/profile',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + personnelToken,
      'Cookie': 'sih_auth_token=' + personnelToken
    }
  });

  assert(profileGet.status === 200 && profileGet.data.success, 'GET /profile succeeds');
  const prof = profileGet.data.data;
  assert(prof.personnelId && prof.email && prof.fullName, 'Profile contains permanent identity fields (personnelId, email, fullName)');
  assert(prof.rank && prof.unit, 'Profile contains service posting details (rank, unit)');
  assert(prof.pss_score === undefined, 'Profile does NOT expose dynamic PSS score');
  assert(prof.resting_heart_rate === undefined, 'Profile does NOT expose dynamic wearable heart rate');
  assert(prof.workload_hours === undefined, 'Profile does NOT expose dynamic weekly workload hours');

  // Step 2: Verify Profile Update preserves boundaries and ignores accidental welfare/wearable keys
  console.log('\n[Step 2] Testing Profile Update with accidental welfare payload injection...');
  const profileUpdate = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/profile',
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + personnelToken,
      'Cookie': 'sih_auth_token=' + personnelToken,
      'Content-Type': 'application/json'
    }
  }, {
    fullName: 'Havildar Rajesh Kumar',
    phone: '+91-9876543210',
    rank: 'Havildar (GD)',
    unit: 'CRPF Battalion 104',
    postingType: 'Field Operations',
    deploymentZone: 'Northern Sector (High Altitude)',
    primaryDuty: 'Quick Reaction Team (QRT)',
    emergencyContact: {
      name: 'Sunita Devi',
      relationship: 'Spouse',
      phone: '+91-9876500000'
    },
    pss_score: 38,
    resting_heart_rate: 110,
    workload_hours: 85
  });

  assert(profileUpdate.status === 200 && profileUpdate.data.success, 'PUT /profile succeeds');
  assert(profileUpdate.data.data.fullName === 'Havildar Rajesh Kumar', 'Profile legal name updated');
  assert(profileUpdate.data.data.deploymentZone === 'Northern Sector (High Altitude)', 'Deployment zone recorded');
  assert(profileUpdate.data.data.primaryDuty === 'Quick Reaction Team (QRT)', 'Primary duty recorded');
  assert(profileUpdate.data.data.emergencyContact.name === 'Sunita Devi', 'Emergency contact recorded');
  assert(profileUpdate.data.data.pss_score === undefined, 'Injected pss_score was not stored in profile');
  assert(profileUpdate.data.data.resting_heart_rate === undefined, 'Injected resting_heart_rate was not stored in profile');

  // Step 3: Verify Duty Data Connection in Check-in (Task 12)
  console.log('\n[Step 3] Submitting Check-in with Duty Data (prolonged, continuous, night duty, duty_type)...');
  const dutyCheckIn = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + personnelToken,
      'Cookie': 'sih_auth_token=' + personnelToken,
      'Content-Type': 'application/json'
    }
  }, {
    idempotencyKey: 'test-duty-' + Date.now(),
    duty_type: 'Quick Reaction Team (QRT)',
    shift_continuity_days: 8,
    prolonged_duty_hours: 14,
    night_duty_hours: 20,
    workload_hours: 68,
    work_pressure_rating: 8,
    recovery_sleep_hours: 4.5,
    rest_interval_hours: 5.0,
    recovery_pattern: 'FRAGMENTED'
  });

  assert(dutyCheckIn.status === 201 || dutyCheckIn.status === 200, 'Check-in with duty data accepted (Status 200/201)');
  const chkData = dutyCheckIn.data.data;
  assert(chkData.checkIn.duty_type === 'Quick Reaction Team (QRT)', 'checkIn record captures duty_type');
  assert(chkData.checkIn.shift_continuity_days === 8, 'checkIn record captures 8 consecutive duty days');
  assert(chkData.checkIn.prolonged_duty_hours === 14, 'checkIn record captures 14 prolonged duty hours');
  assert(chkData.checkIn.night_duty_hours === 20, 'checkIn record captures 20 night duty hours');
  assert(chkData.checkIn.deploymentZone === 'Northern Sector (High Altitude)', 'checkIn enriched with profile deploymentZone');

  // Verify ML Prediction & Feature Attribution for Duty Data
  const pred = chkData.prediction;
  assert(pred && pred.compositeRiskScore > 50, 'Composite risk reflects operational duty strain (Score: ' + (pred ? pred.compositeRiskScore : 'N/A') + ')');
  assert(pred.topDrivers && pred.topDrivers.length > 0, 'Top drivers identified: ' + (pred.topDrivers ? pred.topDrivers.join(', ') : ''));
  
  const hasDutyFactor = pred.contributingFactors.some(f => 
    f.feature_key === 'prolonged_duty_hours' || 
    f.feature_key === 'night_duty_hours' || 
    f.feature_key === 'shift_continuity_days' || 
    f.feature_key === 'operational_duty_context'
  );
  assert(hasDutyFactor, 'contributingFactors includes duty exposure or operational duty context factor');

  // Verify Tailored Duty Relief Recommendations
  const recs = chkData.recommendations;
  assert(recs && recs.actionItems && recs.actionItems.length > 0, 'Recommendations generated');
  const hasDutyRelief = recs.actionItems.some(item => 
    item.category.includes('Duty') || 
    item.category.includes('Circadian') || 
    item.category.includes('Terrain') ||
    item.category.includes('Tactical')
  );
  assert(hasDutyRelief, 'Recommendations contain operational duty relief or tactical pacing action items');

  // Step 4: Verify Officer Roster Optimization accounts for Duty Data
  console.log('\n[Step 4] Verifying Officer Roster Optimization with Duty Data...');
  const rosterRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/officer/roster-optimization',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + officerToken,
      'Cookie': 'sih_auth_token=' + officerToken
    }
  });

  assert(rosterRes.status === 200 && rosterRes.data.success, 'GET /officer/roster-optimization succeeds');
  const proposals = rosterRes.data.data.proposals;
  assert(Array.isArray(proposals) && proposals.length > 0, 'Roster pacing generated ' + proposals.length + ' rotation proposal(s)');
  
  const dutyProposal = proposals.find(p => p.consecutiveDutyDays >= 7 || p.prolongedDutyHours >= 12);
  assert(Boolean(dutyProposal), 'Found roster proposal specifically triggered by consecutive or prolonged duty');
  if (dutyProposal) {
    assert(dutyProposal.currentDuty && dutyProposal.recommendedDuty, 'Proposal details pacing from ' + dutyProposal.currentDuty + ' to ' + dutyProposal.recommendedDuty);
    assert(dutyProposal.recommendedRestHours, 'Proposal prescribes mandatory rest: ' + dutyProposal.recommendedRestHours);
  }

  // Final Summary
  console.log('\n===============================================================');
  console.log('  VERIFICATION RESULTS: ' + passedTests + ' PASSED, ' + failedTests + ' FAILED');
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
