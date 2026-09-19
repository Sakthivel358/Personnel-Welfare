/**
 * Interactive Check-In Wizard & Multi-Source Evidence Fusion Handler
 * Supports 5 Authorized Data Sources:
 * 1. Operational Duty Exposure (continuity, prolonged shifts, night duty)
 * 2. Operational Workload (weekly hours, operational tempo)
 * 3. Rest & Recovery (sleep, rest intervals, circadian pattern, social/equilibrium)
 * 4. Self-Check (Optional PSS-10 Inventory)
 * 5. Smart Jacket & Tactical Wearable Telemetry (Optional Biometrics)
 */

let currentStep = 1;
const totalSteps = 5;
let pssSkipped = false;
let wearableEnabled = false;

// 10 Standard PSS item descriptions
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
  loadUserProfileDutyContext();
}

async function loadUserProfileDutyContext() {
  try {
    const res = await (typeof api !== 'undefined' && api.getProfile ? api.getProfile().catch(() => null) : null);
    const profile = res && res.success && res.data ? res.data : null;
    const localUser = JSON.parse(localStorage.getItem('sih_user') || '{}');
    const p = profile || localUser;

    const dutyTypeSelect = document.getElementById('duty_type');
    const badge = document.getElementById('posting_context_badge');
    const info = document.getElementById('duty_context_info');

    if (p) {
      if (dutyTypeSelect && p.primaryDuty) {
        // Match option or set
        for (let opt of dutyTypeSelect.options) {
          if (opt.value.toLowerCase().includes(p.primaryDuty.toLowerCase()) || p.primaryDuty.toLowerCase().includes(opt.value.toLowerCase())) {
            dutyTypeSelect.value = opt.value;
            break;
          }
        }
      }

      if (badge && (p.postingType || p.deploymentZone)) {
        badge.textContent = `${p.postingType || 'Operational'} | ${p.deploymentZone || 'Field Sector'}`;
      }

      if (dutyTypeSelect) {
        dutyTypeSelect.addEventListener('change', () => {
          updateDutyContextNote(dutyTypeSelect.value);
        });
        updateDutyContextNote(dutyTypeSelect.value);
      }
    }
  } catch (e) {
    console.warn('Duty context load deferred:', e);
  }
}

function updateDutyContextNote(duty) {
  const info = document.getElementById('duty_context_info');
  if (!info) return;

  if (duty.includes('Quick Reaction')) {
    info.innerHTML = '⚡ <strong>QRT Alert Status:</strong> High baseline adrenaline & vigilance readiness. Shorter tactical rotation cycles recommended.';
  } else if (duty.includes('Convoy')) {
    info.innerHTML = '🛡️ <strong>Convoy Security:</strong> Prolonged vehicle posture vibration & transit vigilance profile.';
  } else if (duty.includes('Static Outpost')) {
    info.innerHTML = '👁️ <strong>Static Watch:</strong> Sustained standing vigilance with minimal physical mobility.';
  } else if (duty.includes('Signals')) {
    info.innerHTML = '📡 <strong>Ops Room & Signals:</strong> Nocturnal screen vigilance and high cognitive task-switching load.';
  } else if (duty.includes('Headquarters')) {
    info.innerHTML = '📋 <strong>HQ Logistics:</strong> Administrative pace and daytime staff coordination.';
  } else {
    info.innerHTML = '⚡ <strong>High-mobility Patrol:</strong> Acute aerobic exertion & environmental terrain exposure profile.';
  }
}

function renderPSSQuestions() {
  const container = document.getElementById('pss-questions-container');
  if (!container) return;

  container.innerHTML = PSS_QUESTIONS.map((q, idx) => `
    <div class="card mb-3 pss-item-card" style="padding: 1.25rem;">
      <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 0.75rem;">
        <span style="color: var(--accent); margin-right: 0.5rem;">Q${idx + 1}.</span> ${q}
      </div>
      <div class="pss-options-grid">
        <label class="pss-radio-label">
          <input type="radio" name="pss_q_${idx}" value="0" onchange="onPssOptionSelected()">
          <span>Never (0)</span>
        </label>
        <label class="pss-radio-label">
          <input type="radio" name="pss_q_${idx}" value="1" onchange="onPssOptionSelected()">
          <span>Almost Never (1)</span>
        </label>
        <label class="pss-radio-label">
          <input type="radio" name="pss_q_${idx}" value="2" onchange="onPssOptionSelected()">
          <span>Sometimes (2)</span>
        </label>
        <label class="pss-radio-label">
          <input type="radio" name="pss_q_${idx}" value="3" onchange="onPssOptionSelected()">
          <span>Fairly Often (3)</span>
        </label>
        <label class="pss-radio-label">
          <input type="radio" name="pss_q_${idx}" value="4" onchange="onPssOptionSelected()">
          <span>Very Often (4)</span>
        </label>
      </div>
    </div>
  `).join('');
}

function onPssOptionSelected() {
  pssSkipped = false;
  const pill = document.getElementById('pss-status-pill');
  const clearBtn = document.getElementById('btn-clear-pss');
  const { answeredCount } = getPssAnsweredCount();
  if (pill) {
    pill.textContent = `${answeredCount}/10 Answered`;
    pill.className = answeredCount === 10 ? 'badge badge-low' : 'badge badge-primary';
  }
  if (clearBtn) clearBtn.style.display = answeredCount > 0 ? 'inline-flex' : 'none';
}

function clearPssAnswers() {
  for (let i = 0; i < 10; i++) {
    const checked = document.querySelector(`input[name="pss_q_${i}"]:checked`);
    if (checked) checked.checked = false;
  }
  pssSkipped = true;
  const pill = document.getElementById('pss-status-pill');
  const clearBtn = document.getElementById('btn-clear-pss');
  if (pill) {
    pill.textContent = 'Skipped (Optional)';
    pill.className = 'badge badge-neutral';
  }
  if (clearBtn) clearBtn.style.display = 'none';
  Utils.showToast('Self-check questions cleared. Multi-source inference will use operational and wearable data.', 'info');
}

function skipPssStep() {
  clearPssAnswers();
  goToStep(4);
}

function setupRangeSliders() {
  const sliders = [
    { id: 'workload_hours', display: 'val_workload' },
    { id: 'work_pressure_rating', display: 'val_pressure' },
    { id: 'shift_continuity_days', display: 'val_shifts' },
    { id: 'prolonged_duty_hours', display: 'val_prolonged' },
    { id: 'night_duty_hours', display: 'val_night' },
    { id: 'recovery_sleep_hours', display: 'val_sleep' },
    { id: 'rest_interval_hours', display: 'val_interval' },
    { id: 'social_support_rating', display: 'val_support' },
    { id: 'work_life_balance_rating', display: 'val_wlb' },
    { id: 'resting_heart_rate', display: 'val_rhr' },
    { id: 'hrv_ms', display: 'val_hrv' },
    { id: 'respiration_rate', display: 'val_resp' },
    { id: 'skin_temperature_c', display: 'val_temp' },
    { id: 'fatigue_physical_strain', display: 'val_strain' },
    { id: 'wellness_energy', display: 'val_energy' },
    { id: 'wellness_morale', display: 'val_morale' },
    { id: 'wellness_tension', display: 'val_tension' }
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

function getPssAnsweredCount() {
  let count = 0;
  for (let i = 0; i < 10; i++) {
    if (document.querySelector(`input[name="pss_q_${i}"]:checked`)) count++;
  }
  return { answeredCount: count };
}

function calculatePSSScore() {
  let score = 0;
  let answered = 0;
  const pssResponses = [];

  for (let i = 0; i < 10; i++) {
    const selected = document.querySelector(`input[name="pss_q_${i}"]:checked`);
    if (selected) {
      answered++;
      let val = parseInt(selected.value, 10);
      pssResponses.push(val);
      if (REVERSE_ITEMS.includes(i)) {
        val = 4 - val; // Reverse score
      }
      score += val;
    } else {
      pssResponses.push(null);
    }
  }

  const allAnswered = answered === 10;
  const isSkipped = answered === 0 || pssSkipped;

  return { score: isSkipped ? null : score, allAnswered, isSkipped, pssResponses, answeredCount: answered };
}

function toggleWearablePillar(enable) {
  wearableEnabled = Boolean(enable);
  const grid = document.getElementById('wearable-inputs-grid');
  const toggle = document.getElementById('wearable_enabled_toggle');
  const statusPill = document.getElementById('wearable-toggle-status');

  if (toggle) toggle.checked = wearableEnabled;
  if (grid) {
    grid.style.opacity = wearableEnabled ? '1' : '0.5';
    grid.style.pointerEvents = wearableEnabled ? 'auto' : 'none';
  }
  if (statusPill) {
    statusPill.textContent = wearableEnabled ? 'Active (5th Source)' : 'Optional / Inactive';
    statusPill.className = wearableEnabled ? 'badge badge-low' : 'badge badge-neutral';
  }
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
        if (i === 5) populateReviewSummary();
        goToStep(i);
      });
    }
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentStep === 1) {
        goToStep(2);
      } else if (currentStep === 2) {
        goToStep(3);
      } else if (currentStep === 3) {
        goToStep(4);
      } else if (currentStep === 4) {
        populateReviewSummary();
        goToStep(5);
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
    document.getElementById('workload_hours').value = 40;
    document.getElementById('work_pressure_rating').value = 3;
    document.getElementById('shift_continuity_days').value = 1;
    document.getElementById('prolonged_duty_hours').value = 6;
    document.getElementById('night_duty_hours').value = 0;
    document.getElementById('recovery_sleep_hours').value = 8.0;
    document.getElementById('rest_interval_hours').value = 14;
    document.getElementById('recovery_pattern').value = 'BALANCED_CIRCADIAN';
    document.getElementById('social_support_rating').value = 8;
    document.getElementById('work_life_balance_rating').value = 8;
    
    // Optional PSS answers
    for (let i = 0; i < 10; i++) {
      const radio = document.querySelector(`input[name="pss_q_${i}"][value="${REVERSE_ITEMS.includes(i) ? '4' : '0'}"]`);
      if (radio) radio.checked = true;
    }
    pssSkipped = false;

    // Wearable
    toggleWearablePillar(true);
    document.getElementById('resting_heart_rate').value = 60;
    document.getElementById('hrv_ms').value = 75;
    document.getElementById('respiration_rate').value = 13;
    document.getElementById('skin_temperature_c').value = 36.4;
    document.getElementById('fatigue_physical_strain').value = 20;
    document.getElementById('activity_movement').value = 'MODERATE_PATROL';
    document.getElementById('posture_inactivity').value = 'NORMAL_MOBILITY';

  } else if (type === 'MOD') {
    document.getElementById('workload_hours').value = 52;
    document.getElementById('work_pressure_rating').value = 6;
    document.getElementById('shift_continuity_days').value = 4;
    document.getElementById('prolonged_duty_hours').value = 9;
    document.getElementById('night_duty_hours').value = 8;
    document.getElementById('recovery_sleep_hours').value = 6.0;
    document.getElementById('rest_interval_hours').value = 10;
    document.getElementById('recovery_pattern').value = 'INTERRUPTED_SLEEP';
    document.getElementById('social_support_rating').value = 6;
    document.getElementById('work_life_balance_rating').value = 5;

    for (let i = 0; i < 10; i++) {
      const radio = document.querySelector(`input[name="pss_q_${i}"][value="2"]`);
      if (radio) radio.checked = true;
    }
    pssSkipped = false;

    toggleWearablePillar(true);
    document.getElementById('resting_heart_rate').value = 72;
    document.getElementById('hrv_ms').value = 50;
    document.getElementById('respiration_rate').value = 16;
    document.getElementById('skin_temperature_c').value = 36.8;
    document.getElementById('fatigue_physical_strain').value = 45;
    document.getElementById('activity_movement').value = 'MODERATE_PATROL';
    document.getElementById('posture_inactivity').value = 'NORMAL_MOBILITY';

  } else if (type === 'HIGH') {
    document.getElementById('workload_hours').value = 78;
    document.getElementById('work_pressure_rating').value = 9;
    document.getElementById('shift_continuity_days').value = 12;
    document.getElementById('prolonged_duty_hours').value = 16;
    document.getElementById('night_duty_hours').value = 24;
    document.getElementById('recovery_sleep_hours').value = 4.0;
    document.getElementById('rest_interval_hours').value = 5;
    document.getElementById('recovery_pattern').value = 'EXTENDED_DEFICIT';
    document.getElementById('social_support_rating').value = 2;
    document.getElementById('work_life_balance_rating').value = 2;

    for (let i = 0; i < 10; i++) {
      const radio = document.querySelector(`input[name="pss_q_${i}"][value="${REVERSE_ITEMS.includes(i) ? '0' : '4'}"]`);
      if (radio) radio.checked = true;
    }
    pssSkipped = false;

    toggleWearablePillar(true);
    document.getElementById('resting_heart_rate').value = 96;
    document.getElementById('hrv_ms').value = 24;
    document.getElementById('respiration_rate').value = 24;
    document.getElementById('skin_temperature_c').value = 38.2;
    document.getElementById('fatigue_physical_strain').value = 85;
    document.getElementById('activity_movement').value = 'HIGH_MOBILITY_TACTICAL';
    document.getElementById('posture_inactivity').value = 'IMMOBILE_FATIGUE';
  }

  // Update slider badge text
  const updates = [
    { id: 'workload_hours', display: 'val_workload' },
    { id: 'work_pressure_rating', display: 'val_pressure' },
    { id: 'shift_continuity_days', display: 'val_shifts' },
    { id: 'prolonged_duty_hours', display: 'val_prolonged' },
    { id: 'night_duty_hours', display: 'val_night' },
    { id: 'recovery_sleep_hours', display: 'val_sleep' },
    { id: 'rest_interval_hours', display: 'val_interval' },
    { id: 'social_support_rating', display: 'val_support' },
    { id: 'work_life_balance_rating', display: 'val_wlb' },
    { id: 'resting_heart_rate', display: 'val_rhr' },
    { id: 'hrv_ms', display: 'val_hrv' },
    { id: 'respiration_rate', display: 'val_resp' },
    { id: 'skin_temperature_c', display: 'val_temp' },
    { id: 'fatigue_physical_strain', display: 'val_strain' }
  ];

  updates.forEach(u => {
    const el = document.getElementById(u.id);
    const d = document.getElementById(u.display);
    if (el && d) d.textContent = el.value;
  });

  populateReviewSummary();
  Utils.showToast(`Applied ${type} Multi-Source Strain Scenario!`, 'info', 2000);
}

function loadEvaluationScenario(scenarioKey) {
  if (scenarioKey === 'M1_HIGH') {
    const dutySelect = document.getElementById('duty_type');
    if (dutySelect) dutySelect.value = 'Quick Reaction Team (QRT)';
    updateDutyContextNote('Quick Reaction Team (QRT)');

    syncReviewInput('workload_hours', 78);
    syncReviewInput('work_pressure_rating', 9);
    syncReviewInput('shift_continuity_days', 12);
    syncReviewInput('prolonged_duty_hours', 16);
    syncReviewInput('night_duty_hours', 24);
    syncReviewInput('recovery_sleep_hours', 4.0);
    syncReviewInput('rest_interval_hours', 5);
    const recPat = document.getElementById('recovery_pattern');
    if (recPat) recPat.value = 'EXTENDED_DEFICIT';
    syncReviewInput('social_support_rating', 2);
    syncReviewInput('work_life_balance_rating', 2);

    // Smart Jacket: Active (Model 1 Pathway)
    toggleWearablePillar(true);
    syncReviewInput('resting_heart_rate', 96);
    syncReviewInput('hrv_ms', 24);
    syncReviewInput('respiration_rate', 24);
    syncReviewInput('skin_temperature_c', 38.2);
    syncReviewInput('fatigue_physical_strain', 85);
    const actMov = document.getElementById('activity_movement');
    if (actMov) actMov.value = 'HIGH_MOBILITY_TACTICAL';
    const postInact = document.getElementById('posture_inactivity');
    if (postInact) postInact.value = 'IMMOBILE_FATIGUE';

    // Optional PSS-10 responses
    for (let i = 0; i < 10; i++) {
      const radio = document.querySelector(`input[name="pss_q_${i}"][value="${REVERSE_ITEMS.includes(i) ? '1' : '3'}"]`);
      if (radio) radio.checked = true;
    }
    pssSkipped = false;
    onPssOptionSelected();

    goToStep(5);
    populateReviewSummary();
    Utils.showToast('Evaluation Scenario: Model 1 Wearable High Strain Loaded', 'success', 2500);

  } else if (scenarioKey === 'M1_LOW') {
    const dutySelect = document.getElementById('duty_type');
    if (dutySelect) dutySelect.value = 'Headquarters / Base Staff';
    updateDutyContextNote('Headquarters / Base Staff');

    syncReviewInput('workload_hours', 40);
    syncReviewInput('work_pressure_rating', 3);
    syncReviewInput('shift_continuity_days', 1);
    syncReviewInput('prolonged_duty_hours', 6);
    syncReviewInput('night_duty_hours', 0);
    syncReviewInput('recovery_sleep_hours', 8.0);
    syncReviewInput('rest_interval_hours', 14);
    const recPat = document.getElementById('recovery_pattern');
    if (recPat) recPat.value = 'BALANCED_CIRCADIAN';
    syncReviewInput('social_support_rating', 8);
    syncReviewInput('work_life_balance_rating', 8);

    // Smart Jacket: Active (Model 1 Pathway)
    toggleWearablePillar(true);
    syncReviewInput('resting_heart_rate', 60);
    syncReviewInput('hrv_ms', 75);
    syncReviewInput('respiration_rate', 13);
    syncReviewInput('skin_temperature_c', 36.4);
    syncReviewInput('fatigue_physical_strain', 20);
    const actMov = document.getElementById('activity_movement');
    if (actMov) actMov.value = 'MODERATE_PATROL';
    const postInact = document.getElementById('posture_inactivity');
    if (postInact) postInact.value = 'NORMAL_MOBILITY';

    // Optional PSS-10 low responses
    for (let i = 0; i < 10; i++) {
      const radio = document.querySelector(`input[name="pss_q_${i}"][value="${REVERSE_ITEMS.includes(i) ? '4' : '0'}"]`);
      if (radio) radio.checked = true;
    }
    pssSkipped = false;
    onPssOptionSelected();

    goToStep(5);
    populateReviewSummary();
    Utils.showToast('Evaluation Scenario: Model 1 Wearable Low Strain Loaded', 'success', 2500);

  } else if (scenarioKey === 'M2_HIGH') {
    const dutySelect = document.getElementById('duty_type');
    if (dutySelect) dutySelect.value = 'Static Outpost Watch';
    updateDutyContextNote('Static Outpost Watch');

    syncReviewInput('workload_hours', 72);
    syncReviewInput('work_pressure_rating', 8);
    syncReviewInput('shift_continuity_days', 8);
    syncReviewInput('prolonged_duty_hours', 14);
    syncReviewInput('night_duty_hours', 18);
    syncReviewInput('recovery_sleep_hours', 4.5);
    syncReviewInput('rest_interval_hours', 6);
    const recPat = document.getElementById('recovery_pattern');
    if (recPat) recPat.value = 'INTERRUPTED_SLEEP';
    syncReviewInput('social_support_rating', 3);
    syncReviewInput('work_life_balance_rating', 3);

    // Smart Jacket: Inactive (Model 2 Fallback Pathway)
    toggleWearablePillar(false);

    // High PSS-10 responses (scores ~28-32)
    for (let i = 0; i < 10; i++) {
      const radio = document.querySelector(`input[name="pss_q_${i}"][value="${REVERSE_ITEMS.includes(i) ? '0' : '4'}"]`);
      if (radio) radio.checked = true;
    }
    pssSkipped = false;
    onPssOptionSelected();

    goToStep(5);
    populateReviewSummary();
    Utils.showToast('Evaluation Scenario: Model 2 PSS-10 High Stress Fallback Loaded', 'success', 2500);

  } else if (scenarioKey === 'M2_LOW') {
    const dutySelect = document.getElementById('duty_type');
    if (dutySelect) dutySelect.value = 'Signals & Operational Communication';
    updateDutyContextNote('Signals & Operational Communication');

    syncReviewInput('workload_hours', 42);
    syncReviewInput('work_pressure_rating', 3);
    syncReviewInput('shift_continuity_days', 2);
    syncReviewInput('prolonged_duty_hours', 7);
    syncReviewInput('night_duty_hours', 4);
    syncReviewInput('recovery_sleep_hours', 7.5);
    syncReviewInput('rest_interval_hours', 12);
    const recPat = document.getElementById('recovery_pattern');
    if (recPat) recPat.value = 'BALANCED_CIRCADIAN';
    syncReviewInput('social_support_rating', 8);
    syncReviewInput('work_life_balance_rating', 8);

    // Smart Jacket: Inactive (Model 2 Fallback Pathway)
    toggleWearablePillar(false);

    // Low PSS-10 responses (scores ~6-10)
    for (let i = 0; i < 10; i++) {
      const radio = document.querySelector(`input[name="pss_q_${i}"][value="${REVERSE_ITEMS.includes(i) ? '4' : '1'}"]`);
      if (radio) radio.checked = true;
    }
    pssSkipped = false;
    onPssOptionSelected();

    goToStep(5);
    populateReviewSummary();
    Utils.showToast('Evaluation Scenario: Model 2 PSS-10 Low Stress Fallback Loaded', 'success', 2500);

  } else if (scenarioKey === 'UNDETERMINED') {
    clearPssAnswers();
    toggleWearablePillar(false);
    syncReviewInput('workload_hours', 48);
    syncReviewInput('work_pressure_rating', 5);
    syncReviewInput('shift_continuity_days', 3);
    syncReviewInput('prolonged_duty_hours', 8);
    syncReviewInput('night_duty_hours', 0);
    syncReviewInput('recovery_sleep_hours', 6.0);
    syncReviewInput('rest_interval_hours', 8);
    goToStep(5);
    populateReviewSummary();
    Utils.showToast('Evaluation Scenario: Zero-Guessing Mandate Loaded', 'warning', 2500);

  } else if (scenarioKey === 'RESET') {
    clearPssAnswers();
    toggleWearablePillar(false);
    goToStep(1);
    Utils.showToast('Check-in form reset.', 'info', 2000);
  }
}

window.loadEvaluationScenario = loadEvaluationScenario;
window.setScenarioPreset = setScenarioPreset;

function syncReviewInput(fieldId, value) {
  const el = document.getElementById(fieldId);
  if (el) {
    el.value = value;
    const displayMap = {
      'workload_hours': 'val_workload',
      'work_pressure_rating': 'val_pressure',
      'shift_continuity_days': 'val_shifts',
      'prolonged_duty_hours': 'val_prolonged',
      'night_duty_hours': 'val_night',
      'recovery_sleep_hours': 'val_sleep',
      'rest_interval_hours': 'val_interval',
      'social_support_rating': 'val_support',
      'work_life_balance_rating': 'val_wlb',
      'resting_heart_rate': 'val_rhr',
      'hrv_ms': 'val_hrv',
      'respiration_rate': 'val_resp',
      'skin_temperature_c': 'val_temp',
      'fatigue_physical_strain': 'val_strain'
    };
    const displayEl = document.getElementById(displayMap[fieldId]);
    if (displayEl) displayEl.textContent = value;
  }
}

function populateReviewSummary() {
  const pssData = calculatePSSScore();
  const workload = document.getElementById('workload_hours')?.value || '52';
  const pressure = document.getElementById('work_pressure_rating')?.value || '6';
  const shifts = document.getElementById('shift_continuity_days')?.value || '4';
  const prolonged = document.getElementById('prolonged_duty_hours')?.value || '8';
  const night = document.getElementById('night_duty_hours')?.value || '8';
  const sleep = document.getElementById('recovery_sleep_hours')?.value || '6.0';
  const restInt = document.getElementById('rest_interval_hours')?.value || '10';
  const recoveryPattern = document.getElementById('recovery_pattern')?.value || 'BALANCED_CIRCADIAN';
  const support = document.getElementById('social_support_rating')?.value || '6';
  const wlb = document.getElementById('work_life_balance_rating')?.value || '5';

  const rhr = document.getElementById('resting_heart_rate')?.value || '68';
  const hrv = document.getElementById('hrv_ms')?.value || '58';
  const resp = document.getElementById('respiration_rate')?.value || '15';
  const temp = document.getElementById('skin_temperature_c')?.value || '36.6';
  const strain = document.getElementById('fatigue_physical_strain')?.value || '35';

  // Render 5 Evidence Source verification pills
  const dutyTypeVal = document.getElementById('duty_type')?.value || 'Patrol & Active Security';
  const pillsContainer = document.getElementById('active-evidence-pills');
  if (pillsContainer) {
    pillsContainer.innerHTML = `
      <span class="badge badge-low">🪖 1. Duty: ${dutyTypeVal} (${shifts}d continuous, ${prolonged}h shift, ${night}h night)</span>
      <span class="badge badge-low">⏱️ 2. Workload (${workload}h/wk, ${pressure}/10)</span>
      <span class="badge badge-low">🛌 3. Rest & Recovery (${sleep}h sleep, ${restInt}h interval)</span>
      <span class="badge ${pssData.score != null ? 'badge-primary' : 'badge-neutral'}">
        📝 4. Self-Check: ${pssData.score != null ? `PSS ${pssData.score}/40` : 'Skipped (Operational Only)'}
      </span>
      <span class="badge ${wearableEnabled ? 'badge-primary' : 'badge-neutral'}">
        🦺 5. Smart Jacket: ${wearableEnabled ? `${rhr} BPM / ${hrv} ms / ${strain}% strain` : 'Standby'}
      </span>
      <span class="badge badge-low">
        🌱 Wellness (Energy ${document.getElementById('wellness_energy')?.value || 7}/10, Morale ${document.getElementById('wellness_morale')?.value || 7}/10)
      </span>
    `;
  }

  const container = document.getElementById('review-summary-container');
  if (!container) return;

  container.innerHTML = `
    <!-- Scenario Quick Preset Buttons -->
    <div class="card mb-3" style="background: var(--bg-card); border: 1px solid var(--border-color);">
      <div class="d-flex justify-between align-center mb-2 flex-wrap gap-1">
        <div class="d-flex align-center gap-1">
          <svg class="svg-icon" style="color:var(--accent); width:15px; height:15px;" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <div>
            <strong style="font-size:0.9rem;">1-Click 5-Source Test Presets:</strong>
            <div class="text-muted" style="font-size:0.75rem;">Simulate low, moderate, or severe multi-source operational conditions</div>
          </div>
        </div>
        <div class="d-flex gap-1 flex-wrap">
          <button type="button" class="btn btn-sm btn-secondary" style="border-color:var(--risk-low); color:var(--risk-low);" onclick="setScenarioPreset('LOW')">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--risk-low);margin-right:4px;"></span>Low Strain
          </button>
          <button type="button" class="btn btn-sm btn-secondary" style="border-color:var(--risk-mod); color:var(--risk-mod);" onclick="setScenarioPreset('MOD')">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--risk-mod);margin-right:4px;"></span>Moderate Strain
          </button>
          <button type="button" class="btn btn-sm btn-secondary" style="border-color:var(--risk-high); color:var(--risk-high);" onclick="setScenarioPreset('HIGH')">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--risk-high);margin-right:4px;"></span>High Strain
          </button>
        </div>
      </div>
    </div>

    <!-- Live Editable Summary Breakdown -->
    <div class="card mb-3" style="background: var(--bg-card-subtle); border: 1px solid var(--border-color);">
      <div class="d-flex justify-between align-center mb-3 pb-2" style="border-bottom: 1px solid var(--border-color);">
        <div>
          <h3 style="margin-bottom:0.15rem;">Multi-Source Input Review</h3>
          <span class="text-muted" style="font-size:0.8rem;">Adjust any parameter directly or return to previous wizard steps</span>
        </div>
        <div class="d-flex gap-1 flex-wrap">
          <button type="button" class="btn btn-sm btn-outline" onclick="goToStep(1)">Duty/Workload (1)</button>
          <button type="button" class="btn btn-sm btn-outline" onclick="goToStep(2)">Recovery (2)</button>
          <button type="button" class="btn btn-sm btn-outline" onclick="goToStep(3)">Self-Check (3)</button>
          <button type="button" class="btn btn-sm btn-outline" onclick="goToStep(4)">Smart Jacket (4)</button>
        </div>
      </div>

      <div class="grid-3" style="gap: 0.75rem;">
        <!-- Weekly Workload -->
        <div class="card" style="padding: 0.75rem; background: var(--bg-card);">
          <div class="d-flex justify-between align-center mb-1">
            <label class="form-label mb-0" for="rev_workload"><strong>Weekly Workload</strong></label>
            <input type="number" id="rev_workload" class="form-control form-control-sm" style="width:75px; text-align:center; font-weight:700;" min="30" max="90" value="${workload}" oninput="syncReviewInput('workload_hours', this.value)">
          </div>
          <small class="text-muted">hrs/wk (Duty Source)</small>
        </div>

        <!-- Work Pressure -->
        <div class="card" style="padding: 0.75rem; background: var(--bg-card);">
          <div class="d-flex justify-between align-center mb-1">
            <label class="form-label mb-0" for="rev_pressure"><strong>Work Pressure</strong></label>
            <input type="number" id="rev_pressure" class="form-control form-control-sm" style="width:75px; text-align:center; font-weight:700;" min="1" max="10" value="${pressure}" oninput="syncReviewInput('work_pressure_rating', this.value)">
          </div>
          <small class="text-muted">scale 1-10 (Workload Source)</small>
        </div>

        <!-- Prolonged Continuous Shift -->
        <div class="card" style="padding: 0.75rem; background: var(--bg-card);">
          <div class="d-flex justify-between align-center mb-1">
            <label class="form-label mb-0" for="rev_prolonged"><strong>Prolonged Duty</strong></label>
            <input type="number" id="rev_prolonged" class="form-control form-control-sm" style="width:75px; text-align:center; font-weight:700;" min="4" max="24" value="${prolonged}" oninput="syncReviewInput('prolonged_duty_hours', this.value)">
          </div>
          <small class="text-muted">continuous shift hrs (Duty)</small>
        </div>

        <!-- Night Duty -->
        <div class="card" style="padding: 0.75rem; background: var(--bg-card);">
          <div class="d-flex justify-between align-center mb-1">
            <label class="form-label mb-0" for="rev_night"><strong>Night Duty</strong></label>
            <input type="number" id="rev_night" class="form-control form-control-sm" style="width:75px; text-align:center; font-weight:700;" min="0" max="48" value="${night}" oninput="syncReviewInput('night_duty_hours', this.value)">
          </div>
          <small class="text-muted">night hrs/wk (Duty)</small>
        </div>

        <!-- Recovery Sleep -->
        <div class="card" style="padding: 0.75rem; background: var(--bg-card);">
          <div class="d-flex justify-between align-center mb-1">
            <label class="form-label mb-0" for="rev_sleep"><strong>Daily Sleep</strong></label>
            <input type="number" step="0.5" id="rev_sleep" class="form-control form-control-sm" style="width:75px; text-align:center; font-weight:700;" min="3" max="10" value="${sleep}" oninput="syncReviewInput('recovery_sleep_hours', this.value)">
          </div>
          <small class="text-muted">hrs/day (Recovery Source)</small>
        </div>

        <!-- Continuous Shifts -->
        <div class="card" style="padding: 0.75rem; background: var(--bg-card);">
          <div class="d-flex justify-between align-center mb-1">
            <label class="form-label mb-0" for="rev_shifts"><strong>Consecutive Days</strong></label>
            <input type="number" id="rev_shifts" class="form-control form-control-sm" style="width:75px; text-align:center; font-weight:700;" min="0" max="21" value="${shifts}" oninput="syncReviewInput('shift_continuity_days', this.value)">
          </div>
          <small class="text-muted">continuous days (Duty)</small>
        </div>
      </div>

      <!-- Evidence Source Status Rows -->
      <div class="grid-2 mt-2" style="gap:0.75rem;">
        <!-- PSS Status -->
        <div class="card" style="padding: 0.75rem; background: var(--bg-card);">
          <div class="d-flex justify-between align-center">
            <div>
              <strong>Self-Check (PSS-10)</strong>
              <div class="text-muted" style="font-size:0.75rem;">Subjective perception pillar</div>
            </div>
            <span class="badge ${pssData.score != null ? 'badge-primary' : 'badge-neutral'}" style="font-size:0.95rem; font-weight:700;">
              ${pssData.score != null ? `${pssData.score} / 40` : 'Skipped / Rely on Ops'}
            </span>
          </div>
        </div>

        <!-- Smart Jacket Status -->
        <div class="card" style="padding: 0.75rem; background: var(--bg-card);">
          <div class="d-flex justify-between align-center">
            <div>
              <strong>Smart Jacket Telemetry</strong>
              <div class="text-muted" style="font-size:0.75rem;">Autonomic biometrics pillar</div>
            </div>
            <span class="badge ${wearableEnabled ? 'badge-low' : 'badge-neutral'}" style="font-size:0.95rem; font-weight:700;">
              ${wearableEnabled ? `${rhr} BPM | ${hrv} ms` : 'Standby / Optional'}
            </span>
          </div>
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
      submitBtn.innerHTML = `<div class="spinner"></div> Submitting 5-Source Evidence to Random Forest...`;
    }

    try {
      const pssData = calculatePSSScore();

      const payload = {
        duty_type: document.getElementById('duty_type')?.value || 'Patrol & Active Security',
        workload_hours: parseFloat(document.getElementById('workload_hours').value),
        work_pressure_rating: parseFloat(document.getElementById('work_pressure_rating').value),
        shift_continuity_days: parseFloat(document.getElementById('shift_continuity_days').value),
        prolonged_duty_hours: parseFloat(document.getElementById('prolonged_duty_hours').value),
        night_duty_hours: parseFloat(document.getElementById('night_duty_hours').value),
        recovery_sleep_hours: parseFloat(document.getElementById('recovery_sleep_hours').value),
        rest_interval_hours: parseFloat(document.getElementById('rest_interval_hours').value),
        recovery_pattern: document.getElementById('recovery_pattern').value,
        social_support_rating: parseFloat(document.getElementById('social_support_rating').value),
        work_life_balance_rating: parseFloat(document.getElementById('work_life_balance_rating').value),
        notes: document.getElementById('checkin_notes')?.value || ''
      };

      // Multi-dimensional Wellness Information (Task 4)
      const energyEl = document.getElementById('wellness_energy');
      const moraleEl = document.getElementById('wellness_morale');
      const tensionEl = document.getElementById('wellness_tension');
      const nutritionEl = document.getElementById('wellness_nutrition');
      const wellnessNotesEl = document.getElementById('wellness_notes');

      if (energyEl || moraleEl || tensionEl || nutritionEl || wellnessNotesEl) {
        payload.wellnessInfo = {
          energy_level: energyEl ? parseFloat(energyEl.value) : 7,
          morale_rating: moraleEl ? parseFloat(moraleEl.value) : 7,
          physical_tension: tensionEl ? parseFloat(tensionEl.value) : 3,
          nutrition_hydration: nutritionEl ? nutritionEl.value : 'BALANCED',
          wellness_notes: wellnessNotesEl ? wellnessNotesEl.value.trim() : ''
        };
      }

      // Optional Welfare Support Request Integration (Task 4 & 6)
      const reqSupportChecked = document.getElementById('checkin_request_support_toggle')?.checked;
      if (reqSupportChecked) {
        payload.requestWelfareSupport = true;
        payload.welfareSupportType = document.getElementById('checkin_support_type')?.value || 'HUMAN_WELFARE_REVIEW';
        payload.welfareUrgency = document.getElementById('checkin_support_urgency')?.value || 'ROUTINE';
        payload.welfareSupportNotes = document.getElementById('checkin_support_notes')?.value?.trim() || '';
      }

      // Handle optional PSS-10
      if (!pssSkipped && pssData.answeredCount > 0) {
        payload.pss_score = pssData.score;
        payload.pss_responses = pssData.pssResponses;
      } else {
        payload.pss_score = null;
      }

      // Handle optional Smart Jacket biometrics
      if (wearableEnabled) {
        payload.resting_heart_rate = parseFloat(document.getElementById('resting_heart_rate').value);
        payload.hrv_ms = parseFloat(document.getElementById('hrv_ms').value);
        payload.respiration_rate = parseFloat(document.getElementById('respiration_rate').value);
        payload.skin_temperature_c = parseFloat(document.getElementById('skin_temperature_c').value);
        payload.activity_movement = document.getElementById('activity_movement').value;
        payload.posture_inactivity = document.getElementById('posture_inactivity').value;
        payload.fatigue_physical_strain = parseFloat(document.getElementById('fatigue_physical_strain').value);
        payload.wearable_synced = true;
      }

      // Generate unique idempotency key to prevent duplicate records
      payload.idempotencyKey = typeof OfflineVault !== 'undefined'

        ? OfflineVault.generateIdempotencyKey('chk')
        : `chk-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      // Check if browser is currently offline
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (typeof OfflineVault !== 'undefined') {
          await OfflineVault.saveCheckIn(payload);
          if (wearableEnabled) {
            await OfflineVault.saveWearableTelemetry({
              deviceId: 'TACTICAL-JACKET-CRPF-01',
              deviceType: 'TACTICAL_SMART_JACKET',
              telemetry: {
                resting_heart_rate: payload.resting_heart_rate,
                hrv_ms: payload.hrv_ms,
                respiration_rate: payload.respiration_rate,
                skin_temperature_c: payload.skin_temperature_c,
                fatigue_physical_strain: payload.fatigue_physical_strain,
                activity_movement: payload.activity_movement,
                posture_inactivity: payload.posture_inactivity
              }
            });
          }
          Utils.showToast('Offline Mode: Check-in securely buffered in local vault! It will sync automatically when online.', 'warning', 4500);
          setTimeout(() => {
            window.location.href = '/dashboard.html';
          }, 1500);
          return;
        }
      }

      // Online submission attempt
      try {
        const res = await api.submitCheckIn(payload);
        if (res && res.success) {
          if (res.isDuplicate) {
            Utils.showToast('Notice: Identical check-in already synchronized previously.', 'info');
          } else {
            Utils.showToast(`Check-in processed across ${res.data.evidenceCount || 3} evidence sources! AI Prediction generated.`, 'success');
          }
          setTimeout(() => {
            window.location.href = '/ai-analysis.html';
          }, 800);
        }
      } catch (submitErr) {
        // Network connection error fallback: buffer securely
        const isNetworkErr = !navigator.onLine || 
                             submitErr.message.includes('fetch') || 
                             submitErr.message.includes('network') ||
                             submitErr.message.includes('Failed to fetch');

        if (isNetworkErr && typeof OfflineVault !== 'undefined') {
          await OfflineVault.saveCheckIn(payload);
          Utils.showToast('Network disconnected: Check-in saved to local offline vault. Auto-sync will resume when connection returns.', 'warning', 4500);
          setTimeout(() => {
            window.location.href = '/dashboard.html';
          }, 1500);
          return;
        }
        throw submitErr;
      }
    } catch (err) {
      Utils.showToast(`Error submitting check-in: ${err.message}`, 'danger');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Complete & Generate AI Prediction &rarr;`;
      }
    }
  });
}


// Tactical Wearable & Smart Jacket Bluetooth / IoT Streaming Engine
let activeBleDevice = null;
let activeHrCharacteristic = null;
let simulatedTelemetryInterval = null;
let ecgAnimId = null;
let ecgPhase = 0;
let liveBpm = 68;

function startEcgVisualizer() {
  const canvas = document.getElementById('ecg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (ecgAnimId) cancelAnimationFrame(ecgAnimId);

  const w = canvas.width;
  const h = canvas.height;
  const mid = h / 2;

  function renderEcg() {
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#10b981';

    ecgPhase = (ecgPhase + (liveBpm / 60) * 1.6) % 360;

    for (let x = 0; x < w; x++) {
      const relX = (x + ecgPhase) % 90;
      let y = mid;

      if (relX >= 20 && relX < 26) {
        // P-wave
        y = mid - Math.sin(((relX - 20) / 6) * Math.PI) * 3;
      } else if (relX >= 27 && relX < 29) {
        // Q-dip
        y = mid + 3;
      } else if (relX >= 29 && relX < 33) {
        // R-peak
        y = mid - 14;
      } else if (relX >= 33 && relX < 35) {
        // S-dip
        y = mid + 4;
      } else if (relX >= 42 && relX < 56) {
        // T-wave
        y = mid - Math.sin(((relX - 42) / 14) * Math.PI) * 4.5;
      }

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const pulseIcon = document.getElementById('heartbeat-pulse-icon');
    if (pulseIcon) {
      const isPeak = Math.floor(ecgPhase % 90) >= 27 && Math.floor(ecgPhase % 90) <= 33;
      pulseIcon.style.transform = isPeak ? 'scale(1.18)' : 'scale(1)';
    }

    ecgAnimId = requestAnimationFrame(renderEcg);
  }

  renderEcg();
}

function parseHeartRateMeasurement(value) {
  const flags = value.getUint8(0);
  const is16Bit = flags & 0x01;
  let bpm = 0;
  let offset = 1;

  if (is16Bit) {
    bpm = value.getUint16(offset, true);
    offset += 2;
  } else {
    bpm = value.getUint8(offset);
    offset += 1;
  }

  if (flags & 0x08) {
    offset += 2;
  }

  const rrIntervals = [];
  if (flags & 0x10) {
    while (offset + 1 < value.byteLength) {
      const rr = value.getUint16(offset, true);
      rrIntervals.push(Math.round((rr / 1024) * 1000));
      offset += 2;
    }
  }

  return { bpm, rrIntervals };
}

function updateDynamicTelemetry(bpm, rrIntervals = [], sourceLabel = '') {
  liveBpm = Math.max(48, Math.min(130, Math.round(bpm)));

  let hrv = 65;
  if (rrIntervals.length >= 2) {
    let diffSquares = 0;
    for (let i = 1; i < rrIntervals.length; i++) {
      const d = rrIntervals[i] - rrIntervals[i - 1];
      diffSquares += d * d;
    }
    hrv = Math.round(Math.sqrt(diffSquares / (rrIntervals.length - 1)));
  } else {
    hrv = Math.round(Math.max(25, Math.min(95, 110 - (liveBpm * 0.7) + (Math.sin(Date.now() / 4000) * 3))));
  }

  // Derive respiration rate and strain from live biometrics
  const respRate = Math.round(Math.max(12, Math.min(28, 12 + ((liveBpm - 55) * 0.18))));
  const strainScore = Math.round(Math.max(15, Math.min(95, ((liveBpm - 50) * 0.9) + (Math.max(0, 65 - hrv) * 0.7))));
  const skinTemp = (36.4 + (liveBpm > 85 ? (liveBpm - 85) * 0.04 : 0)).toFixed(1);

  // Auto-enable wearable pillar
  toggleWearablePillar(true);

  // Update DOM inputs
  const rhrInput = document.getElementById('resting_heart_rate');
  const rhrVal = document.getElementById('val_rhr');
  if (rhrInput && rhrVal) {
    rhrInput.value = liveBpm;
    rhrVal.textContent = liveBpm;
  }

  const hrvInput = document.getElementById('hrv_ms');
  const hrvVal = document.getElementById('val_hrv');
  if (hrvInput && hrvVal) {
    hrvInput.value = hrv;
    hrvVal.textContent = hrv;
  }

  const respInput = document.getElementById('respiration_rate');
  const respVal = document.getElementById('val_resp');
  if (respInput && respVal) {
    respInput.value = respRate;
    respVal.textContent = respRate;
  }

  const tempInput = document.getElementById('skin_temperature_c');
  const tempVal = document.getElementById('val_temp');
  if (tempInput && tempVal) {
    tempInput.value = skinTemp;
    tempVal.textContent = skinTemp;
  }

  const strainInput = document.getElementById('fatigue_physical_strain');
  const strainVal = document.getElementById('val_strain');
  if (strainInput && strainVal) {
    strainInput.value = strainScore;
    strainVal.textContent = strainScore;
  }

  // Visual header displays
  const resultsGrid = document.getElementById('wearable-sync-results');
  if (resultsGrid) resultsGrid.style.display = 'block';

  const liveBpmEl = document.getElementById('live-bpm-value');
  if (liveBpmEl) liveBpmEl.textContent = liveBpm;

  startEcgVisualizer();
}

async function syncTacticalWearable(isRealBluetooth = false) {
  const simBtn = document.getElementById('btn-sync-wearable');
  const bleBtn = document.getElementById('btn-real-bluetooth');
  const modeBadge = document.getElementById('wearable-mode-badge');
  const deviceNameEl = document.getElementById('sensor-device-name');
  const statusTextEl = document.getElementById('sensor-status-text');

  if (isRealBluetooth) {
    if (!navigator.bluetooth) {
      Utils.showToast('Web Bluetooth API is not supported in this browser. Use Chrome/Edge over HTTPS/localhost, or use Auto-Sync Smart Jacket.', 'warning', 4500);
      return;
    }

    try {
      if (bleBtn) {
        bleBtn.disabled = true;
        bleBtn.innerHTML = `<span class="spinner spinner-primary" style="display:inline-block; width:12px; height:12px; margin-right:4px;"></span> Scanning for Smart Jacket...`;
      }

      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['battery_service', 'device_information']
      }).catch(async (e) => {
        if (e.name !== 'NotFoundError') {
          return await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['heart_rate', 'battery_service', 'device_information']
          });
        }
        throw e;
      });

      activeBleDevice = device;

      device.addEventListener('gattserverdisconnected', () => {
        Utils.showToast(`Smart Jacket (${device.name || 'Wearable'}) disconnected.`, 'warning');
        if (modeBadge) {
          modeBadge.textContent = 'Disconnected';
          modeBadge.className = 'badge badge-neutral';
        }
        if (statusTextEl) statusTextEl.textContent = 'Sensor Disconnected';
        if (bleBtn) {
          bleBtn.disabled = false;
          bleBtn.innerHTML = `<svg class="svg-icon" style="width:13px;height:13px;margin-right:4px;" viewBox="0 0 24 24"><path d="m7 7 10 10-5 5V2l5 5L7 17"/></svg> Pair Real Bluetooth (BLE GATT)`;
          bleBtn.className = 'btn btn-sm btn-outline';
        }
      });

      if (bleBtn) {
        bleBtn.innerHTML = `<span class="spinner spinner-primary" style="display:inline-block; width:12px; height:12px; margin-right:4px;"></span> Connecting GATT...`;
      }

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('heart_rate');
      activeHrCharacteristic = await service.getCharacteristic('heart_rate_measurement');

      await activeHrCharacteristic.startNotifications();
      activeHrCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
        const { bpm, rrIntervals } = parseHeartRateMeasurement(event.target.value);
        updateDynamicTelemetry(bpm, rrIntervals, `Live BLE: ${device.name || 'CRPF Smart Jacket'}`);
      });

      if (modeBadge) {
        modeBadge.textContent = `Live BLE: ${device.name || 'Smart Jacket'}`;
        modeBadge.className = 'badge badge-low';
      }
      if (deviceNameEl) deviceNameEl.textContent = device.name || 'Paired Smart Jacket (BLE GATT)';
      if (statusTextEl) statusTextEl.textContent = 'Live GATT Stream Active';

      if (bleBtn) {
        bleBtn.disabled = false;
        bleBtn.innerHTML = `<svg class="svg-icon" style="width:13px;height:13px;margin-right:4px;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Connected: ${device.name || 'Smart Jacket'}`;
        bleBtn.className = 'btn btn-sm btn-secondary';
        bleBtn.style.color = 'var(--risk-low)';
      }

      Utils.showToast(`Connected to ${device.name || 'Tactical Smart Jacket'}! Live biometric telemetry streaming.`, 'success');

    } catch (err) {
      if (bleBtn) {
        bleBtn.disabled = false;
        bleBtn.innerHTML = `<svg class="svg-icon" style="width:13px;height:13px;margin-right:4px;" viewBox="0 0 24 24"><path d="m7 7 10 10-5 5V2l5 5L7 17"/></svg> Pair Real Bluetooth (BLE GATT)`;
        bleBtn.className = 'btn btn-sm btn-outline';
      }
      if (err.name === 'NotFoundError') {
        Utils.showToast('Bluetooth pairing cancelled. Click "Auto-Sync Smart Jacket" to run with synthetic sensor telemetry.', 'info', 3500);
      } else {
        Utils.showToast(`Bluetooth notice: ${err.message}`, 'warning', 4000);
      }
    }

  } else {
    // Simulated Smart Jacket Telemetry Engine
    if (simBtn) {
      simBtn.disabled = true;
      simBtn.innerHTML = `<span class="spinner spinner-primary" style="display:inline-block; width:12px; height:12px; margin-right:4px;"></span> Calibrating Smart Jacket Sensors...`;
    }

    if (simulatedTelemetryInterval) clearInterval(simulatedTelemetryInterval);

    setTimeout(() => {
      if (modeBadge) {
        modeBadge.textContent = 'CRPF Smart Jacket Telemetry';
        modeBadge.className = 'badge badge-low';
      }
      if (deviceNameEl) deviceNameEl.textContent = 'CRPF Tactical Smart Jacket V2 (Embedded IoT)';
      if (statusTextEl) statusTextEl.textContent = 'Active Telemetry Stream';

      let currentSimBpm = 66;
      updateDynamicTelemetry(currentSimBpm, [980, 995, 970, 985], 'CRPF Tactical Smart Jacket');

      simulatedTelemetryInterval = setInterval(() => {
        const jitter = (Math.random() - 0.48) * 2.5;
        currentSimBpm = Math.max(54, Math.min(78, Math.round(currentSimBpm + jitter)));
        const syntheticRr = [
          Math.round(60000 / currentSimBpm - (Math.random() * 20)),
          Math.round(60000 / currentSimBpm + (Math.random() * 20))
        ];
        updateDynamicTelemetry(currentSimBpm, syntheticRr, 'CRPF Tactical Smart Jacket');
      }, 2200);

      if (simBtn) {
        simBtn.disabled = false;
        simBtn.innerHTML = `<svg class="svg-icon" style="width:13px;height:13px;margin-right:4px;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Smart Jacket Telemetry Active`;
        simBtn.className = 'btn btn-sm btn-secondary';
        simBtn.style.color = 'var(--risk-low)';
      }

      Utils.showToast('Smart Jacket continuous biometric stream connected and calibrated.', 'success');
    }, 600);
  }
}

function toggleCheckinSupportFields(checked) {
  const fields = document.getElementById('checkin-support-fields');
  if (fields) fields.style.display = checked ? 'block' : 'none';
}

function openQuickSupportModal() {
  const modal = document.getElementById('quick-support-modal');
  if (modal) modal.style.display = 'flex';
}

function closeQuickSupportModal() {
  const modal = document.getElementById('quick-support-modal');
  if (modal) modal.style.display = 'none';
}

async function submitQuickSupportRequest() {
  const btn = document.getElementById('btn-quick-support-submit');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Submitting...';
  }

  const payload = {
    requestType: document.getElementById('quick_req_type')?.value || 'HUMAN_WELFARE_REVIEW',
    urgency: document.getElementById('quick_req_urgency')?.value || 'ROUTINE',
    preferredContactMethod: document.getElementById('quick_req_contact')?.value || 'CONFIDENTIAL_IN_PERSON',
    notes: document.getElementById('quick_req_notes')?.value?.trim() || '',
    description: document.getElementById('quick_req_notes')?.value?.trim() || ''
  };

  try {
    const res = await api.createSupportRequest(payload);
    if (res && res.success) {
      Utils.showToast(`Confidential request (${res.data?.referenceId || 'REQ'}) submitted! Unit Welfare Officer notified.`, 'success', 4500);
      closeQuickSupportModal();
    } else {
      Utils.showToast(res.message || 'Failed to submit support request.', 'error');
    }
  } catch (err) {
    Utils.showToast(err.message || 'Error submitting support request.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Submit Confidential Request';
    }
  }
}

document.addEventListener('DOMContentLoaded', initCheckInWizard);
