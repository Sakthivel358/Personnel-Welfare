/**
 * Welfare Officer Portal & Human-in-the-Loop Review Engine
 */

let activeAlerts = [];
let selectedAlert = null;

async function loadOfficerDashboard() {
  try {
    const [dashRes, alertsRes] = await Promise.all([
      api.getOfficerDashboard(),
      api.getOfficerAlerts()
    ]);

    if (dashRes && dashRes.success) {
      updateOfficerStats(dashRes.data);
      if (dashRes.data.riskDistribution) {
        ChartsManager.renderDistributionChart('risk-distribution-chart', dashRes.data.riskDistribution);
      }
    }

    if (alertsRes && alertsRes.success) {
      activeAlerts = alertsRes.data;
      renderAlertsTable(activeAlerts);
    }
  } catch (err) {
    console.error('Error loading officer dashboard:', err);
    Utils.showToast('Unable to load welfare officer data. ' + err.message, 'danger');
  }
}

function updateOfficerStats(data) {
  const totalEl = document.getElementById('stat-total-monitored');
  const highEl = document.getElementById('stat-high-risk');
  const pendingEl = document.getElementById('stat-pending-alerts');
  const followupsEl = document.getElementById('stat-active-followups');

  if (totalEl) totalEl.textContent = data.totalMonitoredPersonnel || 0;
  if (highEl) highEl.textContent = data.riskDistribution?.HIGH || 0;
  if (pendingEl) pendingEl.textContent = data.alertsCount?.pending || 0;
  if (followupsEl) followupsEl.textContent = data.followUpsCount?.active || 0;
}

function renderAlertsTable(alerts) {
  const tbody = document.getElementById('alerts-table-body');
  if (!tbody) return;

  if (alerts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted" style="padding: 2rem;">
          No welfare alerts currently requiring review.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = alerts.map(a => {
    const concernHtml = Utils.getWelfareConcernDisplay(a.concernLevel);
    const evidenceHtml = Utils.getEvidenceStrengthDisplay(a.evidenceStrength);
    const dataAvailHtml = Utils.getDataAvailableDisplay(a.dataAvailableCount != null ? a.dataAvailableCount : 4, 5);
    const driversList = (a.topDrivers || []).slice(0, 3).join(', ');

    return `
    <tr>
      <td><strong>${a.personnelId}</strong></td>
      <td>${a.personnelName} <div class="text-muted" style="font-size:0.75rem;">${a.rank} • ${a.unit}</div></td>
      <td>${Utils.getPriorityBadge(a.priority)}</td>
      <td>
        <div class="d-flex flex-column gap-1">
          <div>${concernHtml}</div>
          <div class="d-flex gap-1 flex-wrap mt-1">
            ${evidenceHtml}
            ${dataAvailHtml}
          </div>
          ${driversList ? `<div class="text-muted" style="font-size:0.75rem; margin-top:0.25rem;"><strong>Drivers:</strong> ${driversList}</div>` : ''}
        </div>
      </td>
      <td>${Utils.getStatusBadge(a.status)}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="openReviewModal('${a._id}')">
          Review Signal
        </button>
      </td>
    </tr>
  `;
  }).join('');
}

async function openReviewModal(alertId) {
  selectedAlert = activeAlerts.find(a => String(a._id) === String(alertId));
  if (!selectedAlert) return;

  const modal = document.getElementById('review-alert-modal');
  const detailsEl = document.getElementById('modal-alert-details');
  if (!modal || !detailsEl) return;

  modal.style.display = 'flex';
  detailsEl.innerHTML = `
    <div class="text-center py-4">
      <div class="spinner spinner-primary" style="margin: 0 auto 0.5rem;"></div>
      <div class="text-muted" style="font-size:0.85rem;">Hydrating full 7-stage workflow dossier...</div>
    </div>
  `;

  try {
    const wfRes = await api.getAlertWorkflow(alertId);
    const wf = (wfRes && wfRes.success) ? wfRes.data : null;

    if (!wf) {
      throw new Error('Failed to retrieve workflow package.');
    }

    const st1 = wf.alert;
    const st2 = wf.evidence;
    const st3 = wf.contributors;
    const st4 = wf.whatChanged;

    const concernBadge = Utils.getWelfareConcernDisplay(st1.concernLevel);
    const evidenceBadge = Utils.getEvidenceStrengthDisplay(st2.evidenceStrength);
    const dataAvailBadge = Utils.getDataAvailableDisplay(st2.dataAvailableCount, 5);

    // Render Contributors list
    const contribsHtml = (st3.mainContributors && st3.mainContributors.length > 0)
      ? st3.mainContributors.map(c => {
          const label = c.directionalTitle || c.title || c.factor || 'Operational factor';
          const isDriver = c.isRiskDriver || c.impactLevel === 'HIGH' || c.direction === 'UP';
          return `<span class="badge" style="background:${isDriver ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)'}; color:${isDriver ? '#ef4444' : '#3b82f6'}; border:1px solid ${isDriver ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.25)'}; font-size:0.75rem; padding:3px 8px; font-weight:600;">${label}</span>`;
        }).join(' ')
      : `<span class="text-muted" style="font-size:0.8rem;">Operating within normal baseline ranges</span>`;

    // Render What Changed / Personal Baseline comparison
    let whatChangedHtml = '';
    if (st4.baselineEstablished && st4.comparisonCategories) {
      const cats = st4.comparisonCategories;
      whatChangedHtml = `
        <div class="table-responsive mt-2">
          <table class="table" style="font-size:0.8rem; margin-bottom:0;">
            <thead>
              <tr style="background:var(--bg-card-subtle);">
                <th style="padding:0.4rem 0.6rem;">Category</th>
                <th style="padding:0.4rem 0.6rem;">Normal Pattern</th>
                <th style="padding:0.4rem 0.6rem;">Current Check-In</th>
                <th style="padding:0.4rem 0.6rem;">Variance / Shift</th>
              </tr>
            </thead>
            <tbody>
              ${['workload', 'rest', 'fatigue', 'stress_indicators'].map(k => {
                const item = cats[k];
                if (!item) return '';
                const dirColor = (item.delta > 0 && k !== 'rest') || (item.delta < 0 && k === 'rest') ? '#ef4444' : '#10b981';
                return `
                  <tr>
                    <td style="padding:0.4rem 0.6rem; font-weight:600;">${item.categoryName}</td>
                    <td style="padding:0.4rem 0.6rem;">${item.normalPatternDisplay}</td>
                    <td style="padding:0.4rem 0.6rem; font-weight:700;">${item.currentDisplay}</td>
                    <td style="padding:0.4rem 0.6rem; color:${dirColor}; font-weight:700;">${item.directionalDescription || item.delta}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      whatChangedHtml = `
        <div class="p-2 text-center" style="background:var(--bg-card); border-radius:6px; font-size:0.8rem; color:var(--text-secondary);">
          ⚖️ <strong>Baseline not established yet.</strong> Additional authorized data or a welfare check-in is required to compute historical shift.
        </div>
      `;
    }

    detailsEl.innerHTML = `
      <div class="card mb-3 p-3" style="background:var(--bg-card); border:1px solid var(--border-color);">
        <!-- Stage 1: Alert Header -->
        <div class="d-flex justify-between align-center mb-2 pb-2" style="border-bottom:1px solid var(--border-color);">
          <div>
            <span style="font-size:0.75rem; font-weight:700; color:var(--accent); text-transform:uppercase;">Stage 1: Alert Dossier</span>
            <h4 style="margin:0.2rem 0;">${st1.personnelName} (${st1.personnelId}) — ${st1.rank} • ${st1.unit}</h4>
            <div class="text-muted" style="font-size:0.78rem;">Triggered: ${Utils.formatDate(st1.triggeredAt)} • Risk Score: <strong>${st1.compositeRiskScore != null ? Math.round(st1.compositeRiskScore) + '%' : 'N/A'}</strong></div>
          </div>
          <div>${Utils.getPriorityBadge(st1.priority)}</div>
        </div>

        <!-- Stage 2: Evidence & Badges -->
        <div class="mb-3">
          <div style="font-size:0.75rem; font-weight:700; color:var(--accent); text-transform:uppercase; margin-bottom:0.35rem;">Stage 2: Evidence Verification</div>
          <div class="d-flex gap-1 flex-wrap align-center">
            ${concernBadge}
            ${evidenceBadge}
            ${dataAvailBadge}
          </div>
          <div class="text-muted mt-1" style="font-size:0.75rem;">Verified Streams: ${st2.evidenceSources.join(', ')} • ${st2.qualityAssessment}</div>
        </div>

        <!-- Stage 3: Contributors -->
        <div class="mb-3">
          <div style="font-size:0.75rem; font-weight:700; color:var(--accent); text-transform:uppercase; margin-bottom:0.35rem;">Stage 3: Main Contributing Drivers</div>
          <div class="d-flex gap-1 flex-wrap align-center">
            ${contribsHtml}
          </div>
        </div>

        <!-- Stage 4: What Changed -->
        <div class="mb-2">
          <div class="d-flex justify-between align-center">
            <div style="font-size:0.75rem; font-weight:700; color:var(--accent); text-transform:uppercase;">Stage 4: What Changed (Your Normal Pattern vs Current)</div>
            <span class="text-muted" style="font-size:0.75rem;">Total Check-ins: ${st4.totalCheckInCount}</span>
          </div>
          ${whatChangedHtml}
        </div>
      </div>
    `;

    document.getElementById('modal_officer_status').value = st1.status || 'ACKNOWLEDGED';
    document.getElementById('modal_officer_notes').value = selectedAlert.officerNotes || '';
    if (document.getElementById('modal_support_action')) {
      document.getElementById('modal_support_action').value = selectedAlert.supportAction ? (selectedAlert.supportAction.id || selectedAlert.supportAction) : '';
    }
    document.getElementById('modal_assign_followup').checked = false;
    document.getElementById('followup-schedule-container').style.display = 'none';

  } catch (err) {
    console.error('Error hydrating workflow:', err);
    detailsEl.innerHTML = `
      <div class="alert alert-danger p-2" style="font-size:0.85rem;">
        Failed to load workflow dossier: ${err.message}. Using cached basic alert details.
      </div>
    `;
  }
}

function closeReviewModal() {
  const modal = document.getElementById('review-alert-modal');
  if (modal) modal.style.display = 'none';
  selectedAlert = null;
}

async function submitAlertReview() {
  if (!selectedAlert) return;

  const submitBtn = document.getElementById('modal-submit-review-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<div class="spinner"></div> Saving Review & Dispatching Support...`;
  }

  try {
    const status = document.getElementById('modal_officer_status').value;
    const supportAction = document.getElementById('modal_support_action')?.value || null;
    const officerNotes = document.getElementById('modal_officer_notes').value;
    const assignFollowUp = document.getElementById('modal_assign_followup').checked;
    const scheduledDate = document.getElementById('modal_scheduled_date')?.value;

    const res = await api.reviewAlert(selectedAlert._id, {
      status,
      reviewDecision: status,
      supportAction: supportAction ? { id: supportAction, notes: officerNotes } : null,
      officerNotes,
      assignFollowUp,
      scheduledDate,
      isNonPunitive: true
    });

    if (res && res.success) {
      Utils.showToast('Human review recorded! Non-punitive support action dispatched.', 'success');
      closeReviewModal();
      loadOfficerDashboard();
      if (typeof loadFollowUps === 'function') loadFollowUps();
    }
  } catch (err) {
    Utils.showToast(`Error saving review: ${err.message}`, 'danger');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Complete Officer Review & Dispatch Support`;
    }
  }
}

// Personnel Roster Loader
async function loadPersonnelRoster() {
  const tbody = document.getElementById('roster-table-body');
  if (!tbody) return;

  try {
    const res = await api.getPersonnelRoster();
    if (res && res.success) {
      const list = res.data;
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No personnel registered yet.</td></tr>`;
        return;
      }
      tbody.innerHTML = list.map(p => `
        <tr>
          <td><strong>${p.personnelId}</strong></td>
          <td>${p.fullName}</td>
          <td>${p.rank}</td>
          <td>${p.unit}</td>
          <td>${Utils.getConcernBadge(p.latestConcernLevel)}</td>
          <td>${p.lastAnalyzedAt ? Utils.formatDate(p.lastAnalyzedAt) : 'Not Assessed'}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading roster:', err);
  }
}
