/**
 * Test Suite: Task 43 — Security & Complete System Integration
 * Validates:
 * 1. Full pipeline: Frontend/Client -> Backend -> Database -> ML -> Backend -> Frontend
 * 2. Privilege Escalation Prevention on registration
 * 3. Role-Based Access Control (RBAC) & IDOR Protection across personnel/officer
 * 4. Rate Limiting protection & headers on auth routes
 * 5. Strict CORS whitelisting & security headers
 * 6. Elimination of hard-coded demo units and ranks
 * 7. Sensitive data protection (no password leaks, token revocation on logout)
 */

const http = require('http');

const BACKEND_PORT = 5000;
const ML_PORT = 8000;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: BACKEND_PORT,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (_) {
            parsed = data;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed
          });
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runTests() {
  console.log('==================================================================');
  console.log('🚀 TASK 43: SECURITY & COMPLETE INTEGRATION VERIFICATION SUITE');
  console.log('==================================================================\n');

  const randId = Math.floor(100000 + Math.random() * 900000);

  // -------------------------------------------------------------
  // TEST 1: Privilege Escalation Prevention on Registration
  // -------------------------------------------------------------
  console.log('🔹 [SECURITY] 1. Testing Privilege Escalation Prevention...');

  // Attempt 1: Regular public user tries to self-elevate to ADMIN without secret
  const rogueAdminRes = await makeRequest('POST', '/api/v1/auth/register', {
    personnelId: `ROGUE_ADM_${randId}`,
    email: `rogue_${randId}@welfare.mil.in`,
    password: 'Password123!',
    confirmPassword: 'Password123!',
    fullName: `Rogue Escalation ${randId}`,
    role: 'ADMIN' // Unauthorized attempt
  });

  assert(rogueAdminRes.status === 201, 'Registration accepted without server crash');
  assert(
    rogueAdminRes.body?.user?.role === 'PERSONNEL',
    `Unauthorized ADMIN attempt successfully demoted to PERSONNEL (received: ${rogueAdminRes.body?.user?.role})`
  );

  // Attempt 2: Authorized Admin registration with valid adminSecret
  const legitimateAdminRes = await makeRequest('POST', '/api/v1/auth/register', {
    personnelId: `SECURE_ADM_${randId}`,
    email: `sec_adm_${randId}@welfare.mil.in`,
    password: 'AdminPassword123!',
    confirmPassword: 'AdminPassword123!',
    fullName: `Authorized Administrator ${randId}`,
    role: 'ADMIN',
    adminSecret: 'welfare-secure-admin-key-2026'
  });

  assert(legitimateAdminRes.status === 201, 'Legitimate Admin registration succeeded');
  assert(legitimateAdminRes.body?.user?.role === 'ADMIN', 'Authorized Admin assigned role ADMIN');
  const adminToken = legitimateAdminRes.body?.token;

  // Attempt 3: Officer registration with test ID format
  const officerRes = await makeRequest('POST', '/api/v1/auth/register', {
    personnelId: `TEST_WO_${randId}`,
    email: `sec_wo_${randId}@welfare.mil.in`,
    password: 'OfficerPassword123!',
    confirmPassword: 'OfficerPassword123!',
    fullName: `Unit Welfare Officer ${randId}`,
    role: 'WELFARE_OFFICER'
  });

  assert(officerRes.status === 201, 'Officer account created successfully');
  assert(officerRes.body?.user?.role === 'WELFARE_OFFICER', 'Officer assigned role WELFARE_OFFICER');
  const officerToken = officerRes.body?.token;

  // -------------------------------------------------------------
  // TEST 2: Dynamic Data & Removal of Hardcoded Units/Ranks
  // -------------------------------------------------------------
  console.log('\n🔹 [DATA INTEGRATION] 2. Testing Removal of Hardcoded Unit/Rank Values...');

  const customPersonnelRes = await makeRequest('POST', '/api/v1/auth/register', {
    personnelId: `PERS_CUST_${randId}`,
    email: `cust_${randId}@welfare.mil.in`,
    password: 'Password123!',
    confirmPassword: 'Password123!',
    fullName: 'Captain Rajesh Varma',
    role: 'PERSONNEL',
    unit: '84th Mountain Brigade (Leh Sector)',
    rank: 'Captain'
  });

  assert(customPersonnelRes.status === 201, 'Custom personnel account registered');
  const customPersonnelToken = customPersonnelRes.body?.token;

  // Check /api/v1/profile to ensure real database values are returned
  const profileRes = await makeRequest('GET', '/api/v1/profile', null, {
    Authorization: `Bearer ${customPersonnelToken}`
  });

  assert(profileRes.status === 200, 'Profile endpoint returned 200 OK');
  assert(profileRes.body?.data?.unit === '84th Mountain Brigade (Leh Sector)', 'Profile reflects actual unit instead of hardcoded default');
  assert(profileRes.body?.data?.rank === 'Captain', 'Profile reflects actual rank instead of hardcoded default');

  // -------------------------------------------------------------
  // TEST 3: Full Pipeline E2E (Frontend -> Backend -> DB -> ML -> Backend -> Frontend)
  // -------------------------------------------------------------
  console.log('\n🔹 [PIPELINE] 3. Testing Full Pipeline E2E Integration (Client -> Node -> FastAPI -> DB)...');

  const checkinPayload = {
    workload_hours: 58,
    work_pressure_rating: 8,
    recovery_sleep_hours: 5.0,
    resting_heart_rate: 88,
    hrv_ms: 32,
    respiration_rate: 20,
    prolonged_duty_hours: 14,
    night_duty_hours: 22,
    shift_continuity_days: 7,
    duty_type: 'Quick Reaction Force Patrol',
    deploymentZone: 'Remote High Altitude',
    wearable_synced: true,
    idempotencyKey: `idemp-sec-${randId}`
  };

  const checkinRes = await makeRequest('POST', '/api/v1/checkin', checkinPayload, {
    Authorization: `Bearer ${customPersonnelToken}`
  });

  assert(checkinRes.status === 201, 'Check-in successfully processed through pipeline');
  assert(checkinRes.body?.data?.checkIn?._id, 'Check-in persisted in MongoDB/Datastore with unique ID');
  assert(checkinRes.body?.data?.prediction?._id, 'Prediction persisted in database');
  assert(checkinRes.body?.data?.welfareConcernDisplay, `Welfare concern calculated and structured (${checkinRes.body?.data?.welfareConcernDisplay})`);
  assert(checkinRes.body?.data?.evidenceStrength, `Evidence strength evaluated (${checkinRes.body?.data?.evidenceStrength})`);
  assert(checkinRes.body?.data?.dataAvailableCount >= 3, `Data sources counted (${checkinRes.body?.data?.dataAvailableCount}/5 available)`);

  const checkInId = checkinRes.body?.data?.checkIn?._id;

  // -------------------------------------------------------------
  // TEST 4: RBAC & IDOR (Insecure Direct Object Reference) Protection
  // -------------------------------------------------------------
  console.log('\n🔹 [RBAC & IDOR] 4. Testing Check-in Access Control...');

  // Setup Personnel B
  const personnelBRes = await makeRequest('POST', '/api/v1/auth/register', {
    personnelId: `PERS_B_${randId}`,
    email: `pers_b_${randId}@welfare.mil.in`,
    password: 'Password123!',
    confirmPassword: 'Password123!',
    fullName: 'Constable Suresh Patel',
    role: 'PERSONNEL'
  });
  const personnelBToken = personnelBRes.body?.token;

  // Personnel B attempts to view Personnel A's check-in -> MUST return 403
  const idorRes = await makeRequest('GET', `/api/v1/checkin/${checkInId}`, null, {
    Authorization: `Bearer ${personnelBToken}`
  });
  assert(idorRes.status === 403, `IDOR prevented: Personnel cannot view other personnel check-ins (Status: ${idorRes.status})`);

  // Personnel A views own check-in -> MUST return 200
  const ownerRes = await makeRequest('GET', `/api/v1/checkin/${checkInId}`, null, {
    Authorization: `Bearer ${customPersonnelToken}`
  });
  assert(ownerRes.status === 200, 'Owner can view own check-in detail');

  // Welfare Officer views Personnel A's check-in -> MUST return 200 (fixes previous route bug)
  const officerCheckinRes = await makeRequest('GET', `/api/v1/checkin/${checkInId}`, null, {
    Authorization: `Bearer ${officerToken}`
  });
  assert(officerCheckinRes.status === 200, 'Welfare Officer authorized to view personnel check-in for triage');

  // -------------------------------------------------------------
  // TEST 5: Rate Limiting & Auth Route Protection
  // -------------------------------------------------------------
  console.log('\n🔹 [RATE LIMITING] 5. Testing Rate Limiting Headers & Auth Endpoint Protection...');

  const loginAttemptRes = await makeRequest('POST', '/api/v1/auth/login', {
    identifier: `PERS_CUST_${randId}`,
    password: 'Password123!'
  });

  assert(loginAttemptRes.status === 200, 'Login succeeded');
  assert(loginAttemptRes.headers['x-ratelimit-limit'], `RateLimit-Limit header present: ${loginAttemptRes.headers['x-ratelimit-limit']}`);
  assert(loginAttemptRes.headers['x-ratelimit-remaining'], `RateLimit-Remaining header present: ${loginAttemptRes.headers['x-ratelimit-remaining']}`);

  // -------------------------------------------------------------
  // TEST 6: CORS Origin Whitelisting & Security Headers
  // -------------------------------------------------------------
  console.log('\n🔹 [CORS & HEADERS] 6. Testing CORS Origin Whitelisting & Helmet Headers...');

  // Request from authorized origin
  const allowedOriginRes = await makeRequest('OPTIONS', '/api/v1/auth/login', null, {
    Origin: 'http://localhost:5000',
    'Access-Control-Request-Method': 'POST'
  });
  assert(
    allowedOriginRes.headers['access-control-allow-origin'] === 'http://localhost:5000',
    'Authorized origin receives Access-Control-Allow-Origin header'
  );
  assert(
    allowedOriginRes.headers['access-control-allow-credentials'] === 'true',
    'Access-Control-Allow-Credentials header enabled for whitelisted origin'
  );

  // Request from unauthorized foreign origin
  const forbiddenOriginRes = await makeRequest('OPTIONS', '/api/v1/auth/login', null, {
    Origin: 'http://malicious-unauthorized-site.com',
    'Access-Control-Request-Method': 'POST'
  });
  assert(
    !forbiddenOriginRes.headers['access-control-allow-origin'],
    'Unauthorized foreign origin DENIED Access-Control-Allow-Origin header'
  );

  // Check Helmet security headers
  const getMeRes = await makeRequest('GET', '/api/v1/auth/me', null, {
    Authorization: `Bearer ${customPersonnelToken}`
  });
  assert(getMeRes.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff header enforced');
  assert(getMeRes.headers['x-frame-options'] === 'SAMEORIGIN', 'X-Frame-Options: SAMEORIGIN header enforced');

  // -------------------------------------------------------------
  // TEST 7: Sensitive Data Protection & Session Revocation
  // -------------------------------------------------------------
  console.log('\n🔹 [DATA PROTECTION] 7. Testing Sensitive Data Protection & Token Revocation...');

  assert(!customPersonnelRes.body?.user?.password, 'User password is removed from register response');
  assert(!loginAttemptRes.body?.user?.password, 'User password is removed from login response');
  assert(!getMeRes.body?.user?.password, 'User password is removed from auth/me response');

  // Logout and Token Revocation
  const logoutRes = await makeRequest('POST', '/api/v1/auth/logout', null, {
    Authorization: `Bearer ${customPersonnelToken}`
  });
  assert(logoutRes.status === 200, 'Logout succeeded and token registered for revocation');

  // Re-attempt using revoked token -> MUST return 401 SESSION_REVOKED
  const revokedAccessRes = await makeRequest('GET', '/api/v1/auth/me', null, {
    Authorization: `Bearer ${customPersonnelToken}`
  });
  assert(revokedAccessRes.status === 401, `Revoked token access blocked with 401 (Code: ${revokedAccessRes.body?.code})`);

  console.log('\n==================================================================');
  console.log('🎉 ALL SECURITY & INTEGRATION TESTS PASSED PERFECTLY!');
  console.log('==================================================================');
}

runTests().catch((err) => {
  console.error('\n❌ Security verification suite failed:', err);
  process.exit(1);
});
