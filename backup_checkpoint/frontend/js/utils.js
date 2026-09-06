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
  }
};
