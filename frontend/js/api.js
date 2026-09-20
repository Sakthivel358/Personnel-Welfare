/**
 * API Service Client for WelfareAI
 * AI-Based Predictive Personnel Stress & Welfare Monitoring System
 */

const API_BASE = '/api/v1';

class APIClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('sih_token') : null;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      credentials: 'include', // Send and receive HttpOnly cookies
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      // Transparent sliding session extension
      const renewedToken = response.headers && response.headers.get('x-renewed-token');
      if (renewedToken && typeof localStorage !== 'undefined') {
        localStorage.setItem('sih_token', renewedToken);
      }

      if (!response.ok) {
        if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
          console.warn('[Auth] Session expired or revoked.');
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('sih_token');
            localStorage.removeItem('sih_user');
            localStorage.removeItem('sih_registered_user');
            localStorage.removeItem('sih_user_avatar');
          }
          // Only redirect if on protected page
          const isPublicPage = window.location.pathname.endsWith('index.html') || 
                               window.location.pathname.endsWith('landing.html') || 
                               window.location.pathname.endsWith('login.html') || 
                               window.location.pathname.endsWith('signup.html') ||
                               window.location.pathname.endsWith('register.html') ||
                               window.location.pathname === '/';
          if (!isPublicPage) {
            window.location.href = '/login.html?expired=1';
          }
        }
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      // Auto-save auth token and user credentials cleanly
      if (data && data.token && typeof localStorage !== 'undefined') {
        localStorage.setItem('sih_token', data.token);
      }
      if (data && data.user && typeof localStorage !== 'undefined') {
        localStorage.setItem('sih_user', JSON.stringify(data.user));
        localStorage.setItem('sih_registered_user', JSON.stringify(data.user));
      } else if (data && data.data && data.data.personnelId && typeof localStorage !== 'undefined') {
        localStorage.setItem('sih_user', JSON.stringify(data.data));
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err.message);
      throw err;
    }
  }

  // Auth endpoints
  async register(userData) {
    return this.request('/auth/register', { method: 'POST', body: JSON.stringify(userData) });
  }

  async login(identifier, password, rememberMe = false) {
    return this.request('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password, rememberMe }) });
  }

  async logout() {
    try {
      // 1. Notify backend with existing token if available
      await this.request('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('[API] Logout request warning:', e.message);
    } finally {
      // 2. Cleanly purge all local authentication and user session storage
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('sih_token');
          localStorage.removeItem('sih_user');
          localStorage.removeItem('sih_registered_user');
          localStorage.removeItem('sih_user_avatar');
        }
      } catch (e) {}
    }
    return { success: true };
  }

  async getMe() {
    return this.request('/auth/me', { method: 'GET' });
  }

  async verifyPassword(password) {
    return this.request('/auth/verify-password', { method: 'POST', body: JSON.stringify({ password }) });
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
  }

  // Profile endpoints
  async getProfile() {
    return this.request('/profile', { method: 'GET' });
  }

  async updateProfile(profileData) {
    return this.request('/profile', { method: 'PUT', body: JSON.stringify(profileData) });
  }

  // Check-in & Prediction endpoints
  async submitCheckIn(checkInData) {
    return this.request('/checkin', { method: 'POST', body: JSON.stringify(checkInData) });
  }

  async syncCheckInsBatch(items) {
    return this.request('/checkin/sync', { method: 'POST', body: JSON.stringify({ items }) });
  }

  async getCheckInHistory() {
    return this.request('/checkin/history', { method: 'GET' });
  }

  // Wearable Telemetry endpoints
  async ingestWearableData(wearableData) {
    return this.request('/wearable/ingest', { method: 'POST', body: JSON.stringify(wearableData) });
  }

  async syncWearableBatch(items) {
    return this.request('/wearable/sync', { method: 'POST', body: JSON.stringify({ items }) });
  }

  async getLatestWearable() {
    return this.request('/wearable/latest', { method: 'GET' });
  }

  async getWearableHistory(limit = 30) {
    return this.request(`/wearable/history?limit=${limit}`, { method: 'GET' });
  }


  async getLatestPrediction() {
    return this.request('/prediction/latest', { method: 'GET' });
  }

  async getPredictionHistory() {
    return this.request('/prediction/history', { method: 'GET' });
  }

  async getExplainability() {
    return this.request('/prediction/explainability', { method: 'GET' });
  }

  async getPersonalBaseline() {
    return this.request('/prediction/personal-baseline', { method: 'GET' });
  }

  async getWhatChanged(id = null) {
    const q = id ? `?id=${encodeURIComponent(id)}` : '';
    return this.request(`/prediction/what-changed${q}`, { method: 'GET' });
  }

  // Officer endpoints
  async getOfficerDashboard() {
    return this.request('/officer/dashboard', { method: 'GET' });
  }

  async getOfficerAlerts(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/officer/alerts?${qs}`, { method: 'GET' });
  }

  async getAlertWorkflow(alertId) {
    return this.request(`/officer/alerts/${alertId}/workflow`, { method: 'GET' });
  }

  async reviewAlert(alertId, reviewData) {
    return this.request(`/officer/alerts/${alertId}/review`, { method: 'PUT', body: JSON.stringify(reviewData) });
  }

  async acknowledgeAlert(alertId, data = {}) {
    return this.request(`/officer/alerts/${alertId}/acknowledge`, { method: 'POST', body: JSON.stringify(data) });
  }

  async closeAlert(alertId, data = {}) {
    return this.request(`/officer/alerts/${alertId}/close`, { method: 'POST', body: JSON.stringify(data) });
  }

  async reviewPrediction(predictionId, data = {}) {
    return this.request(`/officer/predictions/${encodeURIComponent(predictionId)}/review`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getPersonnelRoster() {
    return this.request('/officer/personnel', { method: 'GET' });
  }

  async searchOfficerPersonnel(query) {
    const q = encodeURIComponent((query || '').trim());
    return this.request(`/officer/personnel/search?q=${q}`, { method: 'GET' });
  }

  async getRosterOptimization() {
    return this.request('/officer/roster-optimizer', { method: 'GET' });
  }

  async approveRosterPacing(data) {
    return this.request('/officer/approve-pacing', { method: 'POST', body: JSON.stringify(data) });
  }

  async getWelfareInterventions(personnelId) {
    const endpoint = personnelId ? `/officer/interventions/${encodeURIComponent(personnelId)}` : '/officer/interventions';
    return this.request(endpoint, { method: 'GET' });
  }

  async getWorkloadBalancing() {
    return this.request('/officer/workload-balancing', { method: 'GET' });
  }

  async reviewWorkloadProposal(proposalId, data) {
    return this.request(`/officer/workload-balancing/proposals/${encodeURIComponent(proposalId)}/review`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Follow-up endpoints
  async getFollowUps() {
    return this.request('/followups', { method: 'GET' });
  }

  async updateFollowUp(id, updateData) {
    return this.request(`/followups/${id}`, { method: 'PUT', body: JSON.stringify(updateData) });
  }

  // Support endpoints
  async getSupportOptions() {
    return this.request('/support/options', { method: 'GET' });
  }

  async submitSupportRequest(data) {
    return this.request('/support', { method: 'POST', body: JSON.stringify(data) });
  }

  async createSupportRequest(data) {
    return this.submitSupportRequest(data);
  }

  async getMySupportRequests() {
    return this.request('/support/my', { method: 'GET' });
  }

  async getAllSupportRequests() {
    return this.request('/support/all', { method: 'GET' });
  }

  async updateSupportRequest(id, data) {
    return this.request(`/support/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async reviewSupportRequest(id, data) {
    return this.request(`/support/${id}/review`, { method: 'POST', body: JSON.stringify(data) });
  }

  // HRMS Integration endpoints (Simulated Prototype Gateway)
  async getHRMSStatus() {
    return this.request('/hrms/status', { method: 'GET' });
  }

  async getMyHRMSRecord() {
    return this.request('/hrms/my-record', { method: 'GET' });
  }

  async getHRMSRecord(personnelId) {
    return this.request(`/hrms/personnel/${encodeURIComponent(personnelId)}`, { method: 'GET' });
  }

  async getHRMSCategory(category, personnelId) {
    const qs = personnelId ? `?personnelId=${encodeURIComponent(personnelId)}` : '';
    return this.request(`/hrms/category/${encodeURIComponent(category)}${qs}`, { method: 'GET' });
  }

  async syncHRMSData(personnelId) {
    return this.request('/hrms/sync', { method: 'POST', body: JSON.stringify({ personnelId }) });
  }

  // Notification endpoints
  async getNotifications() {
    return this.request('/notifications', { method: 'GET' });
  }

  async markNotificationRead(id) {
    return this.request(`/notifications/${id}/read`, { method: 'PUT' });
  }

  async markAllNotificationsRead() {
    return this.request('/notifications/mark-all-read', { method: 'PUT' });
  }

  // System & Admin
  async getSystemHealth() {
    return this.request('/system/health', { method: 'GET' });
  }

  async getModelTransparency() {
    return this.request('/system/transparency', { method: 'GET' });
  }

  async getAdminMetrics() {
    return this.request('/admin/metrics', { method: 'GET' });
  }

  async getAuditLogs() {
    return this.request('/admin/audit-logs', { method: 'GET' });
  }

  async getWelfareResources() {
    return this.request('/admin/resources', { method: 'GET' });
  }

  // Privacy Sandbox & Safeguards (Tasks 35 & 36)
  async getPrivacySandboxSample() {
    return this.request('/privacy/sandbox/sample', { method: 'GET' });
  }

  async transformPrivacySandbox(record) {
    return this.request('/privacy/sandbox/transform', { method: 'POST', body: JSON.stringify(record) });
  }

  async getPrivacyStatus() {
    return this.request('/privacy/status', { method: 'GET' });
  }

  // Consent & Data Control (Task 7)
  async getPrivacyConsent() {
    return this.request('/privacy/consent', { method: 'GET' });
  }

  async updatePrivacyConsent(consentData) {
    return this.request('/privacy/consent', { method: 'PUT', body: JSON.stringify(consentData) });
  }
}

const api = new APIClient();
