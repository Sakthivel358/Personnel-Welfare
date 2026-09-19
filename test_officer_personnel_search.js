/**
 * test_officer_personnel_search.js
 * Verification suite for Welfare Officer Personnel Search & RBAC Enforcement.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const API_V1 = 'http://127.0.0.1:5000/api/v1';

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
  console.log(' Welfare Officer Personnel Search Verification Suite   ');
  console.log('======================================================\n');

  // Suite 1: Frontend Structure & Elements
  console.log('--- Suite 1: Frontend Search UI & State Markup ---');
  const officerHtml = fs.readFileSync(path.join(__dirname, 'frontend', 'welfare-officer.html'), 'utf8');
  assert(officerHtml.includes('id="officer-personnel-search-input"'), 'welfare-officer.html contains personnel search input');
  assert(officerHtml.includes('id="btn-officer-search"'), 'welfare-officer.html contains search submission button');
  assert(officerHtml.includes('id="search-state-empty"'), 'welfare-officer.html defines initial empty state container');
  assert(officerHtml.includes('id="search-state-notfound"'), 'welfare-officer.html defines not found state container');
  assert(officerHtml.includes('id="search-state-loading"'), 'welfare-officer.html defines loading spinner state container');
  assert(officerHtml.includes('id="search-state-results"'), 'welfare-officer.html defines dynamic search results container');

  const officerJs = fs.readFileSync(path.join(__dirname, 'frontend', 'js', 'officer.js'), 'utf8');
  assert(officerJs.includes('function handlePersonnelSearch'), 'officer.js defines handlePersonnelSearch()');
  assert(officerJs.includes('function resetPersonnelSearch'), 'officer.js defines resetPersonnelSearch()');
  assert(officerJs.includes('function renderPersonnelSearchResults'), 'officer.js defines renderPersonnelSearchResults()');

  const apiJs = fs.readFileSync(path.join(__dirname, 'frontend', 'js', 'api.js'), 'utf8');
  assert(apiJs.includes('searchOfficerPersonnel'), 'api.js defines searchOfficerPersonnel client method');

  // Suite 2: RBAC Enforcement
  console.log('\n--- Suite 2: Welfare Officer RBAC & Security Guard ---');
  // 1. Unauthenticated
  const unauthRes = await fetchJson(`${API_V1}/officer/personnel/search?q=CRPF-9042`);
  assert(unauthRes.status === 401, 'Unauthenticated request to personnel search rejected with HTTP 401');

  // 2. Authenticate Personnel member
  const pLogin = await fetchJson(`${API_V1}/auth/login`, {
    method: 'POST',
    body: { identifier: 'CRPF-9042', password: 'Password@123' }
  });
  assert(pLogin.status === 200, 'Personnel member logged in successfully');
  const pToken = pLogin.data.token;

  // Personnel should get 403 Forbidden
  const pSearchRes = await fetchJson(`${API_V1}/officer/personnel/search?q=CRPF-9042`, {
    headers: { Authorization: `Bearer ${pToken}` }
  });
  assert(pSearchRes.status === 403, 'Regular Personnel member denied access to officer personnel search (HTTP 403 Forbidden)');
  assert(pSearchRes.data.code === 'FORBIDDEN_ROLE', 'RBAC response declares code: FORBIDDEN_ROLE');

  // 3. Authenticate Welfare Officer
  const woLogin = await fetchJson(`${API_V1}/auth/login`, {
    method: 'POST',
    body: { identifier: 'WO-101', password: 'Password@123' }
  });
  assert(woLogin.status === 200, 'Welfare Officer (WO-101) logged in successfully');
  const woToken = woLogin.data.token;

  // Suite 3: Search Functionality & Data Integrity
  console.log('\n--- Suite 3: Personnel Record Search & Empty / Not Found States ---');

  // 1. Empty query
  const emptyQueryRes = await fetchJson(`${API_V1}/officer/personnel/search`, {
    headers: { Authorization: `Bearer ${woToken}` }
  });
  assert(emptyQueryRes.status === 200, 'Empty query handled gracefully with HTTP 200');
  assert(emptyQueryRes.data.count === 0, 'Empty query returns 0 records');
  assert(emptyQueryRes.data.data.length === 0, 'Empty query data array is empty');

  // 2. Non-existent ID (Not Found state)
  const notFoundRes = await fetchJson(`${API_V1}/officer/personnel/search?q=NONEXISTENT-99999`, {
    headers: { Authorization: `Bearer ${woToken}` }
  });
  assert(notFoundRes.status === 200, 'Not found search handled with HTTP 200');
  assert(notFoundRes.data.count === 0, 'Not found search returns count: 0');
  assert(notFoundRes.data.data.length === 0, 'Not found search data is empty array');
  assert(notFoundRes.data.message.includes('No authorized personnel record matching'), 'API returns descriptive not-found message');

  // 3. Exact matching ID (CRPF-9042)
  const matchRes = await fetchJson(`${API_V1}/officer/personnel/search?q=CRPF-9042`, {
    headers: { Authorization: `Bearer ${woToken}` }
  });
  assert(matchRes.status === 200, 'Valid personnel query returned HTTP 200');
  assert(matchRes.data.success === true, 'Response declares success: true');
  assert(matchRes.data.count >= 1, 'Matching record returned (count >= 1)');

  const person = matchRes.data.data[0];
  assert(person.personnelId === 'CRPF-9042', 'Returned record has personnelId: CRPF-9042');
  assert(Boolean(person.fullName), `Record contains authorized fullName: "${person.fullName}"`);
  assert(Boolean(person.rank), `Record contains authorized rank: "${person.rank}"`);
  assert(Boolean(person.unit), `Record contains authorized unit: "${person.unit}"`);
  assert(person.isEnrolledInWelfare === true, 'Record confirms welfare program enrollment');
  assert(Boolean(person.welfareStatus), 'Record contains welfareStatus object');
  assert(person.welfareStatus.concernLevel !== undefined, `Record contains concernLevel: ${person.welfareStatus.concernLevel}`);
  assert(typeof person.totalCheckinsCount === 'number', `Record tracks completed check-ins count: ${person.totalCheckinsCount}`);

  // 4. Case-insensitivity test
  const lowerCaseRes = await fetchJson(`${API_V1}/officer/personnel/search?q=crpf-9042`, {
    headers: { Authorization: `Bearer ${woToken}` }
  });
  assert(lowerCaseRes.status === 200 && lowerCaseRes.data.count >= 1, 'Search is case-insensitive (crpf-9042 matches CRPF-9042)');

  // 5. Substring ID search
  const subIdRes = await fetchJson(`${API_V1}/officer/personnel/search?q=9042`, {
    headers: { Authorization: `Bearer ${woToken}` }
  });
  assert(subIdRes.status === 200 && subIdRes.data.count >= 1, 'Search matches numeric suffix (9042 matches CRPF-9042)');

  // 6. Direct ID route test (/personnel/:id)
  const directIdRes = await fetchJson(`${API_V1}/officer/personnel/CRPF-9042`, {
    headers: { Authorization: `Bearer ${woToken}` }
  });
  assert(directIdRes.status === 200 && directIdRes.data.count >= 1, 'Direct route /officer/personnel/:id functions correctly');

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
