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

    // 8. Sector & Duty Role Specific Pacing
    const dutyType = String(checkinData.duty_type || '');
    const zone = String(checkinData.deploymentZone || '');
    if (zone.toLowerCase().includes('high altitude') && ((prolongedHours && prolongedHours >= 8) || checkinData.workload_hours >= 55)) {
      actionItems.push({
        category: 'Extreme Terrain Adaptation',
        title: 'High-Altitude Hypoxia & Cold Mitigation',
        description: 'Deployed in Northern Sector / High-Altitude terrain with active duty load. Adhere to acclimatization hydration rules, monitor peripheral SpO2, and request heated bunker rest.',
        priority: 'HIGH'
      });
    }

    if (dutyType.toLowerCase().includes('quick reaction') && checkinData.shift_continuity_days >= 5) {
      actionItems.push({
        category: 'Tactical Readiness Pacing',
        title: 'QRT High-Alert Standby Rotation',
        description: 'Sustained Quick Reaction standby over 5 consecutive days induces sympathetic hyper-vigilance. Coordinate with Adjutant for scheduled 24-hour non-readiness respite.',
        priority: 'HIGH'
      });
    }


    // 9. Extended HR & Operational Data Evidence
    if (checkinData.leavePattern && checkinData.leavePattern.leaveDeficitWarning) {
      const lp = checkinData.leavePattern;
      actionItems.push({
        category: 'Leave & Rest Recuperation',
        title: 'Accrued Leave Deficit Recuperation',
        description: `Personnel has accumulated ${lp.daysRemaining || 45} days of earned leave with last leave recorded on ${lp.lastLeaveDate || 'over 6 months ago'}. Request scheduled block leave through unit Welfare Officer to restore resilience.`,
        priority: 'HIGH'
      });
    }

    if (checkinData.workloadTrends && (checkinData.workloadTrends.trajectory === 'Increasing' || checkinData.workloadTrends.surgeWeeksCount >= 3)) {
      const wt = checkinData.workloadTrends;
      actionItems.push({
        category: 'Workload Velocity Pacing',
        title: 'Sustained Operational Surge Mitigation',
        description: `Operational workload trend is ${wt.trajectory} with ${wt.surgeWeeksCount || 3} surge weeks (peak ${wt.peakWeeklyHours || 64}h/wk). Request proactive duty pacing review before chronic exhaustion sets in.`,
        priority: 'HIGH'
      });
    }

    if (checkinData.transferFrequency && checkinData.transferFrequency.highMobilityFlag) {
      const tf = checkinData.transferFrequency;
      actionItems.push({
        category: 'Relocation & Adaptation Support',
        title: 'Sector Transfer Transition Protocol',
        description: `Frequent rotational transfers recorded (${tf.transfersCount} postings, avg tenure ${tf.averageTenureMonths} mos). Leverage unit family welfare center and peer buddy liaison for social stabilization.`,
        priority: 'MEDIUM'
      });
    }

    if (checkinData.trainingCommitments && Array.isArray(checkinData.trainingCommitments)) {
      const inProg = checkinData.trainingCommitments.filter(t => t.status === 'In-Progress');
      if (inProg.length > 0 && (checkinData.workload_hours > 50 || (workloadFactor && workloadFactor.impact_level === 'HIGH'))) {
        actionItems.push({
          category: 'Training & Duty Balance',
          title: 'Concurrent Tactical Course Load Management',
          description: `Active training commitments (${inProg.map(t => t.program).join(', ')}) concurrent with high duty hours. Coordinate training window pacing with Course Instructor to prevent sleep disruption.`,
          priority: 'MEDIUM'
        });
      }
    }

    // Determine primary action
    if (concernLevel === 'UNDETERMINED') {
      primaryAction = 'Authorized evidence is currently insufficient to determine welfare concern reliably. Please sync your Smart Jacket sensor or complete the optional self-check.';
      actionItems.length = 0; // Clear speculative items
      actionItems.push({
        category: 'Evidence Provision',
        title: 'Synchronize Telemetry or Complete Self-Check',
        description: 'To prevent inaccurate guessing, WelfareAI requires either authorized Smart Jacket sensor telemetry or a self-check questionnaire alongside operational duty context.',
        priority: 'MEDIUM'
      });
    } else if (concernLevel === 'HIGH') {
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

  /**
   * Generates supportive, non-disciplinary Welfare Intervention Recommendations
   * for Welfare Officers and Personnel across 5 authorized categories.
   * Strictly non-punitive, non-automated, requiring human officer review.
   */
  generateWelfareInterventions(personnel = {}, prediction = {}, checkinData = {}, hrData = {}) {
    const risk = prediction.compositeRiskScore != null ? Math.round(Number(prediction.compositeRiskScore)) : 30;
    const concernLevel = prediction.concernLevel || 'LOW';
    const isUndetermined = concernLevel === 'UNDETERMINED';

    const pName = personnel.fullName || 'Personnel Member';
    const pId = personnel.personnelId || 'CRPF';
    const pRank = personnel.rank || 'Personnel';
    const pUnit = personnel.unit || 'Battalion Unit';

    // Aggregate HR fields from hrData or personnel
    const leavePattern = hrData.leavePattern || personnel.leavePattern || {};
    const deploymentHistory = Array.isArray(hrData.deploymentHistory) ? hrData.deploymentHistory : (Array.isArray(personnel.deploymentHistory) ? personnel.deploymentHistory : []);
    const dutySchedule = hrData.dutySchedule || personnel.dutySchedule || {};
    const transferFrequency = hrData.transferFrequency || personnel.transferFrequency || {};
    const trainingCommitments = Array.isArray(hrData.trainingCommitments) ? hrData.trainingCommitments : (Array.isArray(personnel.trainingCommitments) ? personnel.trainingCommitments : []);
    const workloadTrends = hrData.workloadTrends || personnel.workloadTrends || {};

    const sleep = checkinData.recovery_sleep_hours != null ? Number(checkinData.recovery_sleep_hours) : (checkinData.sleep_hours_per_night != null ? Number(checkinData.sleep_hours_per_night) : 7.0);
    const weeklyHours = checkinData.workload_hours != null ? Number(checkinData.workload_hours) : (checkinData.weekly_duty_hours != null ? Number(checkinData.weekly_duty_hours) : 48);
    const shifts = checkinData.shift_continuity_days != null ? Number(checkinData.shift_continuity_days) : 0;
    const prolonged = checkinData.prolonged_duty_hours != null ? Number(checkinData.prolonged_duty_hours) : 0;
    const nightHours = checkinData.night_duty_hours != null ? Number(checkinData.night_duty_hours) : 0;
    const pss = checkinData.pss_score != null ? Number(checkinData.pss_score) : null;
    const hrv = checkinData.hrv_ms != null ? Number(checkinData.hrv_ms) : null;

    const interventions = [];

    // 1. WELFARE CHECK-IN CADENCE
    let checkinCadenceAction = 'Maintain standard bi-weekly check-in schedule to monitor baseline welfare stability.';
    let checkinCadenceEvidence = 'Operating within expected operational parameters; routine check-in maintains trajectory tracking.';
    let checkinPriority = 'LOW';

    if (isUndetermined) {
      checkinCadenceAction = 'Prompt personnel for an operational self-check or Smart Jacket sensor sync to establish evidence.';
      checkinCadenceEvidence = 'Current data is insufficient to compute an accurate risk index without guessing.';
      checkinPriority = 'MEDIUM';
    } else if (concernLevel === 'HIGH' || risk >= 65) {
      checkinCadenceAction = 'Schedule proactive weekly check-in interval to closely evaluate recovery progression and strain relief.';
      checkinCadenceEvidence = `Elevated composite strain index (${risk}%) with ${weeklyHours}h/wk operational load.`;
      checkinPriority = 'HIGH';
    } else if (concernLevel === 'MODERATE' || risk >= 45) {
      checkinCadenceAction = 'Recommend weekly check-in during the current operational duty cycle to observe fatigue stabilization.';
      checkinCadenceEvidence = `Moderate strain indicators observed (Risk score: ${risk}%).`;
      checkinPriority = 'MEDIUM';
    }

    interventions.push({
      id: `INT-CHK-${pId}`,
      category: 'welfare_checkin',
      categoryLabel: 'Welfare Check-in Cadence',
      title: 'Proactive Welfare Check-in Scheduling',
      suggestedAction: checkinCadenceAction,
      evidenceBasis: checkinCadenceEvidence,
      reviewTimeframe: concernLevel === 'HIGH' ? 'Within 3 Days' : 'Next 7 Days',
      priority: checkinPriority,
      isDisciplinary: false,
      autoActionTaken: false,
      requiresOfficerConfirmation: true
    });

    // 2. OFFICER SUPPORTIVE FOLLOW-UP
    let officerFollowupAction = 'Conduct routine informal welfare check during normal unit rounds; reinforce open-door welfare access.';
    let officerFollowupEvidence = 'Baseline monitoring shows positive coping and adequate unit connectedness.';
    let officerPriority = 'LOW';

    if (concernLevel === 'HIGH' || pss >= 24 || shifts >= 7) {
      officerFollowupAction = 'Conduct supportive, confidential 1-on-1 dialogue to review duty pacing, family support, and fatigue relief.';
      officerFollowupEvidence = `High welfare concern flag (${risk}% strain), continuous shift exposure (${shifts} days), or elevated self-check score.`;
      officerPriority = 'HIGH';
    } else if (concernLevel === 'MODERATE' || (transferFrequency && transferFrequency.highMobilityFlag)) {
      officerFollowupAction = 'Schedule brief informal 1-on-1 check-in with Welfare Officer or Unit Peer Mentor to discuss adaptation.';
      officerFollowupEvidence = `Moderate strain index or recent posting transfer (${transferFrequency.transfersCount || 0} transfers on record).`;
      officerPriority = 'MEDIUM';
    }

    interventions.push({
      id: `INT-OFF-${pId}`,
      category: 'officer_followup',
      categoryLabel: 'Officer Supportive Follow-Up',
      title: 'Supportive 1-on-1 Welfare Dialogue',
      suggestedAction: officerFollowupAction,
      evidenceBasis: officerFollowupEvidence,
      reviewTimeframe: concernLevel === 'HIGH' ? 'Within 48 Hours' : 'Within 1 Week',
      priority: officerPriority,
      isDisciplinary: false,
      autoActionTaken: false,
      requiresOfficerConfirmation: true
    });

    // 3. REST / RECOVERY REVIEW
    let restAction = 'Maintain unbroken 7-8 hours sleep hygiene and continue established recovery pacing.';
    let restEvidence = `Sleep duration averaging ${sleep.toFixed(1)} hrs/night with standard rotation.`;
    let restPriority = 'LOW';

    const hasLeaveDeficit = Boolean(leavePattern.leaveDeficitWarning || (leavePattern.daysRemaining >= 45 && leavePattern.daysAvailed <= 10));
    const hasSleepDeficit = sleep < 5.5;
    const hasAutonomicStrain = hrv !== null && hrv < 35;

    if (hasLeaveDeficit || hasSleepDeficit || shifts >= 7 || hasAutonomicStrain) {
      restPriority = 'HIGH';
      const reasons = [];
      if (hasLeaveDeficit) reasons.push(`accrued leave deficit (${leavePattern.daysRemaining || 52} days unavailed)`);
      if (hasSleepDeficit) reasons.push(`sleep recorded at ${sleep.toFixed(1)} hrs/night (<5.5h threshold)`);
      if (shifts >= 7) reasons.push(`${shifts} consecutive duty days without 24h rest`);
      if (hasAutonomicStrain) reasons.push(`suppressed autonomic recovery (HRV: ${hrv}ms)`);

      restAction = 'Recommend 48-hour recuperative rest window and coordinate with Adjutant to schedule accrued earned block leave.';
      restEvidence = `Compounding recovery debt driven by ${reasons.join(', ')}.`;
    } else if (sleep < 6.5 || nightHours >= 14) {
      restPriority = 'MEDIUM';
      restAction = 'Suggest post-night-watch restorative sleep protocol with dedicated dark-room decompression.';
      restEvidence = `Elevated nocturnal duty exposure (${nightHours}h night watch) with marginal sleep duration (${sleep.toFixed(1)}h).`;
    }

    interventions.push({
      id: `INT-RST-${pId}`,
      category: 'rest_recovery_review',
      categoryLabel: 'Rest / Recovery Review',
      title: 'Restorative Sleep & Leave Recuperation Review',
      suggestedAction: restAction,
      evidenceBasis: restEvidence,
      reviewTimeframe: restPriority === 'HIGH' ? 'Immediate (Next Watch Cycle)' : 'Next Weekly Roster',
      priority: restPriority,
      isDisciplinary: false,
      autoActionTaken: false,
      requiresOfficerConfirmation: true
    });

    // 4. WORKLOAD REVIEW
    let workloadAction = 'Current operational workload profile is balanced within nominal thresholds.';
    let workloadEvidence = `Weekly duty logged at ${weeklyHours} hrs/wk (Nominal benchmark: 48 hrs/wk).`;
    let workloadPriority = 'LOW';

    const isSurgeTrajectory = workloadTrends.trajectory === 'Increasing' || workloadTrends.surgeWeeksCount >= 3;
    const isHeavyWorkload = weeklyHours >= 58 || prolonged >= 12;

    if (isHeavyWorkload || isSurgeTrajectory || shifts >= 7) {
      workloadPriority = 'HIGH';
      const reasons = [];
      if (weeklyHours >= 58) reasons.push(`high weekly duty load (${weeklyHours} hrs/wk)`);
      if (prolonged >= 12) reasons.push(`prolonged continuous watch (${prolonged} hrs)`);
      if (isSurgeTrajectory) reasons.push(`sustained workload surge velocity (${workloadTrends.surgeWeeksCount || 3} consecutive surge weeks)`);
      if (shifts >= 7) reasons.push(`${shifts} consecutive shifts without rest day`);

      workloadAction = 'Recommend Adjutant review 4-hour watch split rotation and non-critical duty redistribution.';
      workloadEvidence = `Sustained workload overload pattern detected: ${reasons.join(', ')}.`;
    } else if (weeklyHours > 50 || prolonged >= 8) {
      workloadPriority = 'MEDIUM';
      workloadAction = 'Suggest monitoring shift tempo and capping optional watch extensions over upcoming rotation.';
      workloadEvidence = `Elevated weekly duty volume (${weeklyHours} hrs/wk) approaching upper operational threshold.`;
    }

    interventions.push({
      id: `INT-WRK-${pId}`,
      category: 'workload_review',
      categoryLabel: 'Workload Review',
      title: 'Operational Shift Duration & Duty Pacing Review',
      suggestedAction: workloadAction,
      evidenceBasis: workloadEvidence,
      reviewTimeframe: workloadPriority === 'HIGH' ? 'Next Duty Handover' : 'Routine Roster Review',
      priority: workloadPriority,
      isDisciplinary: false,
      autoActionTaken: false,
      requiresOfficerConfirmation: true
    });

    // 5. SUPPORT REFERRAL
    let referralAction = 'Provide standard informational awareness on confidential 24/7 tele-counseling and unit support resources.';
    let referralEvidence = 'Routine welfare readiness profile; optional resources accessible on demand.';
    let referralPriority = 'LOW';

    if (concernLevel === 'HIGH' || pss >= 26 || risk >= 70) {
      referralPriority = 'HIGH';
      referralAction = 'Offer confidential voluntary referral to Regimental Medical Officer (RMO) or 24/7 MHA Psychological Support Desk.';
      referralEvidence = `Severe multi-factor operational strain index (${risk}%) indicates physiological fatigue and elevated subjective pressure.`;
    } else if (concernLevel === 'MODERATE' || (Array.isArray(trainingCommitments) && trainingCommitments.some(t => t && t.status === 'In-Progress') && weeklyHours > 52)) {
      referralPriority = 'MEDIUM';
      referralAction = 'Highlight voluntary confidential tele-counseling (1800-180-4024) and family welfare center liaison.';
      referralEvidence = `Moderate strain or concurrent training commitments combined with operational duties.`;
    }

    interventions.push({
      id: `INT-REF-${pId}`,
      category: 'support_referral',
      categoryLabel: 'Support Referral',
      title: 'Voluntary Welfare Support & Healthcare Liaison',
      suggestedAction: referralAction,
      evidenceBasis: referralEvidence,
      reviewTimeframe: referralPriority === 'HIGH' ? 'Within 48 Hours' : 'Voluntary Access',
      priority: referralPriority,
      isDisciplinary: false,
      autoActionTaken: false,
      requiresOfficerConfirmation: true
    });

    return {
      personnelId: pId,
      fullName: pName,
      rank: pRank,
      unit: pUnit,
      concernLevel,
      compositeRiskScore: risk,
      evidenceStrength: prediction.evidenceStrength || 'MODERATE',
      summary: `Formulated ${interventions.length} supportive, non-disciplinary welfare interventions based on operational evidence, HR profile, and fatigue indicators.`,
      disclaimer: 'Advisory Pacing Only — All recommendations are strictly non-punitive decision support tools for authorized officers. Automated duty modification is strictly prohibited.',
      interventions
    };
  }
}

module.exports = new RecommendationService();

