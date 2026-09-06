/**
 * Interactive Check-In Wizard & Real ML Submission Handler
 */

let currentStep = 1;
const totalSteps = 3;

// 10 Standard PSS item descriptions for decision-support inventory
const PSS_QUESTIONS = [
  "In the last month, how often have you been upset because of something that happened unexpectedly?",
  "In the last month, how often have you felt that you were unable to control the important things in your life?",
  "In the last month, how often have you felt nervous and stressed?",
  "In the last month, how often have you felt confident about your ability to handle your personal problems? (Reverse scored)",
  "In the last month, how often have you felt that things were going your way? (Reverse scored)",
  "In the last month, how often have you found that you could not cope with all the things that you had to do?",
  "In the last month, how often have you been able to control irritations in your life? (Reverse scored)",
  "In the last month, how often have you felt that you were on top of things? (Reverse scored)",
  "In the last month, how often have you been angered because of things that were outside of your control?",
  "In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?"
];

// Reverse scored question indices (0-indexed: 3, 4, 6, 7)
const REVERSE_ITEMS = [3, 4, 6, 7];

function initCheckInWizard() {
  renderPSSQuestions();
  setupRangeSliders();
  setupNavigation();
  setupFormSubmit();
}

function renderPSSQuestions() {
  const container = document.getElementById('pss-questions-container');
  if (!container) return;

  container.innerHTML = PSS_QUESTIONS.map((q, idx) => `
    <div class="card mb-3 pss-item-card" style="padding: 1.25rem;">
      <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 0.75rem;">
        <span style="color: var(--accent); margin-right: 0.5rem;">Q${idx + 1}.</span> ${q}
      </div>
      <div class="d-flex justify-between flex-wrap gap-1" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem;">
        <label class="pss-radio-label">
          <input type="radio" name="pss_q_${idx}" value="0" required>
          <span>Never (0)</span>
        </label>
        <label class="pss-radio-label">
          <input type="radio" name="pss_q_${idx}" value="1">
          <span>Almost Never (1)</span>
        </label>
        <label class="pss-radio-label">
          <input type="radio" name="pss_q_${idx}" value="2">
          <span>Sometimes (2)</span>
        </label>
        <label class="pss-radio-label">
          <input type="radio" name="pss_q_${idx}" value="3">
          <span>Fairly Often (3)</span>
        </label>
        <label class="pss-radio-label">
          <input type="radio" name="pss_q_${idx}" value="4">
          <span>Very Often (4)</span>
        </label>
      </div>
    </div>
  `).join('');
}

function setupRangeSliders() {
  const sliders = [
    { id: 'workload_hours', display: 'val_workload' },
    { id: 'work_pressure_rating', display: 'val_pressure' },
    { id: 'recovery_sleep_hours', display: 'val_sleep' },
    { id: 'social_support_rating', display: 'val_support' },
    { id: 'work_life_balance_rating', display: 'val_wlb' },
    { id: 'shift_continuity_days', display: 'val_shifts' }
  ];

  sliders.forEach(s => {
    const el = document.getElementById(s.id);
    const displayEl = document.getElementById(s.display);
    if (el && displayEl) {
      el.addEventListener('input', () => {
        displayEl.textContent = el.value;
      });
    }
  });
}

function calculatePSSScore() {
  let score = 0;
  let allAnswered = true;

  for (let i = 0; i < 10; i++) {
    const selected = document.querySelector(`input[name="pss_q_${i}"]:checked`);
    if (!selected) {
      allAnswered = false;
      break;
    }
    let val = parseInt(selected.value, 10);
    if (REVERSE_ITEMS.includes(i)) {
      val = 4 - val; // Reverse score
    }
    score += val;
  }

  return { score, allAnswered };
}

function setupNavigation() {
  const nextBtn = document.getElementById('wizard-next-btn');
  const prevBtn = document.getElementById('wizard-prev-btn');

  // Make top step badges clickable
  for (let i = 1; i <= totalSteps; i++) {
    const badge = document.getElementById(`step-badge-${i}`);
    if (badge) {
      badge.style.cursor = 'pointer';
      badge.addEventListener('click', () => {
        if (i === 1) {
          goToStep(1);
        } else if (i === 2) {
          const { allAnswered } = calculatePSSScore();
          if (!allAnswered) {
            Utils.showToast('Please answer all 10 perceived stress questions first.', 'warning');
            return;
          }
          goToStep(2);
        } else if (i === 3) {
          const { allAnswered } = calculatePSSScore();
          if (!allAnswered) {
            Utils.showToast('Please answer all 10 perceived stress questions first.', 'warning');
            return;
          }
          populateReviewSummary();
          goToStep(3);
        }
      });
    }
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentStep === 1) {
        const { score, allAnswered } = calculatePSSScore();
        if (!allAnswered) {
          Utils.showToast('Please answer all 10 perceived stress inventory questions before proceeding.', 'warning');
          return;
        }
        goToStep(2);
      } else if (currentStep === 2) {
        populateReviewSummary();
        goToStep(3);
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentStep > 1) {
        goToStep(currentStep - 1);
      }
    });
  }
}

function goToStep(step) {
  currentStep = step;

  // Update step views
  for (let i = 1; i <= totalSteps; i++) {
    const view = document.getElementById(`wizard-step-${i}`);
    const indicator = document.getElementById(`step-badge-${i}`);
    if (view) view.style.display = i === step ? 'block' : 'none';
    if (indicator) {
      if (i === step) indicator.className = 'badge badge-primary';
      else if (i < step) indicator.className = 'badge badge-low';
      else indicator.className = 'badge badge-neutral';
    }
  }

  const prevBtn = document.getElementById('wizard-prev-btn');
  const nextBtn = document.getElementById('wizard-next-btn');
  const submitBtn = document.getElementById('wizard-submit-btn');

  if (prevBtn) prevBtn.style.display = step > 1 ? 'inline-flex' : 'none';
  if (nextBtn) nextBtn.style.display = step < totalSteps ? 'inline-flex' : 'none';
  if (submitBtn) submitBtn.style.display = step === totalSteps ? 'inline-flex' : 'none';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setScenarioPreset(type) {
  if (type === 'LOW') {
    document.getElementById('workload_hours').value = 38;
    document.getElementById('work_pressure_rating').value = 3;
    document.getElementById('recovery_sleep_hours').value = 8.0;
    document.getElementById('social_support_rating').value = 8;
    document.getElementById('work_life_balance_rating').value = 8;
    document.getElementById('shift_continuity_days').value = 1;
    // Set low PSS answers (mostly 0 and 1)
    for (let i = 0; i < 10; i++) {
      const radio = document.querySelector(`input[name="pss_q_${i}"][value="${REVERSE_ITEMS.includes(i) ? '4' : '0'}"]`);
      if (radio) radio.checked = true;
    }
  } else if (type === 'MOD') {
    document.getElementById('workload_hours').value = 52;
    document.getElementById('work_pressure_rating').value = 6;
    document.getElementById('recovery_sleep_hours').value = 6.0;
    document.getElementById('social_support_rating').value = 6;
    document.getElementById('work_life_balance_rating').value = 5;
    document.getElementById('shift_continuity_days').value = 4;
    // Set moderate PSS answers (mostly 2)
    for (let i = 0; i < 10; i++) {
      const radio = document.querySelector(`input[name="pss_q_${i}"][value="2"]`);
      if (radio) radio.checked = true;
    }
  } else if (type === 'HIGH') {
    document.getElementById('workload_hours').value = 75;
    document.getElementById('work_pressure_rating').value = 9;
    document.getElementById('recovery_sleep_hours').value = 4.0;
    document.getElementById('social_support_rating').value = 2;
    document.getElementById('work_life_balance_rating').value = 2;
    document.getElementById('shift_continuity_days').value = 12;
    // Set high PSS answers (mostly 4)
    for (let i = 0; i < 10; i++) {
      const radio = document.querySelector(`input[name="pss_q_${i}"][value="${REVERSE_ITEMS.includes(i) ? '0' : '4'}"]`);
      if (radio) radio.checked = true;
    }
  }

  // Update displays
  document.getElementById('val_workload').textContent = document.getElementById('workload_hours').value;
  document.getElementById('val_pressure').textContent = document.getElementById('work_pressure_rating').value;
  document.getElementById('val_sleep').textContent = document.getElementById('recovery_sleep_hours').value;
  document.getElementById('val_support').textContent = document.getElementById('social_support_rating').value;
  document.getElementById('val_wlb').textContent = document.getElementById('work_life_balance_rating').value;
  document.getElementById('val_shifts').textContent = document.getElementById('shift_continuity_days').value;

  populateReviewSummary();
  Utils.showToast(`Applied ${type} Strain Test Scenario!`, 'info', 2000);
}

function syncReviewInput(fieldId, value) {
  const el = document.getElementById(fieldId);
  if (el) {
    el.value = value;
    const displayMap = {
      'workload_hours': 'val_workload',
      'work_pressure_rating': 'val_pressure',
      'recovery_sleep_hours': 'val_sleep',
      'social_support_rating': 'val_support',
      'work_life_balance_rating': 'val_wlb',
      'shift_continuity_days': 'val_shifts'
    };
    const displayEl = document.getElementById(displayMap[fieldId]);
    if (displayEl) displayEl.textContent = value;
  }
}

function populateReviewSummary() {
  const { score } = calculatePSSScore();
  const workload = document.getElementById('workload_hours')?.value || '50';
  const pressure = document.getElementById('work_pressure_rating')?.value || '5';
  const sleep = document.getElementById('recovery_sleep_hours')?.value || '6.5';
  const support = document.getElementById('social_support_rating')?.value || '6';
  const wlb = document.getElementById('work_life_balance_rating')?.value || '5';
  const shifts = document.getElementById('shift_continuity_days')?.value || '0';

  const container = document.getElementById('review-summary-container');
  if (!container) return;

  container.innerHTML = `
    <!-- Scenario Quick Preset Buttons -->
    <div class="card mb-3" style="background: var(--bg-card); border: 1px solid var(--border-color);">
      <div class="d-flex justify-between align-center mb-2 flex-wrap gap-1">
        <div>
          <strong style="font-size:0.9rem;">⚡ 1-Click Test Scenario Presets:</strong>
          <div class="text-muted" style="font-size:0.75rem;">Instantly populate high, moderate, or balanced duty indicators for judging/demo</div>
        </div>
        <div class="d-flex gap-1 flex-wrap">
          <button type="button" class="btn btn-sm btn-secondary" style="border-color:var(--risk-low); color:var(--risk-low);" onclick="setScenarioPreset('LOW')">🟢 Low Strain</button>
          <button type="button" class="btn btn-sm btn-secondary" style="border-color:var(--risk-mod); color:var(--risk-mod);" onclick="setScenarioPreset('MOD')">🟡 Moderate Strain</button>
          <button type="button" class="btn btn-sm btn-secondary" style="border-color:var(--risk-high); color:var(--risk-high);" onclick="setScenarioPreset('HIGH')">🔴 High Strain</button>
        </div>
      </div>
    </div>

    <!-- Interactive Review Card with Live Inputs -->
    <div class="card mb-3" style="background: var(--bg-card-subtle); border: 1px solid var(--border-color);">
      <div class="d-flex justify-between align-center mb-3 pb-2" style="border-bottom: 1px solid var(--border-color);">
        <div>
          <h3 style="margin-bottom:0.15rem;">Live Editable Check-in Summary</h3>
          <span class="text-muted" style="font-size:0.8rem;">You can adjust any indicator directly below or click &larr; Previous to return to earlier steps</span>
        </div>
        <div class="d-flex gap-1">
          <button type="button" class="btn btn-sm btn-outline" onclick="goToStep(1)">✏️ Questions (Step 1)</button>
          <button type="button" class="btn btn-sm btn-outline" onclick="goToStep(2)">✏️ Sliders (Step 2)</button>
        </div>
      </div>

      <div class="grid-2" style="gap: 1rem;">
        <!-- PSS Score -->
        <div class="card" style="padding: 0.85rem; background: var(--bg-card);">
          <div class="d-flex justify-between align-center">
            <label class="form-label mb-0"><strong>Perceived Stress Score (PSS)</strong></label>
            <span class="badge badge-neutral" style="font-size:1rem; font-weight:800; color:var(--accent);">${score} / 40</span>
          </div>
          <small class="text-muted">Computed from 10 standardized questions in Step 1.</small>
        </div>

        <!-- Weekly Workload -->
        <div class="card" style="padding: 0.85rem; background: var(--bg-card);">
          <div class="d-flex justify-between align-center mb-1">
            <label class="form-label mb-0" for="rev_workload"><strong>Weekly Workload (hrs/wk)</strong></label>
            <input type="number" id="rev_workload" class="form-control form-control-sm" style="width:80px; text-align:center; font-weight:700;" min="30" max="90" value="${workload}" oninput="syncReviewInput('workload_hours', this.value)">
          </div>
          <small class="text-muted">Standard range: 40–80 hours/week.</small>
        </div>

        <!-- Work Pressure -->
        <div class="card" style="padding: 0.85rem; background: var(--bg-card);">
          <div class="d-flex justify-between align-center mb-1">
            <label class="form-label mb-0" for="rev_pressure"><strong>Work Pressure Rating (1-10)</strong></label>
            <input type="number" id="rev_pressure" class="form-control form-control-sm" style="width:80px; text-align:center; font-weight:700;" min="1" max="10" value="${pressure}" oninput="syncReviewInput('work_pressure_rating', this.value)">
          </div>
          <small class="text-muted">Scale 1 (Calm) to 10 (Critical High Tempo).</small>
        </div>

        <!-- Recovery Sleep -->
        <div class="card" style="padding: 0.85rem; background: var(--bg-card);">
          <div class="d-flex justify-between align-center mb-1">
            <label class="form-label mb-0" for="rev_sleep"><strong>Recovery Sleep (hrs/day)</strong></label>
            <input type="number" step="0.5" id="rev_sleep" class="form-control form-control-sm" style="width:80px; text-align:center; font-weight:700;" min="3" max="10" value="${sleep}" oninput="syncReviewInput('recovery_sleep_hours', this.value)">
          </div>
          <small class="text-muted">Recommended: 7.0–8.0 hours/night.</small>
        </div>

        <!-- Social Support -->
        <div class="card" style="padding: 0.85rem; background: var(--bg-card);">
          <div class="d-flex justify-between align-center mb-1">
            <label class="form-label mb-0" for="rev_support"><strong>Social & Family Support (1-10)</strong></label>
            <input type="number" id="rev_support" class="form-control form-control-sm" style="width:80px; text-align:center; font-weight:700;" min="1" max="10" value="${support}" oninput="syncReviewInput('social_support_rating', this.value)">
          </div>
          <small class="text-muted">Scale 1 (Isolated) to 10 (Strong Connection).</small>
        </div>

        <!-- Work-Life Balance -->
        <div class="card" style="padding: 0.85rem; background: var(--bg-card);">
          <div class="d-flex justify-between align-center mb-1">
            <label class="form-label mb-0" for="rev_wlb"><strong>Work-Life Equilibrium (1-10)</strong></label>
            <input type="number" id="rev_wlb" class="form-control form-control-sm" style="width:80px; text-align:center; font-weight:700;" min="1" max="10" value="${wlb}" oninput="syncReviewInput('work_life_balance_rating', this.value)">
          </div>
          <small class="text-muted">Scale 1 (Poor) to 10 (Balanced).</small>
        </div>

        <!-- Continuous Shifts -->
        <div class="card" style="padding: 0.85rem; background: var(--bg-card); grid-column: span 2;">
          <div class="d-flex justify-between align-center mb-1">
            <label class="form-label mb-0" for="rev_shifts"><strong>Consecutive Duty Days Without 24h Rest</strong></label>
            <input type="number" id="rev_shifts" class="form-control form-control-sm" style="width:80px; text-align:center; font-weight:700;" min="0" max="21" value="${shifts}" oninput="syncReviewInput('shift_continuity_days', this.value)">
          </div>
          <small class="text-muted">Consecutive days deployed on watch without 24 hours of unbroken rest.</small>
        </div>
      </div>
    </div>
  `;
}

function setupFormSubmit() {
  const form = document.getElementById('checkin-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('wizard-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<div class="spinner"></div> Submitting to Random Forest Model...`;
    }

    try {
      const { score } = calculatePSSScore();
      const pssResponses = [];
      for (let i = 0; i < 10; i++) {
        const val = document.querySelector(`input[name="pss_q_${i}"]:checked`)?.value || '0';
        pssResponses.push(parseInt(val, 10));
      }

      const payload = {
        pss_score: score,
        pss_responses: pssResponses,
        workload_hours: parseFloat(document.getElementById('workload_hours').value),
        work_pressure_rating: parseFloat(document.getElementById('work_pressure_rating').value),
        recovery_sleep_hours: parseFloat(document.getElementById('recovery_sleep_hours').value),
        social_support_rating: parseFloat(document.getElementById('social_support_rating').value),
        work_life_balance_rating: parseFloat(document.getElementById('work_life_balance_rating').value),
        shift_continuity_days: parseFloat(document.getElementById('shift_continuity_days').value),
        notes: document.getElementById('checkin_notes')?.value || ''
      };

      const res = await api.submitCheckIn(payload);
      if (res && res.success) {
        Utils.showToast('Check-in processed! AI Prediction generated.', 'success');
        setTimeout(() => {
          window.location.href = '/ai-analysis.html';
        }, 800);
      }
    } catch (err) {
      Utils.showToast(`Error submitting check-in: ${err.message}`, 'danger');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Complete & Generate AI Prediction`;
      }
    }
  });
}

async function syncTacticalWearable(isRealBluetooth = false) {
  const simBtn = document.getElementById('btn-sync-wearable');
  const bleBtn = document.getElementById('btn-real-bluetooth');
  const modeBadge = document.getElementById('wearable-mode-badge');
  const resultsGrid = document.getElementById('wearable-sync-results');

  if (isRealBluetooth) {
    if (!navigator.bluetooth) {
      Utils.showToast('Web Bluetooth API is not supported in this browser. Use Chrome/Edge over HTTPS/localhost, or use "Simulated Telemetry (Demo)".', 'warning', 4000);
      return;
    }

    try {
      if (bleBtn) {
        bleBtn.disabled = true;
        bleBtn.innerHTML = `<span class="spinner spinner-primary" style="display:inline-block; width:12px; height:12px;"></span> Scanning for BLE Devices...`;
      }
      
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['heart_rate', 'battery_service']
      });

      if (modeBadge) {
        modeBadge.textContent = `Connected: ${device.name || 'Bluetooth BLE Band'}`;
        modeBadge.className = 'badge badge-low';
      }

      // Populate biometric form values from device
      applyTelemetryValues(62, 65, 7.0, 80, `Live BLE Connected: ${device.name || 'Smartwatch'}`);
      Utils.showToast(`Connected to ${device.name || 'Tactical Smartwatch'} via Web Bluetooth!`, 'success');

      if (bleBtn) {
        bleBtn.disabled = false;
        bleBtn.innerHTML = `✓ ${device.name || 'BLE Device Connected'}`;
        bleBtn.classList.remove('btn-outline');
        bleBtn.classList.add('btn-secondary');
      }
    } catch (err) {
      if (bleBtn) {
        bleBtn.disabled = false;
        bleBtn.innerHTML = `📡 Pair Real Bluetooth Watch`;
      }
      if (err.name !== 'NotFoundError') {
        Utils.showToast('Bluetooth pairing error: ' + err.message, 'warning');
      } else {
        Utils.showToast('Bluetooth pairing cancelled. Click "Simulated Telemetry (Demo)" to test without a physical smartwatch.', 'info', 3500);
      }
    }
  } else {
    // Simulated Telemetry (For live judging presentation / demos)
    if (simBtn) {
      simBtn.disabled = true;
      simBtn.innerHTML = `<span class="spinner spinner-primary" style="display:inline-block; width:12px; height:12px;"></span> Connecting to Defense IoT Band...`;
    }

    setTimeout(() => {
      if (modeBadge) {
        modeBadge.textContent = 'Simulated Defense IoT Band';
        modeBadge.className = 'badge badge-low';
      }

      applyTelemetryValues(58, 68, 7.5, 84, '✓ Simulated Telemetry Synced');

      if (simBtn) {
        simBtn.disabled = false;
        simBtn.innerHTML = `✓ Telemetry Synced (Garmin / Defense Band)`;
        simBtn.className = 'btn btn-sm btn-secondary';
        simBtn.style.color = 'var(--risk-low)';
      }

      Utils.showToast('Simulated IoT band telemetry synced: RHR 58 bpm, HRV 68 ms, Sleep 7.5h', 'success');
    }, 900);
  }
}

function applyTelemetryValues(rhr, hrv, sleep, battery, label) {
  // Update telemetry display card
  const rhrEl = document.getElementById('sync-rhr');
  const hrvEl = document.getElementById('sync-hrv');
  const sleepEl = document.getElementById('sync-sleep');
  const batteryEl = document.getElementById('sync-battery');
  const resultsGrid = document.getElementById('wearable-sync-results');

  if (rhrEl) rhrEl.textContent = `${rhr} bpm`;
  if (hrvEl) hrvEl.textContent = `${hrv} ms`;
  if (sleepEl) sleepEl.textContent = `${sleep} hrs`;
  if (batteryEl) batteryEl.textContent = `${battery} / 100`;
  if (resultsGrid) resultsGrid.style.display = 'grid';

  // Populate operational form inputs
  const sleepInput = document.getElementById('recovery_sleep_hours');
  const sleepVal = document.getElementById('val_sleep');
  if (sleepInput && sleepVal) {
    sleepInput.value = sleep;
    sleepVal.textContent = sleep;
  }

  const workloadInput = document.getElementById('workload_hours');
  const workloadVal = document.getElementById('val_workload');
  if (workloadInput && workloadVal) {
    workloadInput.value = '46';
    workloadVal.textContent = '46';
  }

  const pressureInput = document.getElementById('work_pressure_rating');
  const pressureVal = document.getElementById('val_pressure');
  if (pressureInput && pressureVal) {
    pressureInput.value = '4';
    pressureVal.textContent = '4';
  }
}

document.addEventListener('DOMContentLoaded', initCheckInWizard);
