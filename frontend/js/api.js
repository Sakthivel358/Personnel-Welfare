/**
 * API Service Client for WelfareAI
 * AI-Based Predictive Personnel Stress & Welfare Monitoring System
 */

const API_BASE = '/api/v1';

class APIClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
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

      if (!response.ok) {
        if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
          console.warn('[Auth] Session expired or unauthorized.');
          // Only redirect if on protected page
          const isPublicPage = window.location.pathname.endsWith('index.html') || 
                               window.location.pathname.endsWith('landing.html') || 
                               window.location.pathname.endsWith('login.html') || 
                               window.location.pathname.endsWith('signup.html') ||
                               window.location.pathname === '/';
          if (!isPublicPage) {
            window.location.href = '/login.html?expired=1';
          }
        }
        throw new Error(data.message || `Request failed with status ${response.status}`);
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
    return this.request('/auth/logout', { method: 'POST' });
  }

  async getMe() {
    return this.request('/auth/me', { method: 'GET' });
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

  async getCheckInHistory() {
    return this.request('/checkin/history', { method: 'GET' });
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

  // Officer endpoints
  async getOfficerDashboard() {
    return this.request('/officer/dashboard', { method: 'GET' });
  }

  async getOfficerAlerts(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/officer/alerts?${qs}`, { method: 'GET' });
  }

  async reviewAlert(alertId, reviewData) {
    return this.request(`/officer/alerts/${alertId}/review`, { method: 'PUT', body: JSON.stringify(reviewData) });
  }

  async getPersonnelRoster() {
    return this.request('/officer/personnel', { method: 'GET' });
  }

  async getRosterOptimization() {
    return this.request('/officer/roster-optimizer', { method: 'GET' });
  }

  async approveRosterPacing(data) {
    return this.request('/officer/approve-pacing', { method: 'POST', body: JSON.stringify(data) });
  }

  // Follow-up endpoints
  async getFollowUps() {
    return this.request('/followups', { method: 'GET' });
  }

  async updateFollowUp(id, updateData) {
    return this.request(`/followups/${id}`, { method: 'PUT', body: JSON.stringify(updateData) });
  }

  // Support endpoints
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
}

const api = new APIClient();
