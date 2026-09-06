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
        goToStep(3);
        populateReviewSummary();
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
    <div class="card mb-3" style="background: var(--bg-card-subtle);">
      <h4 class="mb-2">Summary of Submitted Indicators</h4>
      <div class="grid-2">
        <div><strong>Perceived Stress Score (PSS):</strong> ${score} / 40</div>
        <div><strong>Weekly Workload:</strong> ${workload} hrs/week</div>
        <div><strong>Work Pressure:</strong> ${pressure} / 10</div>
        <div><strong>Recovery & Sleep:</strong> ${sleep} hrs/day</div>
        <div><strong>Social Support:</strong> ${support} / 10</div>
        <div><strong>Work-Life Balance:</strong> ${wlb} / 10</div>
        <div><strong>Continuous Shift Days:</strong> ${shifts} days</div>
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

document.addEventListener('DOMContentLoaded', initCheckInWizard);
