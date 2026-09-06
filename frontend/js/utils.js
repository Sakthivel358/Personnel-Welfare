/**
 * UI Utility Functions & Helper Components
 */

const Utils = {
  // Toast notifications
  showToast(message, type = 'info', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
      success: '✓',
      danger: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    toast.innerHTML = `
      <div style="font-weight: bold; font-size: 1.1rem; color: var(--accent);">${icons[type] || 'ℹ'}</div>
      <div style="flex: 1;">
        <div style="font-size: 0.9rem;">${message}</div>
      </div>
      <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  },

  formatDate(isoString) {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  getConcernBadge(level) {
    const lvl = (level || 'LOW').toUpperCase();
    if (lvl === 'HIGH') {
      return `<span class="badge badge-high"><span style="color:#ef4444;">●</span> High Welfare Concern</span>`;
    } else if (lvl === 'MODERATE') {
      return `<span class="badge badge-moderate"><span style="color:#f59e0b;">●</span> Moderate Strain Signal</span>`;
    }
    return `<span class="badge badge-low"><span style="color:#10b981;">●</span> Low / Balanced Baseline</span>`;
  },

  getPriorityBadge(priority) {
    const p = (priority || 'MEDIUM').toUpperCase();
    if (p === 'CRITICAL') return `<span class="badge badge-high">Critical</span>`;
    if (p === 'HIGH') return `<span class="badge badge-high">High</span>`;
    if (p === 'MEDIUM') return `<span class="badge badge-moderate">Medium</span>`;
    return `<span class="badge badge-low">Low</span>`;
  },

  getStatusBadge(status) {
    const s = (status || 'PENDING').toUpperCase();
    if (s === 'PENDING_REVIEW' || s === 'OPEN') return `<span class="badge badge-moderate">Pending Review</span>`;
    if (s === 'ACKNOWLEDGED' || s === 'IN_PROGRESS') return `<span class="badge badge-neutral">In Progress</span>`;
    if (s === 'FOLLOW_UP_ASSIGNED') return `<span class="badge badge-high">Follow-up Assigned</span>`;
    if (s === 'RESOLVED' || s === 'CHECKIN_COMPLETED') return `<span class="badge badge-low">Completed</span>`;
    return `<span class="badge badge-neutral">${s}</span>`;
  },

  // Notification Modal Display
  async openNotificationCenter() {
    let modal = document.getElementById('notification-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'notification-modal';
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.6); z-index: 9999;
        display: flex; align-items: center; justify-content: center; padding: 1.5rem;
      `;
      modal.innerHTML = `
        <div class="card" style="max-width: 520px; width: 100%; max-height: 80vh; overflow-y: auto; box-shadow: var(--shadow-xl);">
          <div class="d-flex justify-between align-center mb-3 pb-2" style="border-bottom: 1px solid var(--border-color);">
            <h3>🔔 Notification Center</h3>
            <button onclick="document.getElementById('notification-modal').style.display='none'" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--text-muted);">✕</button>
          </div>
          <div id="notif-modal-list">
            <div class="spinner spinner-primary" style="margin: 2rem auto;"></div>
          </div>
          <div class="d-flex justify-between align-center mt-3 pt-2" style="border-top: 1px solid var(--border-color);">
            <button class="btn btn-sm btn-secondary" onclick="Utils.markAllNotificationsRead()">Mark All as Read</button>
            <button class="btn btn-sm btn-primary" onclick="document.getElementById('notification-modal').style.display='none'">Close</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      modal.style.display = 'flex';
    }

    try {
      const res = await api.getNotifications();
      const container = document.getElementById('notif-modal-list');
      if (res && res.success && res.data && res.data.length > 0) {
        container.innerHTML = res.data.map(n => `
          <div class="card mb-2" style="background: ${n.isRead ? 'var(--bg-card-subtle)' : 'var(--primary-light)'}; padding: 0.85rem; border-left: 3px solid ${n.type === 'ALERT' ? 'var(--risk-high)' : 'var(--accent)'};">
            <div class="d-flex justify-between align-center mb-1">
              <strong>${n.title}</strong>
              <span class="text-muted" style="font-size:0.75rem;">${Utils.formatDate(n.createdAt)}</span>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">${n.message}</div>
            ${n.link ? `<a href="${n.link}" style="font-size:0.8rem; font-weight:bold;">View Details &rarr;</a>` : ''}
          </div>
        `).join('');
      } else {
        container.innerHTML = `<div class="text-center text-muted py-4">No notifications at this time.</div>`;
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  },

  async markAllNotificationsRead() {
    try {
      await api.markAllNotificationsRead();
      Utils.showToast('All notifications marked as read.', 'success');
      Utils.openNotificationCenter();
    } catch (err) {
      console.error(err);
    }
  },

  // Export Data Report Utility
  exportToCSV(filename, rows) {
    const processRow = (row) => {
      let finalVal = '';
      for (let j = 0; j < row.length; j++) {
        let innerValue = row[j] === null || row[j] === undefined ? '' : row[j].toString();
        if (row[j] instanceof Date) {
          innerValue = row[j].toLocaleString();
        }
        let result = innerValue.replace(/"/g, '""');
        if (result.search(/("|,|\n)/g) >= 0)
          result = '"' + result + '"';
        if (j > 0)
          finalVal += ',';
        finalVal += result;
      }
      return finalVal + '\n';
    };

    let csvFile = '';
    for (let i = 0; i < rows.length; i++) {
      csvFile += processRow(rows[i]);
    }

    const blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      Utils.showToast(`Report "${filename}" exported successfully!`, 'success');
    }
  },

  // Modal: View Check-in Details
  openCheckinDetailModal(item) {
    let modal = document.getElementById('checkin-detail-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'checkin-detail-modal';
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.65); z-index: 9999;
        display: flex; align-items: center; justify-content: center; padding: 1.5rem;
      `;
      document.body.appendChild(modal);
    }

    const factors = item.factorAttributions || [];
    const pss = item.pssScore !== undefined ? item.pssScore : (item.pssResponses ? Object.values(item.pssResponses).reduce((a,b)=>a+Number(b||0),0) : 'N/A');
    const risk = Math.round(item.compositeRiskScore || 0);

    modal.innerHTML = `
      <div class="card" style="max-width: 650px; width: 100%; max-height: 88vh; overflow-y: auto; box-shadow: var(--shadow-xl); border: 1px solid var(--border-color);">
        <div class="d-flex justify-between align-center mb-3 pb-2" style="border-bottom: 1px solid var(--border-color);">
          <div>
            <h3 style="margin-bottom:0.2rem;">Detailed Check-in Record</h3>
            <span class="text-muted" style="font-size:0.8rem;">Recorded on: ${Utils.formatDate(item.createdAt)}</span>
          </div>
          <button onclick="document.getElementById('checkin-detail-modal').style.display='none'" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--text-muted);">&times;</button>
        </div>

        <div class="grid-3 mb-3">
          <div class="card" style="background: var(--bg-card-subtle); padding: 0.85rem; text-align: center;">
            <div class="text-muted" style="font-size: 0.75rem;">Concern Level</div>
            <div class="mt-1">${Utils.getConcernBadge(item.concernLevel)}</div>
          </div>
          <div class="card" style="background: var(--bg-card-subtle); padding: 0.85rem; text-align: center;">
            <div class="text-muted" style="font-size: 0.75rem;">Risk Score</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: ${risk > 60 ? 'var(--risk-high)' : (risk > 35 ? 'var(--risk-mod)' : 'var(--risk-low)')};">${risk}%</div>
          </div>
          <div class="card" style="background: var(--bg-card-subtle); padding: 0.85rem; text-align: center;">
            <div class="text-muted" style="font-size: 0.75rem;">PSS-10 Score</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: var(--accent);">${pss} / 40</div>
          </div>
        </div>

        <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem;">Operational Indicators</h4>
        <div class="grid-2 mb-3" style="font-size: 0.85rem; gap: 0.5rem;">
          <div style="padding: 0.5rem; background: var(--bg-card-subtle); border-radius: var(--radius-sm);">
            <strong>Workload Hours:</strong> ${item.workloadHours || 8} hrs/day
          </div>
          <div style="padding: 0.5rem; background: var(--bg-card-subtle); border-radius: var(--radius-sm);">
            <strong>Recovery Sleep:</strong> ${item.recoverySleepHours || 7} hrs/night
          </div>
          <div style="padding: 0.5rem; background: var(--bg-card-subtle); border-radius: var(--radius-sm);">
            <strong>Extended Duty Days:</strong> ${item.extendedDutyDays || 0} / 14 days
          </div>
          <div style="padding: 0.5rem; background: var(--bg-card-subtle); border-radius: var(--radius-sm);">
            <strong>Deployment Duration:</strong> ${item.deploymentMonths || 0} months
          </div>
        </div>

        <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem;">Random Forest Attribution Breakdown</h4>
        <div class="mb-3">
          ${factors.length > 0 ? factors.map(f => {
            const pct = Math.round((f.attributionScore || f.importance || 0.1) * 100);
            return `
              <div class="mb-2">
                <div class="d-flex justify-between align-center mb-1" style="font-size: 0.85rem;">
                  <span><strong>${f.factorName || f.factor || 'Operational Factor'}</strong> <span class="text-muted">(${f.category || 'General'})</span></span>
                  <span class="badge ${f.status === 'ELEVATED' || f.status === 'HIGH' ? 'badge-high' : 'badge-low'}">${f.status || 'NORMAL'}</span>
                </div>
                <div class="progress-bar-bg" style="height: 6px;">
                  <div class="progress-bar-fill" style="width: ${Math.min(100, pct * 3.5)}%; background: ${f.status === 'ELEVATED' || f.status === 'HIGH' ? 'var(--risk-high)' : 'var(--accent)'};"></div>
                </div>
              </div>
            `;
          }).join('') : '<p class="text-muted" style="font-size:0.85rem;">Standard operational baseline.</p>'}
        </div>

        ${item.recommendations && item.recommendations.actionItems ? `
          <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">Associated Guidance</h4>
          <ul style="margin-left: 1.25rem; font-size: 0.85rem; line-height: 1.5; color: var(--text-secondary);" class="mb-3">
            ${item.recommendations.actionItems.map(a => `<li><strong>${a.title || a.action}:</strong> ${a.description || a.details || ''}</li>`).join('')}
          </ul>
        ` : ''}

        <div class="d-flex justify-between align-center pt-3" style="border-top: 1px solid var(--border-color);">
          <a href="/what-changed.html" class="btn btn-sm btn-outline">🔄 Compare in What Changed</a>
          <button class="btn btn-sm btn-primary" onclick="document.getElementById('checkin-detail-modal').style.display='none'">Close</button>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  },

  // Modal: Confirm Logout
  confirmLogout() {
    let modal = document.getElementById('logout-confirm-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'logout-confirm-modal';
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.65); z-index: 10000;
        display: flex; align-items: center; justify-content: center; padding: 1.5rem;
      `;
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="card" style="max-width: 440px; width: 100%; box-shadow: var(--shadow-xl); border: 1px solid var(--border-color); text-align: center; padding: 1.75rem;">
        <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">🛡️</div>
        <h3 style="margin-bottom: 0.5rem;">Confirm Sign Out</h3>
        <p class="text-muted" style="font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.5rem;">
          Are you sure you want to end your secure session? Your profile details, check-in history, and welfare records remain securely saved in the database.
        </p>
        <div class="d-flex gap-1 justify-center">
          <button class="btn btn-secondary" style="flex:1;" onclick="document.getElementById('logout-confirm-modal').style.display='none'">Cancel</button>
          <button class="btn btn-primary" style="flex:1; background: #dc2626; border-color: #dc2626;" onclick="document.getElementById('logout-confirm-modal').style.display='none'; auth.directLogout();">Sign Out</button>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  },

  // Production View Mode Toggle
  initProductionMode() {
    const isProd = localStorage.getItem('welfareai_production_mode') === 'true';
    if (isProd) {
      document.body.classList.add('production-mode');
    }

    // Attach dismiss button to demo banners
    document.querySelectorAll('.demo-banner').forEach(banner => {
      if (!banner.querySelector('.banner-dismiss-btn')) {
        const btn = document.createElement('button');
        btn.className = 'banner-dismiss-btn';
        btn.title = 'Switch to clean production view (hides hackathon evaluation headers)';
        btn.innerHTML = '👁️ Hide Evaluation Header';
        btn.onclick = () => Utils.toggleProductionMode();
        banner.appendChild(btn);
      }
    });
  },

  toggleProductionMode() {
    const isProd = document.body.classList.toggle('production-mode');
    localStorage.setItem('welfareai_production_mode', isProd ? 'true' : 'false');
    if (isProd) {
      Utils.showToast('Production View enabled: Hackathon evaluation banners hidden.', 'info');
    } else {
      Utils.showToast('Hackathon Evaluation View enabled.', 'info');
    }
  }
};

// Auto initialize theme & production mode
document.addEventListener('DOMContentLoaded', () => {
  Utils.initTheme();
  Utils.initProductionMode();
});
