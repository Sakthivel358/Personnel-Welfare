/**
 * Verification Test Suite: Tasks 41 & 42
 * Task 41: Professional UI Redesign (Navy/slate foundation, restrained status colors, no AI gradients/glows)
 * Task 42: Responsive Design (Mobile, Large Mobile, Tablet, Desktop, Sidebar drawer with backdrop, Table responsiveness)
 */

const fs = require('fs');
const path = require('path');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    testsFailed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTestSuite() {
  console.log('=== Running Test Suite: Professional UI Redesign & Responsive Design ===\n');

  const frontendDir = path.join(__dirname, 'frontend');
  const cssDir = path.join(frontendDir, 'css');
  const jsDir = path.join(frontendDir, 'js');

  const mainCss = fs.readFileSync(path.join(cssDir, 'main.css'), 'utf-8');
  const dashboardCss = fs.readFileSync(path.join(cssDir, 'dashboard.css'), 'utf-8');
  const landingCss = fs.readFileSync(path.join(cssDir, 'landing.css'), 'utf-8');
  const authJs = fs.readFileSync(path.join(jsDir, 'auth.js'), 'utf-8');
  const chartsJs = fs.readFileSync(path.join(jsDir, 'charts.js'), 'utf-8');

  // --- TASK 41: PROFESSIONAL UI REDESIGN ---
  console.log('--- 1. Task 41: Design System & Token Integrity ---');

  assert(!mainCss.includes('--accent-glow'), 'main.css does not contain --accent-glow');
  assert(!dashboardCss.includes('--accent-glow'), 'dashboard.css does not contain --accent-glow');
  assert(!landingCss.includes('--accent-glow'), 'landing.css does not contain --accent-glow');

  assert(!mainCss.includes('linear-gradient'), 'main.css does not use multi-color linear-gradients');
  assert(!dashboardCss.includes('linear-gradient'), 'dashboard.css does not use multi-color linear-gradients');
  assert(!landingCss.includes('linear-gradient'), 'landing.css does not use multi-color linear-gradients');

  assert(!mainCss.includes('radial-gradient'), 'main.css does not use radial-gradients');
  assert(!dashboardCss.includes('radial-gradient'), 'dashboard.css does not use radial-gradient on meters');
  assert(!landingCss.includes('radial-gradient'), 'landing.css does not use radial-gradients');

  // Verify dark navy / slate foundation tokens
  assert(mainCss.includes('#0b0f19') && mainCss.includes('#0f172a'), 'main.css defines dark navy/slate foundation (#0b0f19, #0f172a)');
  assert(dashboardCss.includes('#0f172a') && dashboardCss.includes('#1e293b'), 'dashboard.css uses dark navy/slate sidebar foundation');

  // Verify restrained status color tokens
  assert(mainCss.includes('--risk-low: #059669') || mainCss.includes('--risk-low: #10b981'), 'main.css defines restrained Low concern color');
  assert(mainCss.includes('--risk-mod: #d97706') || mainCss.includes('--risk-mod: #f59e0b'), 'main.css defines restrained Moderate concern color');
  assert(mainCss.includes('--risk-high: #e11d48') || mainCss.includes('--risk-high: #f43f5e'), 'main.css defines restrained High concern color');

  // Verify solid enterprise button styling
  assert(mainCss.includes('.btn-primary') && mainCss.includes('background-color: var(--primary)'), 'main.css defines solid enterprise primary buttons without gradients');

  // Verify zero AI template gradients across all HTML files
  console.log('\n--- 2. Task 41: Zero AI Template Gradients across all HTML files ---');
  const allHtmlFiles = fs.readdirSync(frontendDir).filter(f => f.endsWith('.html'));
  assert(allHtmlFiles.length >= 20, `Found ${allHtmlFiles.length} HTML pages in frontend`);

  let htmlWithGradients = 0;
  for (const htmlFile of allHtmlFiles) {
    const content = fs.readFileSync(path.join(frontendDir, htmlFile), 'utf-8');
    if (content.includes('linear-gradient') || content.includes('radial-gradient')) {
      console.error(`    Found gradient in ${htmlFile}`);
      htmlWithGradients++;
    }
  }
  assert(htmlWithGradients === 0, 'Zero occurrences of inline linear-gradient or radial-gradient across all HTML pages');

  // --- TASK 42: RESPONSIVE DESIGN ---
  console.log('\n--- 3. Task 42: Responsive Meta Viewport Tag on All Pages ---');
  let missingViewport = 0;
  for (const htmlFile of allHtmlFiles) {
    const content = fs.readFileSync(path.join(frontendDir, htmlFile), 'utf-8');
    if (!content.includes('name="viewport"') || !content.includes('width=device-width')) {
      console.error(`    Missing viewport tag in ${htmlFile}`);
      missingViewport++;
    }
  }
  assert(missingViewport === 0, `All ${allHtmlFiles.length} HTML pages contain standard responsive viewport meta tags`);

  console.log('\n--- 4. Task 42: Table Responsiveness & Non-Squashing ---');
  assert(mainCss.includes('.table-responsive'), 'main.css includes .table-responsive styling');
  assert(mainCss.includes('overflow-x: auto'), 'main.css enforces overflow-x: auto on tables');
  assert(mainCss.includes('min-width: 560px'), 'main.css sets min-width: 560px on tables to prevent column squashing on mobile');

  const pagesWithTables = ['admin.html', 'welfare-officer.html', 'why-result.html', 'trends.html', 'what-changed.html', 'why-risk-high.html'];
  for (const pageName of pagesWithTables) {
    const content = fs.readFileSync(path.join(frontendDir, pageName), 'utf-8');
    const tableCount = (content.match(/<table/g) || []).length;
    const responsiveCount = (content.match(/class="table-responsive/g) || []).length;
    assert(tableCount > 0 && responsiveCount >= tableCount, `${pageName}: all ${tableCount} table(s) are wrapped in .table-responsive container`);
  }

  console.log('\n--- 5. Task 42: Sidebar Drawer, Backdrop Overlay & Touch Dismiss ---');
  assert(dashboardCss.includes('.sidebar-backdrop'), 'dashboard.css defines .sidebar-backdrop');
  assert(dashboardCss.includes('.sidebar-backdrop.active'), 'dashboard.css defines .sidebar-backdrop.active');
  assert(dashboardCss.includes('.app-sidebar.open'), 'dashboard.css defines .app-sidebar.open for mobile drawer expansion');

  assert(authJs.includes('sidebar-backdrop'), 'auth.js wires backdrop overlay into DOM');
  assert(authJs.includes('openSidebar') && authJs.includes('closeSidebar'), 'auth.js implements openSidebar and closeSidebar methods');
  assert(authJs.includes('keydown') && authJs.includes('Escape'), 'auth.js supports Escape key drawer dismissal');
  assert(authJs.includes('innerWidth <= 1024'), 'auth.js auto-closes mobile sidebar on menu link navigation');

  console.log('\n--- 6. Task 42: Responsive Breakpoints & Overflow Protection ---');
  assert(mainCss.includes('overflow-x: hidden') && mainCss.includes('max-width: 100vw'), 'main.css prevents global horizontal page overflow');
  assert(mainCss.includes('@media (max-width: 1024px)'), 'main.css includes tablet breakpoint (max-width: 1024px)');
  assert(mainCss.includes('@media (max-width: 640px)'), 'main.css includes large mobile breakpoint (max-width: 640px)');
  assert(mainCss.includes('@media (max-width: 480px)'), 'main.css includes small mobile breakpoint (max-width: 480px)');
  assert(dashboardCss.includes('@media (max-width: 1024px)') && dashboardCss.includes('@media (max-width: 640px)'), 'dashboard.css implements adaptive dashboard layouts for mobile & tablet');

  console.log('\n--- 7. Task 42: Responsive Charts ---');
  assert(mainCss.includes('.chart-container'), 'main.css includes responsive .chart-container wrapper');
  assert(chartsJs.includes('maintainAspectRatio: false'), 'charts.js enforces maintainAspectRatio: false for fluid resizing');
  assert(chartsJs.includes('responsive: true'), 'charts.js enforces responsive: true across chart instances');

  console.log(`\n======================================================`);
  console.log(`Test Results: ${testsPassed} passed, ${testsFailed} failed`);
  console.log(`======================================================\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
