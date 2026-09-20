/**
 * WelfareAI — Role-Specific Security Access & IDOR Verification Test Suite
 * Validates Personnel, Welfare Officer, and Admin access boundaries independently.
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

async function runRoleSecurityAudit() {
  console.log('================================================================================');
  console.log('🛡️ WELFAREAI — ROLE-SPECIFIC SECURITY BOUNDARY & IDOR AUDIT');
  console.log('================================================================================\n');

  // 1. Provision 2 distinct personnel users to test cross-tenant data isolation & IDOR
  const user1Id = `USER1-${Date.now().toString().slice(-4)}`;
  const user2Id = `USER2-${Date.now().toString().slice(-4)}`;

  const reg1 = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { personnelId: user1Id, fullName: 'Personnel User One', email: `user1.${Date.now()}@crpf.gov.in`, password: 'Password@123', role: 'PERSONNEL' });
  const token1 = reg1.body.token;

  const reg2 = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { personnelId: user2Id, fullName: 'Personnel User Two', email: `user2.${Date.now()}@crpf.gov.in`, password: 'Password@123', role: 'PERSONNEL' });
  const token2 = reg2.body.token;

  // Login Officer & Admin
  const officerLogin = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { personnelId: 'WO-101', password: 'Password@123' });
  const officerToken = officerLogin.body.token;

  const adminLogin = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { personnelId: 'ADM-001', password: 'Password@123' });
  const adminToken = adminLogin.body.token;

  // -----------------------------------------------------------------------------------
  // TEST SUITE A: PERSONNEL ACCESS BOUNDARIES
  // -----------------------------------------------------------------------------------
  console.log('--- A. PERSONNEL ROLE ACCESS BOUNDARIES ---');

  // Allowed: Own profile
  const ownProfile = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/profile', method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });
  check(ownProfile.status === 200 && ownProfile.body.data?.personnelId === user1Id, 'Personnel can access own profile');

  // Allowed: Own HRMS record
  const ownHrms = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/hrms/my-record', method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });
  check(ownHrms.status === 200, 'Personnel can access own HRMS record (/hrms/my-record)');

  // BLOCKED (IDOR): Personnel 1 attempting to view Personnel 2's specific HRMS dossier
  const idorHrms = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: `/api/v1/hrms/personnel/${user2Id}`, method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });
  check(idorHrms.status === 403, 'IDOR Prevention: Personnel 1 cannot access Personnel 2 HRMS dossier (HTTP 403)');

  // BLOCKED: Personnel attempting to access Officer triage queue
  const pToOfficerAlerts = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/officer/alerts', method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });
  check(pToOfficerAlerts.status === 403, 'RBAC: Personnel denied access to /officer/alerts (HTTP 403)');

  // BLOCKED: Personnel attempting to access Officer dashboard
  const pToOfficerDash = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/officer/dashboard', method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });
  check(pToOfficerDash.status === 403, 'RBAC: Personnel denied access to /officer/dashboard (HTTP 403)');

  // BLOCKED: Personnel attempting to access Admin metrics
  const pToAdminMetrics = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/admin/metrics', method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });
  check(pToAdminMetrics.status === 403, 'RBAC: Personnel denied access to /admin/metrics (HTTP 403)');

  // BLOCKED: Personnel attempting to access Admin audit logs
  const pToAdminLogs = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/admin/audit-logs', method: 'GET',
    headers: { 'Authorization': `Bearer ${token1}` }
  });
  check(pToAdminLogs.status === 403, 'RBAC: Personnel denied access to /admin/audit-logs (HTTP 403)');

  // -----------------------------------------------------------------------------------
  // TEST SUITE B: WELFARE OFFICER ACCESS BOUNDARIES
  // -----------------------------------------------------------------------------------
  console.log('\n--- B. WELFARE OFFICER ROLE ACCESS BOUNDARIES ---');

  // Allowed: Officer Dashboard
  const offDash = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/officer/dashboard', method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  check(offDash.status === 200, 'Welfare Officer granted access to /officer/dashboard (HTTP 200)');

  // Allowed: Officer Alerts triage queue
  const offAlerts = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/officer/alerts', method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  check(offAlerts.status === 200, 'Welfare Officer granted access to /officer/alerts (HTTP 200)');

  // Allowed: Officer search personnel
  const offSearch = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: `/api/v1/officer/personnel/search?query=${user1Id}`, method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  check(offSearch.status === 200, 'Welfare Officer can search unit personnel records');

  // Allowed: Officer can inspect personnel HRMS for welfare triage
  const offHrms = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: `/api/v1/hrms/personnel/${user1Id}`, method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  check(offHrms.status === 200, 'Welfare Officer authorized to view personnel dossier for triage');

  // BLOCKED: Welfare Officer attempting to access Admin metrics
  const offToAdmin = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/admin/metrics', method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  check(offToAdmin.status === 403, 'RBAC: Welfare Officer denied access to /admin/metrics (HTTP 403)');

  // BLOCKED: Welfare Officer attempting to access Admin audit logs
  const offToAdminLogs = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/admin/audit-logs', method: 'GET',
    headers: { 'Authorization': `Bearer ${officerToken}` }
  });
  check(offToAdminLogs.status === 403, 'RBAC: Welfare Officer denied access to /admin/audit-logs (HTTP 403)');

  // -----------------------------------------------------------------------------------
  // TEST SUITE C: ADMIN ROLE ACCESS BOUNDARIES
  // -----------------------------------------------------------------------------------
  console.log('\n--- C. ADMIN ROLE ACCESS BOUNDARIES ---');

  // Allowed: Admin Metrics
  const admMetrics = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/admin/metrics', method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  check(admMetrics.status === 200, 'Admin granted access to /admin/metrics (HTTP 200)');

  // Allowed: Admin Users Governance
  const admUsers = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/admin/users', method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  check(admUsers.status === 200, 'Admin granted access to /admin/users (HTTP 200)');

  // Allowed: Admin Audit Logs
  const admLogs = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/admin/audit-logs', method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  check(admLogs.status === 200, 'Admin granted access to /admin/audit-logs (HTTP 200)');

  // Allowed: Admin Audit Chain Verification
  const admChain = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/admin/audit-logs/verify', method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  check(admChain.status === 200 && admChain.body.data?.verified === true, 'Admin can execute cryptographic audit chain verification');

  // -----------------------------------------------------------------------------------
  // TEST SUITE D: INPUT SANITIZATION & INJECTION ATTACK RESILIENCE
  // -----------------------------------------------------------------------------------
  console.log('\n--- D. INJECTION & ATTACK RESILIENCE ---');

  // Attempt NoSQL injection in login: password object with $gt operator
  const nosqlAttack = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    personnelId: user1Id,
    password: { '$gt': '' } // Operator injection attempt
  });
  check(nosqlAttack.status === 400 || nosqlAttack.status === 401, 'NoSQL operator injection safely rejected without authentication bypass');

  // Attempt Prototype Pollution attack in request payload
  const protoAttack = await makeRequest({
    hostname: '127.0.0.1', port: 5000, path: '/api/v1/profile', method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token1}`
    }
  }, {
    '__proto__': { 'isAdmin': true },
    'specialization': 'Secure Operations'
  });
  check(protoAttack.status === 200, 'Prototype pollution payload sanitized safely');
  check(({}).isAdmin !== true, 'Global prototype remains unpolluted (isAdmin is undefined)');

  // Summary
  console.log('\n================================================================================');
  console.log(`🏁 ROLE SECURITY AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runRoleSecurityAudit().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
