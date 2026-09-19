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
          return `<span class="badge" style="background:${isDriver ? 'var(--risk-high-bg)' : 'var(--status-info-bg)'}; color:${isDriver ? 'var(--risk-high)' : 'var(--status-info)'}; border:1px solid ${isDriver ? 'var(--risk-high-border)' : 'var(--status-info-border)'}; font-size:0.75rem; padding:3px 8px; font-weight:600;">${label}</span>`;
        }).join(' ')
      : `<span class="text-muted" style="font-size:0.8rem;">Operating within normal baseline ranges</span>`;

    // Render What Changed / Personal Baseline comparison
    let whatChangedHtml = '';
    if (st4.baselineEstablished && st4.comparisonCategories) {
      const cats = st4.comparisonCategories;
      whatChangedHtml = `
        <div class="table-responsive mt-2">
          <table class="data-table" style="font-size:0.8rem; margin-bottom:0;">
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
                const dirColor = (item.delta > 0 && k !== 'rest') || (item.delta < 0 && k === 'rest') ? '#e11d48' : '#059669';
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
            <div class="d-flex gap-1 align-center flex-wrap mt-1 mb-1">
              ${st1.userToken ? `<span class="badge badge-neutral" style="font-family:monospace; font-size:0.72rem;">Token: ${st1.userToken}</span>` : ''}
              ${st1.ageGroup ? `<span class="badge badge-neutral" style="font-size:0.72rem;">Cohort: ${st1.ageGroup}</span>` : ''}
              ${st1.unitGroup ? `<span class="badge badge-neutral" style="font-size:0.72rem;">${st1.unitGroup}</span>` : ''}
            </div>
            <div class="text-muted" style="font-size:0.78rem;">Triggered: ${Utils.formatDate(st1.triggeredAt)} • Risk Score: <strong>${st1.compositeRiskScore != null ? Math.round(st1.compositeRiskScore) + '%' : 'N/A'}</strong></div>
          </div>
          <div>${Utils.getPriorityBadge(st1.priority)}</div>
        </div>

        <!-- Mandatory Non-Disciplinary Directive Notice -->
        <div class="alert alert-info p-2 mb-2" style="font-size:0.78rem; border-left:4px solid var(--accent); line-height:1.4;">
          <strong>🛡️ NON-DISCIPLINARY MANDATE:</strong> An ML prediction must never automatically become a disciplinary action. All findings are strictly non-punitive and protected.
        </div>

        <!-- Why Alert Was Generated -->
        ${st1.whyAlertGenerated ? `
          <div class="p-2 mb-3" style="background:rgba(59, 130, 246, 0.05); border-radius:6px; border:1px solid rgba(59, 130, 246, 0.2); font-size:0.8rem;">
            <div style="font-weight:700; color:var(--accent); margin-bottom:0.25rem;">🔍 Why this alert was generated:</div>
            <p style="margin:0 0 0.35rem; color:var(--text-main); line-height:1.4;">${st1.whyAlertGenerated.summary || 'Elevated welfare strain detected across operational telemetry.'}</p>
            ${st1.whyAlertGenerated.primaryFactors && st1.whyAlertGenerated.primaryFactors.length > 0 ? `
              <ul style="margin:0; padding-left:1.2rem; color:var(--text-muted); font-size:0.78rem;">
                ${st1.whyAlertGenerated.primaryFactors.map(f => `<li style="margin-bottom:0.15rem;">${f}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        ` : ''}

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

// ==========================================
// Personnel Welfare Search (Task Implementation)
// ==========================================

async function handlePersonnelSearch(event) {
  if (event) event.preventDefault();

  const input = document.getElementById('officer-personnel-search-input');
  const query = (input ? input.value : '').trim();

  const emptyEl = document.getElementById('search-state-empty');
  const notFoundEl = document.getElementById('search-state-notfound');
  const notFoundText = document.getElementById('search-notfound-text');
  const loadingEl = document.getElementById('search-state-loading');
  const resultsEl = document.getElementById('search-state-results');

  if (!query) {
    if (emptyEl) emptyEl.style.display = 'block';
    if (notFoundEl) notFoundEl.style.display = 'none';
    if (loadingEl) loadingEl.style.display = 'none';
    if (resultsEl) resultsEl.style.display = 'none';
    if (typeof Utils !== 'undefined' && Utils.showToast) {
      Utils.showToast('Please enter a Personnel or Service ID to search.', 'warning');
    }
    return;
  }

  // Set loading state
  if (emptyEl) emptyEl.style.display = 'none';
  if (notFoundEl) notFoundEl.style.display = 'none';
  if (resultsEl) resultsEl.style.display = 'none';
  if (loadingEl) loadingEl.style.display = 'block';

  try {
    const res = await api.searchOfficerPersonnel(query);

    if (loadingEl) loadingEl.style.display = 'none';

    if (!res || !res.success || !res.data || res.data.length === 0) {
      if (notFoundEl) {
        notFoundEl.style.display = 'block';
        if (notFoundText) {
          notFoundText.innerHTML = `No authorized personnel record matching <strong>"${Utils.sanitize(query)}"</strong> was found in the database. Please verify the service number or check with Unit Administration.`;
        }
      }
      return;
    }

    // Render results
    renderPersonnelSearchResults(res.data);

  } catch (err) {
    if (loadingEl) loadingEl.style.display = 'none';
    if (notFoundEl) {
      notFoundEl.style.display = 'block';
      if (notFoundText) {
        notFoundText.textContent = `Search error: ${err.message || 'Unable to retrieve personnel records.'}`;
      }
    }
    if (typeof Utils !== 'undefined' && Utils.showToast) {
      Utils.showToast(`Search failed: ${err.message}`, 'danger');
    }
  }
}

function resetPersonnelSearch() {
  const input = document.getElementById('officer-personnel-search-input');
  if (input) input.value = '';

  const emptyEl = document.getElementById('search-state-empty');
  const notFoundEl = document.getElementById('search-state-notfound');
  const loadingEl = document.getElementById('search-state-loading');
  const resultsEl = document.getElementById('search-state-results');

  if (emptyEl) emptyEl.style.display = 'block';
  if (notFoundEl) notFoundEl.style.display = 'none';
  if (loadingEl) loadingEl.style.display = 'none';
  if (resultsEl) {
    resultsEl.style.display = 'none';
    resultsEl.innerHTML = '';
  }
}

function renderPersonnelSearchResults(records) {
  const resultsEl = document.getElementById('search-state-results');
  if (!resultsEl) return;

  resultsEl.innerHTML = records.map(p => {
    const ws = p.welfareStatus || {};
    const concernHtml = Utils.getWelfareConcernDisplay 
      ? Utils.getWelfareConcernDisplay(ws.concernLevel) 
      : Utils.getConcernBadge(ws.concernLevel);

    const scoreDisplay = (ws.compositeRiskScore !== null && ws.compositeRiskScore !== undefined)
      ? `${ws.compositeRiskScore} / 100`
      : 'Unassessed';

    const recentCheckin = ws.lastCheckinAt 
      ? Utils.formatDate(ws.lastCheckinAt)
      : 'No check-in on record';

    const lastAnalyzed = ws.lastAnalyzedAt
      ? Utils.formatDate(ws.lastAnalyzedAt)
      : 'Unassessed';

    const shiftDisplay = ws.recentDutyHours ? `${ws.recentDutyHours} hrs/shift` : 'Standard Rotation';
    const weeklyDisplay = ws.recentWeeklyHours ? `${ws.recentWeeklyHours} hrs/wk` : 'Nominal';
    const sleepDisplay = ws.recentSleepHours ? `${ws.recentSleepHours} hrs/night` : 'Not reported';
    const hrvDisplay = ws.recentHrvMs ? `${ws.recentHrvMs} ms (HRV)` : 'Sensor Standby';
    const hrDisplay = ws.recentHeartRate ? `${ws.recentHeartRate} BPM` : 'Sensor Standby';

    return `
      <div class="card mb-3" style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); padding: 1.25rem; border-left: 4px solid var(--accent);">
        <!-- Top Info Header -->
        <div class="d-flex justify-between align-center flex-wrap gap-2 mb-3 pb-2" style="border-bottom: 1px solid var(--border-color);">
          <div class="d-flex align-center gap-2 flex-wrap">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem;">
              ${(p.fullName || 'P').charAt(0)}
            </div>
            <div>
              <div class="d-flex align-center gap-1 flex-wrap">
                <h3 style="margin: 0; font-size: 1.15rem;">${Utils.sanitize(p.fullName)}</h3>
                <span class="badge badge-primary" style="font-size: 0.78rem; font-weight: 700;">${Utils.sanitize(p.personnelId)}</span>
                <span class="badge badge-neutral" style="font-size: 0.75rem;">${Utils.sanitize(p.rank)}</span>
              </div>
              <div class="text-muted" style="font-size: 0.82rem; margin-top: 2px;">
                ${Utils.sanitize(p.unit)} • ${Utils.sanitize(p.deploymentZone)}
              </div>
            </div>
          </div>
          <div class="d-flex align-center gap-1 flex-wrap">
            <span class="badge ${p.isEnrolledInWelfare ? 'badge-low' : 'badge-neutral'}" style="font-size: 0.78rem;">
              ${p.isEnrolledInWelfare ? '✓ Enrolled in Welfare Program' : 'Standard Roster'}
            </span>
            ${ws.pendingAlertsCount > 0 ? `<span class="badge badge-high" style="font-size: 0.78rem;">⚠️ ${ws.pendingAlertsCount} Pending Alert(s)</span>` : `<span class="badge badge-low" style="font-size: 0.78rem;">0 Pending Alerts</span>`}
          </div>
        </div>

        <!-- 3-Column Authorized Welfare Details -->
        <div class="grid-3 mb-3">
          <!-- Column 1: Operational Duty & Posting -->
          <div class="card" style="background: var(--bg-card); padding: 1rem; border: 1px solid var(--border-color);">
            <div style="font-weight: 700; font-size: 0.85rem; color: var(--accent); margin-bottom: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em;">
              🛡️ Operational Duty Posture
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.82rem;">
              <div><span class="text-muted">Watch Profile:</span> <strong>${Utils.sanitize(p.dutyType)}</strong></div>
              <div><span class="text-muted">Rotation Schedule:</span> <strong>${Utils.sanitize(p.workSchedule)}</strong></div>
              <div><span class="text-muted">Service Longevity:</span> <strong>${p.yearsOfService} Years</strong></div>
              <div><span class="text-muted">Deployment Sector:</span> <strong>${Utils.sanitize(p.deploymentZone)}</strong></div>
              <div><span class="text-muted">Preferred Support Lang:</span> <strong>${Utils.sanitize(p.preferredSupportLanguage)}</strong></div>
            </div>
          </div>

          <!-- Column 2: Longitudinal AI Stress & Fatigue Profile -->
          <div class="card" style="background: var(--bg-card); padding: 1rem; border: 1px solid var(--border-color);">
            <div style="font-weight: 700; font-size: 0.85rem; color: var(--accent); margin-bottom: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em;">
              🧠 Welfare & Strain State
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.82rem;">
              <div class="d-flex align-center justify-between">
                <span class="text-muted">Welfare Signal:</span> 
                <span>${concernHtml}</span>
              </div>
              <div class="d-flex align-center justify-between">
                <span class="text-muted">Composite Strain Index:</span> 
                <strong>${scoreDisplay}</strong>
              </div>
              <div class="d-flex align-center justify-between">
                <span class="text-muted">Evidence Fusion:</span> 
                <span class="badge badge-neutral" style="font-size: 0.72rem;">${ws.evidenceStrength}</span>
              </div>
              <div><span class="text-muted">Active ML Model:</span> <strong>${ws.primaryPathway}</strong></div>
              <div><span class="text-muted">Last Assessment:</span> <strong>${lastAnalyzed}</strong></div>
            </div>
          </div>

          <!-- Column 3: Rest, Recovery & Biometric Telemetry -->
          <div class="card" style="background: var(--bg-card); padding: 1rem; border: 1px solid var(--border-color);">
            <div style="font-weight: 700; font-size: 0.85rem; color: var(--accent); margin-bottom: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em;">
              🦺 Exposure & Recovery Metrics
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.82rem;">
              <div><span class="text-muted">Shift Duration:</span> <strong>${shiftDisplay}</strong> (${weeklyDisplay})</div>
              <div><span class="text-muted">Restorative Sleep:</span> <strong>${sleepDisplay}</strong></div>
              <div><span class="text-muted">Autonomic Metrics:</span> <strong>${hrvDisplay}</strong> • <strong>${hrDisplay}</strong></div>
              <div><span class="text-muted">Total Completed Check-ins:</span> <strong>${p.totalCheckinsCount} recorded</strong></div>
              <div><span class="text-muted">Last Check-in Date:</span> <strong>${recentCheckin}</strong></div>
            </div>
          </div>
        </div>

        <!-- Non-Punitive Legal Notice & Actions Footer -->
        <div class="d-flex justify-between align-center flex-wrap gap-2 pt-2" style="border-top: 1px solid var(--border-color);">
          <div class="text-muted" style="font-size: 0.76rem; max-width: 600px; line-height: 1.4;">
            ⚖️ <strong>Strict Non-Punitive Mandate:</strong> Authorized database records are accessible exclusively for proactive supportive care and shift rotation. They cannot be cited in administrative actions or appraisal boards.
          </div>
          <div class="d-flex gap-1 flex-wrap align-center">
            ${ws.pendingAlertsCount > 0 ? `
              <button class="btn btn-sm btn-primary" onclick="filterAlertsByPersonnel('${p.personnelId}')">
                Review Alerts (${ws.pendingAlertsCount}) &rarr;
              </button>
            ` : ''}
            <button class="btn btn-sm btn-secondary" onclick="showTab('roster'); filterRosterTable('${p.personnelId}')">
              View in Roster
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  resultsEl.style.display = 'block';
}

function filterAlertsByPersonnel(personnelId) {
  showTab('dashboard');
  const input = document.getElementById('filter-alert-status');
  if (input) input.value = '';
  if (activeAlerts && activeAlerts.length > 0) {
    const filtered = activeAlerts.filter(a => (a.personnelId || '').toUpperCase() === personnelId.toUpperCase());
    renderAlertsTable(filtered.length > 0 ? filtered : activeAlerts);
    if (filtered.length > 0) {
      Utils.showToast(`Filtered triage table to alerts for ${personnelId}.`, 'info');
    }
  }
}

function filterRosterTable(query) {
  const q = (query || '').toUpperCase().trim();
  const rows = document.querySelectorAll('#roster-table-body tr');
  rows.forEach(r => {
    if (!q) {
      r.style.display = '';
    } else {
      const text = r.textContent.toUpperCase();
      r.style.display = text.includes(q) ? '' : 'none';
    }
  });
}

window.handlePersonnelSearch = handlePersonnelSearch;
window.resetPersonnelSearch = resetPersonnelSearch;
window.filterAlertsByPersonnel = filterAlertsByPersonnel;
window.filterRosterTable = filterRosterTable;
