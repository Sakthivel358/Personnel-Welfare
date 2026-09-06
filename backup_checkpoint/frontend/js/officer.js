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

  tbody.innerHTML = alerts.map(a => `
    <tr>
      <td><strong>${a.personnelId}</strong></td>
      <td>${a.personnelName} <div class="text-muted" style="font-size:0.75rem;">${a.rank} • ${a.unit}</div></td>
      <td>${Utils.getPriorityBadge(a.priority)}</td>
      <td>
        ${Utils.getConcernBadge(a.concernLevel)}
        <div class="text-muted" style="font-size:0.75rem;margin-top:0.2rem;">Risk Index: ${a.compositeRiskScore || 0}%</div>
      </td>
      <td>${Utils.getStatusBadge(a.status)}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="openReviewModal('${a._id}')">
          Review Signal
        </button>
      </td>
    </tr>
  `).join('');
}

function openReviewModal(alertId) {
  selectedAlert = activeAlerts.find(a => String(a._id) === String(alertId));
  if (!selectedAlert) return;

  const modal = document.getElementById('review-alert-modal');
  const detailsEl = document.getElementById('modal-alert-details');
  if (!modal || !detailsEl) return;

  detailsEl.innerHTML = `
    <div class="card mb-3" style="background: var(--bg-card-subtle);">
      <div class="d-flex justify-between align-center mb-2">
        <h4>${selectedAlert.personnelName} (${selectedAlert.personnelId})</h4>
        ${Utils.getConcernBadge(selectedAlert.concernLevel)}
      </div>
      <div class="grid-2 mb-2">
        <div><strong>Unit:</strong> ${selectedAlert.unit}</div>
        <div><strong>Rank:</strong> ${selectedAlert.rank}</div>
        <div><strong>Composite Score:</strong> ${selectedAlert.compositeRiskScore}%</div>
        <div><strong>Triggered:</strong> ${Utils.formatDate(selectedAlert.createdAt)}</div>
      </div>
      <div><strong>Top Contributing Risk Drivers:</strong> ${(selectedAlert.topDrivers || []).join(', ') || 'General Operational Strain'}</div>
    </div>
  `;

  document.getElementById('modal_officer_status').value = selectedAlert.status || 'ACKNOWLEDGED';
  document.getElementById('modal_officer_notes').value = selectedAlert.officerNotes || '';
  document.getElementById('modal_assign_followup').checked = false;

  modal.style.display = 'flex';
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
    submitBtn.innerHTML = `<div class="spinner"></div> Saving Review...`;
  }

  try {
    const status = document.getElementById('modal_officer_status').value;
    const officerNotes = document.getElementById('modal_officer_notes').value;
    const assignFollowUp = document.getElementById('modal_assign_followup').checked;
    const scheduledDate = document.getElementById('modal_scheduled_date')?.value;

    const res = await api.reviewAlert(selectedAlert._id, {
      status,
      officerNotes,
      assignFollowUp,
      scheduledDate
    });

    if (res && res.success) {
      Utils.showToast('Human review recorded! Follow-up workflow updated.', 'success');
      closeReviewModal();
      loadOfficerDashboard();
    }
  } catch (err) {
    Utils.showToast(`Error saving review: ${err.message}`, 'danger');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Confirm Officer Action`;
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
