/**
 * Chart.js Integration for SIH26186 Personnel Welfare System
 */

const ChartsManager = {
  trendChartInstance: null,
  radarChartInstance: null,
  officerChartInstance: null,

  renderTrendChart(canvasId, seriesData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.trendChartInstance) {
      this.trendChartInstance.destroy();
    }

    if (!seriesData || seriesData.length === 0) {
      // Empty state
      return;
    }

    const labels = seriesData.map((item, i) => {
      const d = new Date(item.date);
      return `Check-in ${item.checkInIndex || i + 1} (${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })})`;
    });

    const riskScores = seriesData.map(item => item.compositeRiskScore || 0);
    const pssScores = seriesData.map(item => ((item.pss_score || 0) / 40.0) * 100);
    const workloadNorm = seriesData.map(item => (((item.workload_hours || 40) - 35) / 45) * 100);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#cbd5e1' : '#475569';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    this.trendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Welfare Risk Index (%)',
            data: riskScores,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#2563eb',
            pointRadius: 5
          },
          {
            label: 'PSS Score Normalized (%)',
            data: pssScores,
            borderColor: '#f59e0b',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0.35,
            pointBackgroundColor: '#f59e0b',
            pointRadius: 4
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
            ticks: { color: textColor },
            grid: { color: gridColor },
            title: { display: true, text: 'Index (0 - 100)', color: textColor }
          },
          x: {
            ticks: { color: textColor },
            grid: { color: gridColor }
          }
        },
        plugins: {
          legend: {
            labels: { color: textColor, font: { weight: 'bold' } }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 10,
            titleFont: { size: 13, weight: 'bold' }
          }
        }
      }
    });
  },

  renderRadarChart(canvasId, factors) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !factors || factors.length === 0) return;

    if (this.radarChartInstance) {
      this.radarChartInstance.destroy();
    }

    const labels = factors.map(f => f.title);
    const dataValues = factors.map(f => f.contribution_score || 20);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#cbd5e1' : '#475569';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    this.radarChartInstance = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Contributing Stress Signal (%)',
          data: dataValues,
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          borderColor: '#ef4444',
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#ef4444',
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
            pointLabels: { color: textColor, font: { size: 11, weight: 'bold' } },
            ticks: { color: textColor, backdropColor: 'transparent', min: 0, max: 100 }
          }
        },
        plugins: {
          legend: { labels: { color: textColor } }
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
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 15 } }
        },
        cutout: '70%'
      }
    });
  }
};
