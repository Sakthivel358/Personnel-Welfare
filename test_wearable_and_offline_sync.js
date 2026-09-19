/**
 * Verification Suite for Task 9 (Wearable Data Handling & Validation API)
 * and Task 10 (Offline Storage Buffer, Auto-Sync & Deduplication).
 */

const http = require('http');

let authToken = '';

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

async function runTests() {
  console.log('======================================================================');
  console.log('   WelfareAI: Wearable Handling & Offline Synchronization Suite       ');
  console.log('======================================================================\n');

  // Step 0: Authenticate
  console.log('--- Step 0: Authenticate as Personnel (CRPF-9042) ---');
  const loginRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    identifier: 'CRPF-9042',
    password: 'Password@123'
  });

  assert(loginRes.status === 200, 'Login HTTP 200');
  const cookies = parseCookies(loginRes.headers['set-cookie']);
  authToken = cookies['token'] || (loginRes.data.data && loginRes.data.data.token);
  assert(Boolean(authToken), 'Auth token acquired');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `token=${authToken}`,
    'Authorization': `Bearer ${authToken}`
  };

  // Step 1: Valid Wearable Telemetry Ingestion (Task 9)
  console.log('\n--- Step 1: Ingest Valid Wearable Telemetry (Task 9) ---');
  const validPacket = {
    deviceId: 'TACTICAL-SMART-JACKET-01',
    deviceType: 'TACTICAL_SMART_JACKET',
    idempotencyKey: 'test-key-wb-001',
    timestamp: new Date().toISOString(),
    batteryLevel: 85,
    signalQuality: 92,
    telemetry: {
      resting_heart_rate: 68,
      hrv_ms: 58,
      respiration_rate: 15,
      skin_temperature_c: 36.6,
      fatigue_physical_strain: 35,
      activity_movement: 'MODERATE_PATROL',
      posture_inactivity: 'NORMAL_MOBILITY'
    }
  };

  const validRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/wearable/ingest',
    method: 'POST',
    headers: authHeaders
  }, validPacket);

  assert(validRes.status === 201, `Valid packet returns 201 Created (Got ${validRes.status})`);
  assert(validRes.data.success === true, 'Response success is true');
  assert(validRes.data.isDuplicate === false, 'Marked as non-duplicate');
  assert(validRes.data.data.telemetry.resting_heart_rate === 68, 'Preserved resting_heart_rate 68');

  // Step 2: Validation Range Guards - Invalid Biometrics Rejected (Task 9)
  console.log('\n--- Step 2: Validate Data & Reject Invalid Biometrics (Task 9) ---');
  
  // 2a. Impossible Heart Rate (e.g. 15 BPM or 280 BPM)
  const invalidHrPacket = {
    deviceId: 'TACTICAL-SMART-JACKET-01',
    deviceType: 'TACTICAL_SMART_JACKET',
    telemetry: {
      resting_heart_rate: 15, // Out of physiological range [30-220]
      hrv_ms: 50
    }
  };
  const invalidHrRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/wearable/ingest',
    method: 'POST',
    headers: authHeaders
  }, invalidHrPacket);

  assert(invalidHrRes.status === 400, `Impossible HR (15 bpm) rejected with 400 Bad Request (Got ${invalidHrRes.status})`);
  assert(invalidHrRes.data.success === false, 'Invalid HR response success is false');
  assert(invalidHrRes.data.errors.some(e => e.includes('resting_heart_rate')), 'Error mentions resting_heart_rate constraint');

  // 2b. Impossible Skin Temperature (e.g. 52.0 °C)
  const invalidTempPacket = {
    deviceId: 'TACTICAL-SMART-JACKET-01',
    deviceType: 'TACTICAL_SMART_JACKET',
    telemetry: {
      skin_temperature_c: 52.0 // Out of range [30.0-43.0]
    }
  };
  const invalidTempRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/wearable/ingest',
    method: 'POST',
    headers: authHeaders
  }, invalidTempPacket);

  assert(invalidTempRes.status === 400, `Impossible Temp (52°C) rejected with 400 Bad Request (Got ${invalidTempRes.status})`);
  assert(invalidTempRes.data.errors.some(e => e.includes('skin_temperature_c')), 'Error mentions skin_temperature_c constraint');

  // 2c. Invalid Device Metadata
  const invalidDevicePacket = {
    deviceId: '??bad device!!',
    deviceType: 'NON_EXISTENT_DEVICE_TYPE',
    telemetry: { resting_heart_rate: 70 }
  };
  const invalidDevRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/wearable/ingest',
    method: 'POST',
    headers: authHeaders
  }, invalidDevicePacket);

  assert(invalidDevRes.status === 400, `Invalid device metadata rejected with 400 (Got ${invalidDevRes.status})`);

  // Step 3: Wearable Ingestion Idempotency & Deduplication (Task 9 & 10)
  console.log('\n--- Step 3: Wearable Ingestion Idempotency & Deduplication (Tasks 9 & 10) ---');
  const dupWbRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/wearable/ingest',
    method: 'POST',
    headers: authHeaders
  }, validPacket); // Same packet with idempotencyKey: 'test-key-wb-001'

  assert(dupWbRes.status === 200, `Duplicate packet returns HTTP 200 OK (Got ${dupWbRes.status})`);
  assert(dupWbRes.data.isDuplicate === true, 'isDuplicate flag is true');
  assert(dupWbRes.data.data._id === validRes.data.data._id, 'Returns existing record without creating duplicate');

  // Step 4: Wearable Latest & History API
  console.log('\n--- Step 4: Wearable Latest & History API ---');
  const latestRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/wearable/latest',
    method: 'GET',
    headers: authHeaders
  });

  assert(latestRes.status === 200, 'Latest wearable endpoint returns 200');
  assert(latestRes.data.data !== null, 'Latest wearable data is returned');
  assert(latestRes.data.data.deviceId === 'TACTICAL-SMART-JACKET-01', 'Correct deviceId returned');

  const historyRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/wearable/history?limit=10',
    method: 'GET',
    headers: authHeaders
  });

  assert(historyRes.status === 200, 'Wearable history endpoint returns 200');
  assert(Array.isArray(historyRes.data.data), 'History returns an array');
  assert(historyRes.data.data.length >= 1, 'History contains at least 1 record');

  // Step 5: Check-in Idempotency & Duplicate Prevention (Task 10)
  console.log('\n--- Step 5: Check-in Idempotency & Duplicate Prevention (Task 10) ---');
  const offlineCheckInKey = 'chk-offline-vault-test-999';
  const offlineCheckInPayload = {
    idempotencyKey: offlineCheckInKey,
    workload_hours: 50,
    work_pressure_rating: 6,
    shift_continuity_days: 3,
    prolonged_duty_hours: 8,
    night_duty_hours: 8,
    recovery_sleep_hours: 7.0,
    rest_interval_hours: 10,
    recovery_pattern: 'BALANCED_CIRCADIAN',
    social_support_rating: 7,
    work_life_balance_rating: 7,
    notes: 'Testing offline check-in idempotency'
  };

  // 5a. Initial submission
  const checkin1Res = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: authHeaders
  }, offlineCheckInPayload);

  assert(checkin1Res.status === 201, `First check-in submission returns 201 (Got ${checkin1Res.status})`);
  assert(checkin1Res.data.isDuplicate !== true, 'First submission is not duplicate');
  const originalCheckInId = checkin1Res.data.data.checkIn._id;

  // 5b. Re-synchronization of same check-in (simulating offline sync duplicate)
  const checkin2Res = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin',
    method: 'POST',
    headers: authHeaders
  }, offlineCheckInPayload);

  assert(checkin2Res.status === 200, `Duplicate sync check-in returns HTTP 200 (Got ${checkin2Res.status})`);
  assert(checkin2Res.data.isDuplicate === true, 'Duplicate sync marked with isDuplicate: true');
  assert(checkin2Res.data.data.checkIn._id === originalCheckInId, 'Duplicate check-in points to original record');

  // Step 6: Batch Synchronization Endpoints (Task 10)
  console.log('\n--- Step 6: Batch Synchronization Endpoints (Task 10) ---');

  // 6a. Check-in Batch Sync
  const batchCheckInPayload = {
    items: [
      offlineCheckInPayload, // Already existing -> should be duplicate
      {
        idempotencyKey: 'chk-offline-sync-new-1',
        workload_hours: 45,
        work_pressure_rating: 5,
        shift_continuity_days: 2,
        prolonged_duty_hours: 8,
        night_duty_hours: 0,
        recovery_sleep_hours: 7.5,
        rest_interval_hours: 12,
        recovery_pattern: 'BALANCED_CIRCADIAN',
        social_support_rating: 8,
        work_life_balance_rating: 8,
        notes: 'New check-in in sync batch'
      }
    ]
  };

  const syncCheckInRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/checkin/sync',
    method: 'POST',
    headers: authHeaders
  }, batchCheckInPayload);

  assert(syncCheckInRes.status === 200, `Check-in batch sync returns 200 (Got ${syncCheckInRes.status})`);
  assert(syncCheckInRes.data.syncedCount === 1, `1 new check-in synced (Got ${syncCheckInRes.data.syncedCount})`);
  assert(syncCheckInRes.data.duplicateCount === 1, `1 duplicate check-in safely prevented (Got ${syncCheckInRes.data.duplicateCount})`);

  // 6b. Wearable Batch Sync
  const batchWearablePayload = {
    items: [
      validPacket, // Already existing -> should be duplicate
      {
        deviceId: 'TACTICAL-SMART-JACKET-01',
        deviceType: 'TACTICAL_SMART_JACKET',
        idempotencyKey: 'wb-batch-sync-new-1',
        timestamp: new Date().toISOString(),
        telemetry: {
          resting_heart_rate: 72,
          hrv_ms: 52,
          respiration_rate: 16,
          skin_temperature_c: 36.7,
          fatigue_physical_strain: 40
        }
      },
      {
        deviceId: 'TACTICAL-SMART-JACKET-01',
        deviceType: 'TACTICAL_SMART_JACKET',
        idempotencyKey: 'wb-batch-sync-invalid',
        telemetry: {
          resting_heart_rate: 350 // Invalid -> should be rejected
        }
      }
    ]
  };

  const syncWbRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/wearable/sync',
    method: 'POST',
    headers: authHeaders
  }, batchWearablePayload);

  assert(syncWbRes.status === 200, `Wearable batch sync returns 200 (Got ${syncWbRes.status})`);
  assert(syncWbRes.data.syncedCount === 1, `1 new wearable packet synced (Got ${syncWbRes.data.syncedCount})`);
  assert(syncWbRes.data.duplicateCount === 1, `1 duplicate wearable packet prevented (Got ${syncWbRes.data.duplicateCount})`);
  assert(syncWbRes.data.rejectedCount === 1, `1 invalid wearable packet rejected (Got ${syncWbRes.data.rejectedCount})`);

  console.log('\n======================================================================');
  console.log(`Test Execution Summary: ${passed} Passed, ${failed} Failed.`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
