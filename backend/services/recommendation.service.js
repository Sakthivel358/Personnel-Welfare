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

    // 6. Wearable / Smart Jacket Biometric Strain
    const rhr = checkinData.resting_heart_rate != null ? Number(checkinData.resting_heart_rate) : null;
    const hrv = checkinData.hrv_ms != null ? Number(checkinData.hrv_ms) : null;
    const resp = checkinData.respiration_rate != null ? Number(checkinData.respiration_rate) : null;
    const strain = checkinData.fatigue_physical_strain != null ? Number(checkinData.fatigue_physical_strain) : null;
    const skinTemp = checkinData.skin_temperature_c != null ? Number(checkinData.skin_temperature_c) : null;

    if ((rhr && rhr >= 90) || (hrv && hrv < 35) || (resp && resp >= 22) || (strain && strain >= 70)) {
      actionItems.push({
        category: 'Physiological Strain & Autonomic Recovery',
        title: 'Tactical Respiration & Physical De-escalation',
        description: `Smart Jacket biometrics indicate elevated physiological load (RHR: ${rhr || 'N/A'} BPM, HRV: ${hrv || 'N/A'} ms, Strain: ${strain || 'N/A'}/100). Implement 4-4-4-4 tactical box breathing and scheduled physical cool-down.`,
        priority: 'HIGH'
      });
    }

    if (skinTemp && skinTemp >= 38.0) {
      actionItems.push({
        category: 'Thermal Regulation',
        title: 'Thermal & Exertion Monitoring',
        description: `Elevated skin/body temperature (${skinTemp}°C) detected via Smart Jacket sensors. Immediately rehydrate, seek ventilation, and follow thermal stress management protocols.`,
        priority: 'HIGH'
      });
    }

    // 7. Prolonged & Night Duty Operational Strain
    const prolongedHours = checkinData.prolonged_duty_hours != null ? Number(checkinData.prolonged_duty_hours) : null;
    const nightHours = checkinData.night_duty_hours != null ? Number(checkinData.night_duty_hours) : null;

    if (prolongedHours && prolongedHours >= 12) {
      actionItems.push({
        category: 'Operational Duty & Rest Rotation',
        title: 'Continuous Deployment Duty Relief',
        description: `Continuous duty deployment reaching ${prolongedHours} hours. Request tactical duty relief and take mandatory hydration and restorative break.`,
        priority: 'HIGH'
      });
    }

    if (nightHours && nightHours >= 16) {
      actionItems.push({
        category: 'Circadian Rhythm & Night Duty',
        title: 'Nocturnal Shift Recovery Protocol',
        description: `Extended nocturnal operational exposure (${nightHours} night duty hours). Prioritize quiet dark-room rest post-shift and maintain minimum 8-hour recovery interval.`,
        priority: 'MEDIUM'
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
