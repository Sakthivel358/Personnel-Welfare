/**
 * Test Suite: Consent & Data Control (Requirement 7)
 * Tests personnel viewing & updating optional self-check / wearable permissions,
 * data minimization controls (FULL, COARSE, MINIMAL), explanations, and non-punitive guarantees.
 */

const http = require('http');
const assert = require('assert');

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
  console.log('================================================================');
  console.log('🧪 RUNNING TEST SUITE: Consent & Data Control (Requirement 7)');
  console.log('================================================================');

  let passed = 0;
  let total = 0;

  function recordPass(testName) {
    passed++;
    total++;
    console.log(`  ✅ PASS: ${testName}`);
  }

  function recordFail(testName, err) {
    total++;
    console.error(`  ❌ FAIL: ${testName}`, err);
  }

  // Helper login
  async function login(identifier, password) {
    const res = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { identifier, password });
    return res.body.token;
  }

  let personnelToken;
  try {
    personnelToken = await login('CRPF-9042', 'Password@123');
    assert.ok(personnelToken, 'Should receive token');
    recordPass('Authenticate as Personnel (CRPF-9042)');
  } catch (err) {
    recordFail('Authenticate as Personnel', err);
    return;
  }

  // Test 1: Unauthenticated request to GET /privacy/consent should fail (401)
  try {
    const res = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/privacy/consent',
      method: 'GET'
    });
    assert.strictEqual(res.status, 401);
    recordPass('GET /privacy/consent rejects unauthenticated access with 401');
  } catch (err) {
    recordFail('GET /privacy/consent unauthenticated', err);
  }

  // Test 2: GET /privacy/consent with valid personnel token
  try {
    const res = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/privacy/consent',
      method: 'GET',
      headers: { Authorization: `Bearer ${personnelToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data, 'Should return consent data payload');
    assert.ok(res.body.data.consent, 'Should return consent object');
    assert.ok(res.body.data.explanations, 'Should return usage explanations');
    assert.ok(res.body.data.dataMinimizationOptions, 'Should return minimization options');

    const c = res.body.data.consent;
    assert.strictEqual(typeof c.allowSelfCheckData, 'boolean');
    assert.strictEqual(typeof c.allowWearableData, 'boolean');
    assert.strictEqual(typeof c.allowLongitudinalTrends, 'boolean');
    assert.strictEqual(typeof c.anonymousAggregatedStats, 'boolean');
    assert.ok(['FULL', 'COARSE', 'MINIMAL'].includes(c.dataMinimizationLevel));

    // Verify non-punitive explanations
    assert.ok(res.body.data.explanations.nonPunitiveGuarantee.includes('never automatically become a disciplinary action'));
    assert.strictEqual(res.body.data.explanations.voluntaryNature, '100% voluntary with granular per-category opt-in/opt-out');

    recordPass('GET /privacy/consent returns valid consent structure, explanations, and minimization options');
  } catch (err) {
    recordFail('GET /privacy/consent with valid token', err);
  }

  // Test 3: PUT /privacy/consent update permissions and minimization level
  try {
    const updatePayload = {
      allowSelfCheckData: true,
      allowWearableData: false, // Opt out of wearable
      allowLongitudinalTrends: true,
      anonymousAggregatedStats: true,
      dataMinimizationLevel: 'COARSE'
    };

    const res = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/privacy/consent',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${personnelToken}`
      }
    }, updatePayload);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.consent.allowWearableData, false);
    assert.strictEqual(res.body.data.consent.dataMinimizationLevel, 'COARSE');
    assert.strictEqual(res.body.data.consent.personnelId, 'CRPF-9042');
    recordPass('PUT /privacy/consent successfully updates permissions to opt-out wearable and set COARSE minimization');
  } catch (err) {
    recordFail('PUT /privacy/consent update permissions', err);
  }

  // Test 4: Verify persistence via GET /privacy/consent
  try {
    const res = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/privacy/consent',
      method: 'GET',
      headers: { Authorization: `Bearer ${personnelToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.consent.allowWearableData, false);
    assert.strictEqual(res.body.data.consent.dataMinimizationLevel, 'COARSE');
    recordPass('GET /privacy/consent confirms updated consent settings persisted');
  } catch (err) {
    recordFail('GET /privacy/consent confirms updated settings', err);
  }

  // Test 5: Verify minimization levels rejection on invalid enum
  try {
    const res = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/privacy/consent',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${personnelToken}`
      }
    }, { dataMinimizationLevel: 'INVALID_LEVEL' });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.message.includes('FULL, COARSE, MINIMAL'));
    recordPass('PUT /privacy/consent rejects invalid dataMinimizationLevel with 400');
  } catch (err) {
    recordFail('PUT /privacy/consent invalid level test', err);
  }

  // Test 6: Restore default consent preferences
  try {
    const restorePayload = {
      allowSelfCheckData: true,
      allowWearableData: true,
      allowLongitudinalTrends: true,
      anonymousAggregatedStats: true,
      dataMinimizationLevel: 'FULL'
    };
    const res = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/privacy/consent',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${personnelToken}`
      }
    }, restorePayload);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.consent.allowWearableData, true);
    recordPass('PUT /privacy/consent restores standard consent baseline successfully');
  } catch (err) {
    recordFail('PUT /privacy/consent restore default baseline', err);
  }

  console.log('================================================================');
  console.log(`📊 CONSENT & DATA CONTROL RESULTS: ${passed}/${total} Passed (${Math.round((passed/total)*100)}%)`);
  console.log('================================================================\n');

  if (passed !== total) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
