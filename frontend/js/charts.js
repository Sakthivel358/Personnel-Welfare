/**
 * Chart.js Integration for WelfareAI Personnel Welfare System
 * Clean, restrained enterprise charts with zero neon glow.
 */

const ChartsManager = {
  trendChartInstance: null,
  detailedTrendChartInstance: null,
  radarChartInstance: null,
  officerChartInstance: null,

  renderTrendChart(canvasId, seriesData) {
    return this.renderDetailedTrend(canvasId, seriesData);
  },

  renderDetailedTrend(canvasId, seriesData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.detailedTrendChartInstance) {
      this.detailedTrendChartInstance.destroy();
      this.detailedTrendChartInstance = null;
    }
    if (this.trendChartInstance) {
      this.trendChartInstance.destroy();
      this.trendChartInstance = null;
    }

    if (!seriesData || seriesData.length === 0) {
      return;
    }

    // Sort chronologically ascending for the chart timeline
    const sorted = [...seriesData].sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || a.checkInDate || 0).getTime();
      const dateB = new Date(b.date || b.createdAt || b.checkInDate || 0).getTime();
      return dateA - dateB;
    });

    const labels = sorted.map((item, i) => {
      const rawDate = item.date || item.createdAt || item.checkInDate;
      const d = rawDate ? new Date(rawDate) : new Date();
      const dateStr = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      return `Check-in ${item.checkInIndex || i + 1} (${dateStr})`;
    });

    const riskScores = sorted.map(item => Math.round(item.compositeRiskScore || 0));
    const pssScores = sorted.map(item => {
      const pss = (item.pss_score !== undefined && item.pss_score !== null) ? item.pss_score : ((item.pssScore !== undefined && item.pssScore !== null) ? item.pssScore : 0);
      return Math.round((pss / 40.0) * 100);
    });

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#cbd5e1' : '#475569';
    const gridColor = isDark ? '#1f2937' : '#e2e8f0';

    this.detailedTrendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Welfare Risk Index (%)',
            data: riskScores,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.08)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#2563eb',
            pointRadius: sorted.length === 1 ? 6 : 4,
            pointHoverRadius: 7
          },
          {
            label: 'Normalized PSS Score (%)',
            data: pssScores,
            borderColor: '#d97706',
            backgroundColor: 'rgba(217, 119, 6, 0.04)',
            borderWidth: 2,
            borderDash: [4, 4],
            fill: false,
            tension: 0.3,
            pointBackgroundColor: '#d97706',
            pointRadius: sorted.length === 1 ? 5 : 3.5,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { color: textColor, stepSize: 20, font: { size: 11 } },
            grid: { color: gridColor },
            title: { display: true, text: 'Index / Normalized Score (0 - 100)', color: textColor, font: { size: 11, weight: '600' } }
          },
          x: {
            ticks: { color: textColor, font: { size: 11 } },
            grid: { color: gridColor }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: textColor, font: { weight: '600', size: 12 }, padding: 12 }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            borderColor: '#1e293b',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 12 }
          }
        }
      }
    });

    this.trendChartInstance = this.detailedTrendChartInstance;
  },

  renderRadarChart(canvasId, factors) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !factors || factors.length === 0) return;

    if (this.radarChartInstance) {
      this.radarChartInstance.destroy();
    }

    const labels = factors.map(f => f.title);
    const dataValues = factors.map(f => (f.contribution_score !== undefined && f.contribution_score !== null ? Number(f.contribution_score) : 0));

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#cbd5e1' : '#475569';
    const gridColor = isDark ? '#1f2937' : '#e2e8f0';

    this.radarChartInstance = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Contributing Stress Signal (%)',
          data: dataValues,
          backgroundColor: 'rgba(225, 29, 72, 0.1)',
          borderColor: '#e11d48',
          pointBackgroundColor: '#e11d48',
          pointBorderColor: '#ffffff',
          pointHoverBackgroundColor: '#ffffff',
          pointHoverBorderColor: '#e11d48',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: gridColor },
            grid: { color: gridColor },
            pointLabels: { color: textColor, font: { size: 11, weight: '600' } },
            ticks: { color: textColor, backdropColor: 'transparent', min: 0, max: 100, stepSize: 25, font: { size: 10 } }
          }
        },
        plugins: {
          legend: { labels: { color: textColor, font: { size: 12, weight: '600' } } },
          tooltip: {
            backgroundColor: '#0f172a',
            borderColor: '#1e293b',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6
          }
        }
      }
    });
  },

  renderDistributionChart(canvasId, dist) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !dist) return;

    if (this.officerChartInstance) {
      this.officerChartInstance.destroy();
    }

    this.officerChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Low / Baseline', 'Moderate Strain', 'High Welfare Concern'],
        datasets: [{
          data: [dist.LOW || 0, dist.MODERATE || 0, dist.HIGH || 0],
          backgroundColor: ['#059669', '#d97706', '#e11d48'],
          borderWidth: 2,
          borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#111827' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 12, font: { size: 11, weight: '600' } } },
          tooltip: {
            backgroundColor: '#0f172a',
            borderColor: '#1e293b',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6
          }
        },
        cutout: '72%'
      }
    });
  }
};
