/**
 * Contextual Welfare Recommendation Engine
 * Formulates non-clinical, supportive guidance derived directly from ML feature attributions.
 */
class RecommendationService {
  generateRecommendations(prediction, checkinData) {
    const { concernLevel, contributingFactors, compositeRiskScore } = prediction;
    const actionItems = [];
    let primaryAction = 'Maintain current healthy routine and continue regular check-ins.';

    // Check specific factor indicators
    const factorMap = {};
    if (contributingFactors && Array.isArray(contributingFactors)) {
      contributingFactors.forEach(f => {
        factorMap[f.feature_key] = f;
      });
    }

    // 1. Recovery / Sleep
    const sleepFactor = factorMap['recovery_sleep_hours'];
    if (sleepFactor && (sleepFactor.impact_level === 'HIGH' || checkinData.recovery_sleep_hours < 5.5)) {
      actionItems.push({
        category: 'Recovery & Rest',
        title: 'Rest & Sleep Optimization',
        description: `Average sleep recorded at ${checkinData.recovery_sleep_hours} hrs/day. Prioritize non-interrupted sleep blocks between duties and practice tactical wind-down protocols.`,
        priority: 'HIGH'
      });
    }

    // 2. Workload / Continuous Shifts
    const workloadFactor = factorMap['workload_hours'];
    const shiftFactor = factorMap['shift_continuity_days'];
    if ((workloadFactor && workloadFactor.impact_level === 'HIGH') || checkinData.workload_hours > 55 || (shiftFactor && checkinData.shift_continuity_days >= 7)) {
      actionItems.push({
        category: 'Operational Duty',
        title: 'Workload & Rest Rotation Consultation',
        description: `High weekly duty exposure (${checkinData.workload_hours} hrs, ${checkinData.shift_continuity_days || 0} consecutive days). Coordinate with unit welfare officer for rest cycle rotation.`,
        priority: 'HIGH'
      });
    }

    // 3. Work Pressure & PSS Stress
    const pressureFactor = factorMap['work_pressure_rating'];
    const pssFactor = factorMap['pss_score'];
    if ((pressureFactor && pressureFactor.impact_level === 'HIGH') || (pssFactor && pssFactor.impact_level === 'HIGH')) {
      actionItems.push({
        category: 'Stress Regulation',
        title: 'Tactical De-escalation & Mental Reset',
        description: 'Elevated perceived pressure signals detected. Utilize guided 4-7-8 breathing techniques, brief structured physical decompressions, and peer debriefing.',
        priority: 'MEDIUM'
      });
    }

    // 4. Social Support & Connectedness
    const supportFactor = factorMap['social_support_rating'];
    if ((supportFactor && supportFactor.impact_level === 'HIGH') || checkinData.social_support_rating <= 4) {
      actionItems.push({
        category: 'Social Support',
        title: 'Peer & Family Engagement',
        description: 'Lower social connection indicator noted. Schedule regular check-ins with family, trusted colleagues, or unit peer mentors.',
        priority: 'MEDIUM'
      });
    }

    // 5. Work-Life Balance
    const wlbFactor = factorMap['work_life_balance_rating'];
    if ((wlbFactor && wlbFactor.impact_level === 'HIGH') || checkinData.work_life_balance_rating <= 4) {
      actionItems.push({
        category: 'Work-Life Balance',
        title: 'Downtime Boundary Establishment',
        description: 'Establish clear separation between operational readiness and personal recuperation time when off-duty.',
        priority: 'LOW'
      });
    }

    // Determine primary action
    if (concernLevel === 'HIGH') {
      primaryAction = 'Elevated welfare strain detected. We recommend connecting with a designated Unit Welfare Officer for proactive support.';
    } else if (concernLevel === 'MODERATE') {
      primaryAction = 'Moderate strain signals identified. Review the personalized rest and workload guidance below.';
    }

    const welfareResourceSuggestions = [
      {
        title: 'CRPF 24/7 Welfare Tele-Counseling Support',
        contact: 'Toll-Free 1800-180-4024',
        type: 'Confidential Support Helpline'
      },
      {
        title: 'Unit Peer Support Liaison Officer',
        contact: 'Battalion Welfare Office - Extension #304',
        type: 'Direct On-Base Support'
      }
    ];

    return {
      concernLevel,
      primaryAction,
      compositeRiskScore,
      actionItems: actionItems.length > 0 ? actionItems : [
        {
          category: 'Wellness Maintenance',
          title: 'Maintain Healthy Operational Baseline',
          description: 'Your check-in indicators are balanced. Continue consistent sleep schedules, physical conditioning, and social connectivity.',
          priority: 'LOW'
        }
      ],
      welfareResourceSuggestions
    };
  }
}

module.exports = new RecommendationService();
