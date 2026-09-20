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

function getAlertStatusBadge(status) {
  const s = (status || 'PENDING_REVIEW').toUpperCase();
  if (s === 'PENDING_REVIEW' || s === 'OPEN') {
    return `<span class="badge badge-moderate" style="font-size:0.75rem;">Pending Review</span>`;
  }
  if (s === 'ACKNOWLEDGED') {
    return `<span class="badge" style="background:rgba(59,130,246,0.15); color:#2563eb; border:1px solid rgba(59,130,246,0.3); font-size:0.75rem;">Acknowledged</span>`;
  }
  if (s === 'FOLLOW_UP_ASSIGNED' || s === 'FOLLOW_UP_SCHEDULED') {
    return `<span class="badge badge-high" style="font-size:0.75rem;">Follow-up Assigned</span>`;
  }
  if (s === 'CLOSED') {
    return `<span class="badge badge-neutral" style="font-size:0.75rem; background:rgba(100,116,139,0.15); color:#64748b; border:1px solid rgba(100,116,139,0.3);">Closed</span>`;
  }
  if (s === 'RESOLVED') {
    return `<span class="badge badge-low" style="font-size:0.75rem;">Resolved</span>`;
  }
  return Utils.getStatusBadge(s);
}

function renderAlertsTable(alerts) {
  activeAlerts = alerts || [];
  window.activeAlerts = activeAlerts;

  const countBadge = document.getElementById('live-alert-counter-badge');
  if (countBadge) {
    const activeCount = activeAlerts.filter(a => a.status !== 'CLOSED' && a.status !== 'RESOLVED').length;
    countBadge.textContent = `${activeCount} Active / ${activeAlerts.length} Total`;
    countBadge.className = activeCount > 0 ? 'badge badge-moderate' : 'badge badge-neutral';
  }

  const tbody = document.getElementById('alerts-table-body');
  if (!tbody) return;

  if (activeAlerts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted" style="padding: 2.5rem 1rem;">
          <div style="font-size:1.6rem; margin-bottom:0.4rem;">🛡️</div>
          <strong>No welfare alerts currently requiring review.</strong>
          <div style="font-size:0.8rem; margin-top:0.25rem;">Alerts generate strictly when authorized data and configured evidence thresholds indicate a welfare concern.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = activeAlerts.map(a => {
    const token = a.userToken || ('USR_' + (a.personnelId ? String(a.personnelId).replace(/[^A-Za-z0-9]/g, '').slice(-5) : 'ANON'));
    const concernHtml = Utils.getWelfareConcernDisplay(a.concernLevel);
    const evidenceHtml = Utils.getEvidenceStrengthDisplay(a.evidenceStrength || 'SUFFICIENT');

    // Main contributors formatting
    const rawContributors = (a.mainContributors && a.mainContributors.length > 0) ? a.mainContributors : (a.topDrivers || []);
    const contributorsHtml = rawContributors.length > 0
      ? rawContributors.slice(0, 3).map(c => {
          const label = typeof c === 'string' ? c : (c.directionalTitle || c.title || c.factor || 'Operational Strain');
          return `<span class="badge" style="background:var(--bg-card-subtle); color:var(--text-primary); border:1px solid var(--border-color); font-size:0.72rem; padding:2px 6px; white-space:nowrap; margin:1px 0; display:inline-block;">${Utils.sanitize(label)}</span>`;
        }).join(' ')
      : '<span class="text-muted" style="font-size:0.75rem;">Multi-source indicators</span>';

    const timestampDate = a.timestamp || a.createdAt;
    const formattedDate = timestampDate ? Utils.formatDate(timestampDate) : '--';
    const formattedTime = timestampDate ? new Date(timestampDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    const isPending = a.status === 'PENDING_REVIEW' || !a.status;
    const isClosed = a.status === 'CLOSED' || a.status === 'RESOLVED';

    return `
    <tr>
      <td>
        <div class="d-flex flex-column gap-1">
          <span class="badge" style="background:rgba(99,102,241,0.1); color:#4f46e5; border:1px solid rgba(99,102,241,0.25); font-family:monospace; font-size:0.74rem; width:fit-content; padding:2px 6px;">
            🔒 ${Utils.sanitize(token)}
          </span>
          <strong style="font-size:0.88rem;">${Utils.sanitize(a.personnelId || '--')}</strong>
          <div class="text-muted" style="font-size:0.74rem;">${Utils.sanitize(a.personnelName || 'Member')} • ${Utils.sanitize(a.rank || 'Personnel')}</div>
        </div>
      </td>
      <td>
        <div class="d-flex flex-column gap-1">
          ${concernHtml}
          ${a.compositeRiskScore != null ? `<span class="text-muted" style="font-size:0.74rem;">Risk: <strong>${Math.round(a.compositeRiskScore)}%</strong></span>` : ''}
        </div>
      </td>
      <td>
        <div class="d-flex flex-column gap-1">
          ${evidenceHtml}
          ${a.dataAvailableCount != null ? Utils.getDataAvailableDisplay(a.dataAvailableCount, 5) : ''}
        </div>
      </td>
      <td>
        <div class="d-flex flex-wrap gap-1" style="max-width:240px;">
          ${contributorsHtml}
        </div>
      </td>
      <td>
        <div style="font-size:0.8rem; font-weight:600;">${formattedDate}</div>
        <div class="text-muted" style="font-size:0.72rem;">${formattedTime}</div>
      </td>
      <td>${getAlertStatusBadge(a.status)}</td>
      <td>
        <div class="d-flex gap-1 flex-wrap align-center">
          ${isPending ? `
            <button class="btn btn-sm btn-outline-info" onclick="acknowledgeAlertHandler('${a._id}')" title="Acknowledge alert receipt" style="padding:0.25rem 0.5rem; font-size:0.75rem;">
              ✓ Ack
            </button>
          ` : ''}
          <button class="btn btn-sm btn-primary" onclick="openReviewModal('${a._id}')" title="7-Stage Welfare Review Workflow" style="padding:0.25rem 0.5rem; font-size:0.75rem;">
            🔍 Review
          </button>
          ${!isClosed ? `
            <button class="btn btn-sm btn-secondary" onclick="openCloseAlertModal('${a._id}')" title="Close alert with supportive rationale" style="padding:0.25rem 0.5rem; font-size:0.75rem;">
              ✕ Close
            </button>
          ` : `
            <span class="badge badge-neutral" style="font-size:0.72rem;">Closed</span>
          `}
        </div>
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

        <!-- EXTENDED HR & OPERATIONAL INTELLIGENCE (6 Dimensions) -->
        <div class="card mb-3" style="background: var(--bg-card); padding: 1.15rem; border: 1px solid var(--border-color);">
          <div class="d-flex justify-between align-center mb-2 flex-wrap gap-1" style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
            <div class="d-flex align-center gap-1">
              <span style="font-size: 1.1rem;">📑</span>
              <strong style="font-size: 0.92rem; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.04em;">
                Complete HR & Operational Deployment Profile
              </strong>
            </div>
            <span class="badge badge-neutral" style="font-size: 0.72rem;">6 Core Operational Dimensions</span>
          </div>

          <div class="grid-3 mb-2" style="gap: 0.85rem; font-size: 0.82rem;">
            <!-- 1. Leave Pattern -->
            <div style="background: var(--bg-card-subtle); padding: 0.75rem; border-radius: 6px; border-left: 3px solid ${p.leavePattern && p.leavePattern.leaveDeficitWarning ? 'var(--risk-high)' : 'var(--accent)'};">
              <div class="d-flex justify-between align-center mb-1">
                <strong>📅 Leave Pattern & Balance</strong>
                ${p.leavePattern && p.leavePattern.leaveDeficitWarning ? '<span class="badge badge-high" style="font-size:0.68rem;">⚠️ Deficit Warning</span>' : '<span class="badge badge-low" style="font-size:0.68rem;">✓ Balanced</span>'}
              </div>
              <div><span class="text-muted">Days Earned:</span> <strong>${p.leavePattern ? p.leavePattern.daysEarned : 60}</strong> • <span class="text-muted">Availed:</span> <strong>${p.leavePattern ? p.leavePattern.daysAvailed : 15}</strong></div>
              <div><span class="text-muted">Remaining Balance:</span> <strong>${p.leavePattern ? p.leavePattern.daysRemaining : 45} Days</strong></div>
              <div><span class="text-muted">Last Leave Availed:</span> <strong>${p.leavePattern && p.leavePattern.lastLeaveDate ? p.leavePattern.lastLeaveDate : 'Over 6 Months Ago'}</strong></div>
            </div>

            <!-- 2. Deployment History -->
            <div style="background: var(--bg-card-subtle); padding: 0.75rem; border-radius: 6px; border-left: 3px solid var(--accent);">
              <div class="d-flex justify-between align-center mb-1">
                <strong>🏔️ Deployment History</strong>
                <span class="badge badge-neutral" style="font-size:0.68rem;">${(p.deploymentHistory || []).length} Postings</span>
              </div>
              <div style="max-height: 70px; overflow-y: auto;">
                ${(p.deploymentHistory && p.deploymentHistory.length > 0) ? p.deploymentHistory.map(d => `
                  <div style="margin-bottom: 3px; line-height: 1.3;">
                    <strong>${Utils.sanitize(d.mission)}</strong>: ${d.durationMonths || 12} mos in ${Utils.sanitize(d.zone || d.terrainType)}
                  </div>
                `).join('') : '<div class="text-muted">Northern Sector High-Altitude Deployment</div>'}
              </div>
            </div>

            <!-- 3. Duty Schedule -->
            <div style="background: var(--bg-card-subtle); padding: 0.75rem; border-radius: 6px; border-left: 3px solid var(--accent);">
              <div class="d-flex justify-between align-center mb-1">
                <strong>⏱️ Duty Schedule & Watch Timing</strong>
                <span class="badge badge-neutral" style="font-size:0.68rem;">${p.dutySchedule ? p.dutySchedule.shiftType : 'Rotational'}</span>
              </div>
              <div><span class="text-muted">Rotation Cycle:</span> <strong>${p.dutySchedule ? p.dutySchedule.rotationCycle : '8h Watch / 16h Rest'}</strong></div>
              <div><span class="text-muted">Nominal Weekly:</span> <strong>${p.dutySchedule ? p.dutySchedule.weeklyHoursNominal : 48} hrs/wk</strong></div>
              <div><span class="text-muted">Night Shift Ratio:</span> <strong>${p.dutySchedule ? Math.round(p.dutySchedule.nightShiftRatio * 100) : 25}%</strong></div>
            </div>
          </div>

          <div class="grid-3" style="gap: 0.85rem; font-size: 0.82rem;">
            <!-- 4. Transfer Frequency -->
            <div style="background: var(--bg-card-subtle); padding: 0.75rem; border-radius: 6px; border-left: 3px solid ${p.transferFrequency && p.transferFrequency.highMobilityFlag ? 'var(--risk-mod)' : 'var(--accent)'};">
              <div class="d-flex justify-between align-center mb-1">
                <strong>🔄 Transfer Frequency & Mobility</strong>
                ${p.transferFrequency && p.transferFrequency.highMobilityFlag ? '<span class="badge badge-mod" style="font-size:0.68rem;">⚡ High Mobility</span>' : '<span class="badge badge-low" style="font-size:0.68rem;">✓ Standard Tenure</span>'}
              </div>
              <div><span class="text-muted">Total Rotational Postings:</span> <strong>${p.transferFrequency ? p.transferFrequency.transfersCount : 3}</strong></div>
              <div><span class="text-muted">Average Sector Tenure:</span> <strong>${p.transferFrequency ? p.transferFrequency.averageTenureMonths : 22} Months</strong></div>
              <div><span class="text-muted">Last Relocation Date:</span> <strong>${p.transferFrequency && p.transferFrequency.lastTransferDate ? p.transferFrequency.lastTransferDate : '2025-06-15'}</strong></div>
            </div>

            <!-- 5. Training Commitments -->
            <div style="background: var(--bg-card-subtle); padding: 0.75rem; border-radius: 6px; border-left: 3px solid var(--accent);">
              <div class="d-flex justify-between align-center mb-1">
                <strong>🎯 Training Commitments</strong>
                <span class="badge badge-neutral" style="font-size:0.68rem;">${(p.trainingCommitments || []).length} Modules</span>
              </div>
              <div style="max-height: 70px; overflow-y: auto;">
                ${(p.trainingCommitments && p.trainingCommitments.length > 0) ? p.trainingCommitments.map(t => `
                  <div style="margin-bottom: 3px; line-height: 1.3;">
                    <strong>${Utils.sanitize(t.program)}</strong>: <span class="badge ${t.status === 'Completed' ? 'badge-low' : 'badge-mod'}" style="font-size:0.65rem; padding:1px 5px;">${t.status}</span> (${t.completedHours}/${t.mandatoryHours}h)
                  </div>
                `).join('') : '<div class="text-muted">High-Altitude Conditioning Completed</div>'}
              </div>
            </div>

            <!-- 6. Workload Trends -->
            <div style="background: var(--bg-card-subtle); padding: 0.75rem; border-radius: 6px; border-left: 3px solid ${p.workloadTrends && p.workloadTrends.trajectory === 'Increasing' ? 'var(--risk-high)' : 'var(--accent)'};">
              <div class="d-flex justify-between align-center mb-1">
                <strong>📈 Workload Trends & Velocity</strong>
                <span class="badge ${p.workloadTrends && p.workloadTrends.trajectory === 'Increasing' ? 'badge-high' : 'badge-low'}" style="font-size:0.68rem;">
                  ${p.workloadTrends ? p.workloadTrends.trajectory : 'Stable'} Velocity
                </span>
              </div>
              <div><span class="text-muted">Rolling Average Duty:</span> <strong>${p.workloadTrends ? p.workloadTrends.averageWeeklyHours : 52} hrs/wk</strong></div>
              <div><span class="text-muted">Peak Shift Exposure:</span> <strong>${p.workloadTrends ? p.workloadTrends.peakWeeklyHours : 68} hrs/wk</strong></div>
              <div><span class="text-muted">Surge Cycles Logged:</span> <strong>${p.workloadTrends ? p.workloadTrends.surgeWeeksCount : 3} Weeks</strong></div>
            </div>
          </div>
        </div>

        <!-- WELFARE INTERVENTION RECOMMENDATIONS (Strictly Non-Disciplinary & Supportive) -->
        <div class="card mb-3" style="background: var(--bg-card); padding: 1.15rem; border: 1px solid var(--border-color); border-left: 4px solid var(--success);">
          <div class="d-flex justify-between align-center mb-2 flex-wrap gap-1" style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
            <div class="d-flex align-center gap-1">
              <span style="font-size: 1.15rem;">🤝</span>
              <div>
                <strong style="font-size: 0.92rem; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.04em;">
                  Welfare Intervention Recommendations
                </strong>
                <div class="text-muted" style="font-size: 0.76rem;">
                  Evidence-based supportive actions generated from multi-modal indicators. Strictly non-punitive decision support.
                </div>
              </div>
            </div>
            <div class="d-flex gap-1 align-center flex-wrap">
              <span class="badge badge-low" style="font-size: 0.72rem;">✓ Non-Disciplinary</span>
              <span class="badge badge-neutral" style="font-size: 0.72rem;">Officer Adjudication Required</span>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.65rem;">
            ${(p.welfareInterventions && p.welfareInterventions.length > 0) ? p.welfareInterventions.map(int => `
              <div style="background: var(--bg-card-subtle); padding: 0.85rem 1rem; border-radius: 6px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 260px;">
                  <div class="d-flex align-center gap-1 mb-1 flex-wrap">
                    <span class="badge badge-neutral" style="font-size: 0.7rem; font-weight: 700;">${int.categoryLabel || int.category}</span>
                    <strong style="font-size: 0.88rem; color: var(--text-primary);">${Utils.sanitize(int.title)}</strong>
                    <span class="badge badge-${(int.priority || 'medium').toLowerCase()}" style="font-size: 0.68rem;">${int.priority || 'Medium'} Priority</span>
                  </div>
                  <div style="font-size: 0.84rem; line-height: 1.45; color: var(--text-secondary); margin-bottom: 0.35rem;">
                    <strong>Suggested Action:</strong> ${Utils.sanitize(int.suggestedAction)}
                  </div>
                  <div class="text-muted" style="font-size: 0.76rem;">
                    💡 <em>Evidence Basis:</em> ${Utils.sanitize(int.evidenceBasis)}
                  </div>
                </div>
                <div style="text-align: right; font-size: 0.76rem; flex-shrink: 0;">
                  <div class="text-muted">Target Timeframe:</div>
                  <strong style="color: var(--accent);">${int.reviewTimeframe || 'Next 7 Days'}</strong>
                </div>
              </div>
            `).join('') : `
              <div class="text-muted py-2" style="font-size: 0.85rem;">
                Baseline indicators optimal. Continue routine wellness check-ins and open-door welfare accessibility.
              </div>
            `}
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

/**
 * Real-time Alert & Notification Center Actions
 */
async function acknowledgeAlertHandler(alertId) {
  try {
    const res = await api.acknowledgeAlert(alertId, {
      officerNotes: 'Welfare Officer acknowledged real-time signal via Alert Center.'
    });
    if (res && res.success) {
      Utils.showToast('Welfare alert acknowledged successfully.', 'success');
      // Refresh current alerts
      const status = document.getElementById('filter-alert-status')?.value || '';
      const freshRes = await api.getOfficerAlerts(status ? { status } : {});
      if (freshRes && freshRes.success) {
        renderAlertsTable(freshRes.data);
      }
    } else {
      throw new Error(res?.message || 'Failed to acknowledge alert');
    }
  } catch (err) {
    console.error('Error acknowledging alert:', err);
    Utils.showToast('Error acknowledging alert: ' + err.message, 'danger');
  }
}

function openCloseAlertModal(alertId) {
  const alert = activeAlerts.find(a => String(a._id) === String(alertId));
  if (!alert) {
    Utils.showToast('Alert details not found.', 'warning');
    return;
  }
  const modal = document.getElementById('close-alert-modal');
  const idInput = document.getElementById('close_alert_id');
  const detailsBox = document.getElementById('close-alert-details-box');
  if (!modal) return;

  if (idInput) idInput.value = alert._id;
  if (detailsBox) {
    const token = alert.userToken || ('USR_' + (alert.personnelId ? String(alert.personnelId).replace(/[^A-Za-z0-9]/g, '').slice(-5) : 'ANON'));
    detailsBox.innerHTML = `
      <div class="d-flex justify-between align-center mb-1">
        <div>
          <strong>${Utils.sanitize(alert.personnelName || 'Personnel Member')}</strong>
          <span class="text-muted">(${Utils.sanitize(alert.personnelId)})</span>
        </div>
        <span class="badge" style="background:rgba(99,102,241,0.1); color:#4f46e5; border:1px solid rgba(99,102,241,0.25); font-family:monospace; font-size:0.72rem;">
          🔒 ${Utils.sanitize(token)}
        </span>
      </div>
      <div class="d-flex gap-2 align-center mt-1 flex-wrap" style="font-size:0.78rem;">
        <div>Concern: ${Utils.getWelfareConcernDisplay(alert.concernLevel)}</div>
        <div>Evidence: ${Utils.getEvidenceStrengthDisplay(alert.evidenceStrength || 'SUFFICIENT')}</div>
        <div class="text-muted">Logged: ${Utils.formatDate(alert.timestamp || alert.createdAt)}</div>
      </div>
    `;
  }
  const notesInput = document.getElementById('close_alert_notes');
  if (notesInput) notesInput.value = '';

  modal.style.display = 'flex';
}

function closeCloseAlertModal() {
  const modal = document.getElementById('close-alert-modal');
  if (modal) modal.style.display = 'none';
}

async function submitCloseAlert() {
  const alertId = document.getElementById('close_alert_id')?.value;
  if (!alertId) return;

  const resolutionReason = document.getElementById('close_alert_reason')?.value;
  const officerNotes = document.getElementById('close_alert_notes')?.value;

  const submitBtn = document.getElementById('btn-submit-close-alert');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await api.closeAlert(alertId, {
      resolutionReason,
      officerNotes
    });

    if (res && res.success) {
      Utils.showToast('Welfare alert successfully closed with supportive rationale.', 'success');
      closeCloseAlertModal();
      const status = document.getElementById('filter-alert-status')?.value || '';
      const freshRes = await api.getOfficerAlerts(status ? { status } : {});
      if (freshRes && freshRes.success) {
        renderAlertsTable(freshRes.data);
      }
    } else {
      throw new Error(res?.message || 'Failed to close alert');
    }
  } catch (err) {
    console.error('Error closing alert:', err);
    Utils.showToast('Error closing alert: ' + err.message, 'danger');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// Real-time Background Polling for Alert Center
let alertCenterPollingInterval = null;
function initAlertCenterPolling() {
  if (alertCenterPollingInterval) clearInterval(alertCenterPollingInterval);
  alertCenterPollingInterval = setInterval(async () => {
    const dashTab = document.getElementById('tab-dashboard');
    if (dashTab && dashTab.style.display !== 'none' && !document.hidden) {
      try {
        const filterSelect = document.getElementById('filter-alert-status');
        const status = filterSelect ? filterSelect.value : '';
        const res = await api.getOfficerAlerts(status ? { status } : {});
        if (res && res.success && Array.isArray(res.data)) {
          renderAlertsTable(res.data);
        }
      } catch (e) {
        // silent catch on background poll
      }
    }
  }, 15000);
}

// Auto-start polling when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAlertCenterPolling);
} else {
  initAlertCenterPolling();
}

window.acknowledgeAlertHandler = acknowledgeAlertHandler;
window.openCloseAlertModal = openCloseAlertModal;
window.closeCloseAlertModal = closeCloseAlertModal;
window.submitCloseAlert = submitCloseAlert;

