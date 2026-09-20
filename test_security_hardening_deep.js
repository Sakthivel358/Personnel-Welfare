/**
 * WelfareAI — Defense-in-Depth Security Hardening Test Suite
 * Validates Security Headers, Anti-Caching, Tamper-Evident Hash-Chain, MFA Architecture, and RBAC Logging.
 */

const http = require('http');
const assert = require('assert');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const body = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
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

let passed = 0;
let failed = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runSecurityHardeningTests() {
  console.log('================================================================================');
  console.log('🔒 WELFAREAI — DEFENSE-IN-DEPTH SECURITY HARDENING TEST SUITE');
  console.log('================================================================================\n');

  // 1. Security Response Headers & Anti-Caching
  console.log('--- 1. Security Response Headers & Anti-Caching ---');
  const headersRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/system/health',
    method: 'GET'
  });

  check(headersRes.headers['x-content-type-options'] === 'nosniff', 'Header X-Content-Type-Options is nosniff');
  check(headersRes.headers['x-frame-options'] === 'SAMEORIGIN', 'Header X-Frame-Options is SAMEORIGIN');
  check(headersRes.headers['referrer-policy'] === 'strict-origin-when-cross-origin', 'Header Referrer-Policy is strict-origin-when-cross-origin');
  check(Boolean(headersRes.headers['permissions-policy']), 'Header Permissions-Policy is configured');
  check(Boolean(headersRes.headers['content-security-policy']), 'Content-Security-Policy (CSP) is active');
  check(headersRes.headers['cache-control']?.includes('no-store'), 'Sensitive API Cache-Control includes no-store');
  check(headersRes.headers['cache-control']?.includes('no-cache'), 'Sensitive API Cache-Control includes no-cache');
  check(headersRes.headers['cache-control']?.includes('private'), 'Sensitive API Cache-Control includes private');

  // 2. Authentication, Login Failure Logging & MFA Architecture
  console.log('\n--- 2. Authentication & MFA-Ready Architecture ---');
  const secUser = `SEC-${Date.now().toString().slice(-4)}`;
  const secEmail = `sec.${Date.now()}@crpf.gov.in`;
  const secPass = 'ComplexSecPassword@2026';

  // Register
  const regRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    personnelId: secUser,
    fullName: 'Security Test Inspector',
    email: secEmail,
    password: secPass,
    role: 'PERSONNEL'
  });
  check(regRes.status === 201, 'User registered successfully');

  // Attempt login with bad password -> verify 401 & failure audit log
  const badLogin = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    personnelId: secUser,
    password: 'WrongPassword@123'
  });
  check(badLogin.status === 401, 'Invalid password rejected with HTTP 401');

  // Successful login
  const loginRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    personnelId: secUser,
    password: secPass
  });
  check(loginRes.status === 200, 'Valid login returns HTTP 200');
  check(loginRes.body.mfaReady === true, 'Login payload confirms mfaReady: true architecture');
  const secToken = loginRes.body.token;

  // Test MFA Setup
  const setupMfaRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/mfa/setup',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${secToken}` }
  });
  check(setupMfaRes.status === 200, 'POST /auth/mfa/setup returns HTTP 200');
  check(Boolean(setupMfaRes.body.data?.verificationCode), 'MFA setup issued verification code');

  // Test MFA Activation
  const code = setupMfaRes.body.data?.verificationCode;
  const activateMfaRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/mfa/verify',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secToken}`
    }
  }, { code });
  check(activateMfaRes.status === 200, 'POST /auth/mfa/verify activated MFA successfully');
  check(activateMfaRes.body.mfaEnabled === true, 'MFA status updated to mfaEnabled: true');

  // Test Login with MFA Required
  const mfaChallengeLogin = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    personnelId: secUser,
    password: secPass
  });
  check(mfaChallengeLogin.status === 200, 'Login with MFA-enrolled user returns HTTP 200 challenge');
  check(mfaChallengeLogin.body.mfaRequired === true, 'Login challenge confirms mfaRequired: true');

  // Login with invalid MFA code
  const mfaBadLogin = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    personnelId: secUser,
    password: secPass,
    mfaCode: '000000'
  });
  check(mfaBadLogin.status === 401, 'Invalid MFA code correctly rejected with HTTP 401');

  // Login with valid MFA code
  const mfaGoodLogin = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    personnelId: secUser,
    password: secPass,
    mfaCode: code
  });
  check(mfaGoodLogin.status === 200, 'Valid MFA code completes authentication (HTTP 200)');
  check(Boolean(mfaGoodLogin.body.token), 'Authenticated session JWT issued after MFA verification');

  // 3. Tamper-Evident Cryptographic Hash-Chain Audit Trail
  console.log('\n--- 3. Tamper-Evident Cryptographic Hash-Chain Audit Trail ---');
  // Login as Admin
  const adminLogin = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    personnelId: 'ADM-001',
    password: 'Password@123'
  });
  const adminToken = adminLogin.body.token;

  const chainVerifyRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/admin/audit-logs/verify',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  check(chainVerifyRes.status === 200, 'Admin GET /admin/audit-logs/verify returns HTTP 200');
  check(chainVerifyRes.body.data?.verified === true, 'Cryptographic audit hash-chain verified: verified=true');
  check(chainVerifyRes.body.data?.status === 'TAMPER_FREE_VERIFIED', 'Audit trail integrity status is TAMPER_FREE_VERIFIED');
  check(Boolean(chainVerifyRes.body.data?.headHash), 'Head hash verified in chain verification response');

  // Check that audit logs themselves contain cryptographic hashes
  const logsRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/admin/audit-logs',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const recentLogs = logsRes.body.data || [];
  const chainedRecord = recentLogs.find(l => l.hash && l.previousHash);
  check(Boolean(chainedRecord), 'Audit record contains cryptographic hash and previousHash reference');
  check(chainedRecord?.hash?.length === 64, 'Record hash is standard SHA-256 (64 hex characters)');

  // 4. Strict RBAC Logging & Unauthorized Access Tracking
  console.log('\n--- 4. Strict RBAC Logging & Unauthorized Access Tracking ---');
  const unauthorizedRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/admin/audit-logs/verify',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${secToken}` }
  });
  check(unauthorizedRes.status === 403, 'Personnel attempting Admin endpoint rejected with HTTP 403');
  check(unauthorizedRes.body.code === 'FORBIDDEN_ROLE', 'Rejection code confirmed as FORBIDDEN_ROLE');

  // Summary
  console.log('\n================================================================================');
  console.log(`🏁 SECURITY HARDENING TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityHardeningTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
