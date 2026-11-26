import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Chart,
  LineController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import {
  Home,
  Building2,
  Tractor,
  Server,
  Activity,
  Zap,
  Sun,
  BatteryCharging,
  Clock,
  RotateCcw,
  Layers
} from 'lucide-react';
import { AuditConfig, AuditResult } from '../physics';

Chart.register(
  LineController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export type LoadProfileId = 'residential' | 'office' | 'agri_pump' | 'continuous_24x7';
export type SeasonalWindowId = 'annual' | 'monsoon' | 'non_monsoon';

export interface LoadProfileDefinition {
  id: LoadProfileId;
  name: string;
  shortLabel: string;
  tagline: string;
  peakWindowLabel: string;
  defaultDailyKwh: number;
  // 24 hourly relative weights (00:00 to 23:00); automatically normalized to sum to defaultDailyKwh
  hourlyWeights: number[];
  engineeringInsight: string;
}

export const HOME_LOAD_PROFILES: Record<LoadProfileId, LoadProfileDefinition> = {
  residential: {
    id: 'residential',
    name: 'Standard Residential Home',
    shortLabel: 'Residential Home',
    tagline: 'Morning geyser/kitchen peak (06:00–09:00) & evening AC/lighting surge (18:00–23:00)',
    peakWindowLabel: '19:00–22:00 Evening Peak',
    defaultDailyKwh: 12.0,
    hourlyWeights: [
      0.34, 0.30, 0.28, 0.27, 0.28, 0.42, // 00:00 - 05:00 (Night ceiling fans + fridge)
      0.72, 0.88, 0.78, 0.52, 0.42, 0.40, // 06:00 - 11:00 (Morning water heater, kitchen, pump)
      0.44, 0.48, 0.50, 0.46, 0.44, 0.54, // 12:00 - 17:00 (Afternoon fans/cooler + standby)
      0.76, 0.96, 1.05, 0.98, 0.76, 0.48  // 18:00 - 23:00 (Evening AC, induction, TV, LED lights)
    ],
    engineeringInsight:
      'Indian households consume ~42% of daily electricity between 18:00 and 23:00 after sunset. Unbuffered solar misses the evening peak without net-metering or battery storage, whereas coastal/monsoon afternoon-evening thermal breezes can partially overlap early evening demand.'
  },
  office: {
    id: 'office',
    name: 'Commercial Office / Retail Studio',
    shortLabel: 'Commercial Office',
    tagline: 'High daytime HVAC, workstations & commercial lighting (09:00–18:00)',
    peakWindowLabel: '12:00–16:00 HVAC Peak',
    defaultDailyKwh: 18.0,
    hourlyWeights: [
      0.16, 0.15, 0.15, 0.15, 0.15, 0.16, // 00:00 - 05:00 (Security & router standby)
      0.18, 0.25, 0.58, 1.18, 1.42, 1.56, // 06:00 - 11:00 (Office open & HVAC ramp)
      1.65, 1.72, 1.76, 1.68, 1.52, 1.28, // 12:00 - 17:00 (Peak daytime thermal & workstation load)
      0.74, 0.38, 0.22, 0.18, 0.17, 0.16  // 18:00 - 23:00 (Lockup & night setback)
    ],
    engineeringInsight:
      'Commercial office demand correlates tightly (r > +0.85) with daytime solar irradiance (09:00–17:00). Same-budget rooftop solar directly offsets high daytime commercial tariffs without needing expensive battery banks.'
  },
  agri_pump: {
    id: 'agri_pump',
    name: 'Agricultural Irrigation Pump (3 HP)',
    shortLabel: 'Agri Irrigation Pump',
    tagline: 'Dual-block field pumping schedule: Morning (05:00–10:00) & Afternoon (15:00–17:00)',
    peakWindowLabel: '06:00–09:00 Morning Block',
    defaultDailyKwh: 15.0,
    hourlyWeights: [
      0.08, 0.08, 0.08, 0.08, 0.14, 1.35, // 00:00 - 05:00 (05:00 morning irrigation start)
      1.85, 1.95, 1.88, 1.62, 0.95, 0.28, // 06:00 - 11:00 (Peak 3 HP submersible pump discharge)
      0.24, 0.24, 0.32, 1.32, 1.45, 1.18, // 12:00 - 17:00 (Afternoon secondary watering block)
      0.25, 0.22, 0.20, 0.16, 0.12, 0.09  // 18:00 - 23:00 (Farmhouse evening LED baseload)
    ],
    engineeringInsight:
      'Agricultural pumping peaks in the early morning (05:00–10:00) when wind speeds are typically at their diurnal minimum and solar irradiance is still ramping up—making afternoon thermal wind gusts (14:00–18:00) better aligned with the secondary afternoon irrigation block.'
  },
  continuous_24x7: {
    id: 'continuous_24x7',
    name: '24/7 Cold-Storage / Telecom Microgrid',
    shortLabel: '24/7 Cold Storage',
    tagline: 'Continuous round-the-clock refrigeration & transceiver load with midday thermal climb',
    peakWindowLabel: '13:00–17:00 Thermal Climb',
    defaultDailyKwh: 14.4,
    hourlyWeights: [
      0.52, 0.50, 0.49, 0.48, 0.48, 0.50, // 00:00 - 05:00
      0.54, 0.58, 0.62, 0.66, 0.70, 0.74, // 06:00 - 11:00
      0.78, 0.82, 0.84, 0.83, 0.79, 0.73, // 12:00 - 17:00
      0.67, 0.63, 0.60, 0.57, 0.55, 0.53  // 18:00 - 23:00
    ],
    engineeringInsight:
      'Continuous 24/7 microgrid loads absorb every Watt of nocturnal wind generation without curtailment, making wind-solar hybridization valuable on windy coastal or ridge sites.'
  }
};

const HOUR_LABELS = Array.from({ length: 24 }, (_, hr) => `${String(hr).padStart(2, '0')}:00`);

/**
 * Computes statistical Pearson correlation coefficient r in [-1, 1] between two 24-hour series
 */
function computePearsonCorrelation(seriesA: number[], seriesB: number[]): number {
  const n = Math.min(seriesA.length, seriesB.length);
  if (n === 0) return 0;

  const meanA = seriesA.reduce((s, v) => s + v, 0) / n;
  const meanB = seriesB.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let denA = 0;
  let denB = 0;

  for (let i = 0; i < n; i++) {
    const da = seriesA[i] - meanA;
    const db = seriesB[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }

  const denom = Math.sqrt(denA * denB);
  if (denom < 1e-9) return 0;
  return Number((num / denom).toFixed(2));
}

interface HomeLoadProfilePanelProps {
  audit: AuditResult;
  config: AuditConfig;
  siteName: string;
  isComparing?: boolean;
  comparisonAudit?: AuditResult | null;
  comparisonSiteName?: string | null;
}

export const HomeLoadProfilePanel: React.FC<HomeLoadProfilePanelProps> = ({
  audit,
  config,
  siteName,
  isComparing = false,
  comparisonAudit = null,
  comparisonSiteName = null
}) => {
  const [selectedProfileId, setSelectedProfileId] = useState<LoadProfileId>('residential');
  const [seasonalWindow, setSeasonalWindow] = useState<SeasonalWindowId>('annual');
  const [customDailyKwh, setCustomDailyKwh] = useState<number | null>(null);
  const [showHybridCurve, setShowHybridCurve] = useState<boolean>(false);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const activeProfile = HOME_LOAD_PROFILES[selectedProfileId];
  const dailyDemandKwh = customDailyKwh ?? activeProfile.defaultDailyKwh;

  const showComparisonOverlay = Boolean(isComparing && comparisonAudit);
  const shortActiveName = siteName.split(',')[0].trim();
  const shortCompName = comparisonSiteName ? comparisonSiteName.split(',')[0].trim() : 'Baseline B';

  const handleSelectProfile = (profileId: LoadProfileId) => {
    setSelectedProfileId(profileId);
    setCustomDailyKwh(null);
  };

  // Select 24-hour wind and solar generation arrays based on seasonal window
  const { windHourlyW, solarHourlyW, compWindHourlyW, seasonBadgeText } = useMemo(() => {
    if (seasonalWindow === 'monsoon') {
      return {
        windHourlyW: audit.monsoonDiurnalWindAvgW ?? audit.diurnalWindAvgW,
        solarHourlyW: audit.monsoonDiurnalSolarAvgW ?? audit.diurnalSolarAvgW,
        compWindHourlyW:
          comparisonAudit?.monsoonDiurnalWindAvgW ?? comparisonAudit?.diurnalWindAvgW ?? null,
        seasonBadgeText: 'Southwest Monsoon Window (May–Sep · 153 Days)'
      };
    }
    if (seasonalWindow === 'non_monsoon') {
      return {
        windHourlyW: audit.nonMonsoonDiurnalWindAvgW ?? audit.diurnalWindAvgW,
        solarHourlyW: audit.nonMonsoonDiurnalSolarAvgW ?? audit.diurnalSolarAvgW,
        compWindHourlyW:
          comparisonAudit?.nonMonsoonDiurnalWindAvgW ?? comparisonAudit?.diurnalWindAvgW ?? null,
        seasonBadgeText: 'Post-Monsoon / Dry Window (Oct–Apr · 212 Days)'
      };
    }
    return {
      windHourlyW: audit.diurnalWindAvgW,
      solarHourlyW: audit.diurnalSolarAvgW,
      compWindHourlyW: comparisonAudit?.diurnalWindAvgW ?? null,
      seasonBadgeText: 'Full 8,760-Hr Annual Diurnal Mean (365 Days)'
    };
  }, [seasonalWindow, audit, comparisonAudit]);

  // Compute 24-hour normalized Load Curve in Watts so that sum(loadHourlyW) / 1000 === dailyDemandKwh
  const loadHourlyW = useMemo(() => {
    const weightSum = activeProfile.hourlyWeights.reduce((acc, w) => acc + w, 0);
    const targetDailyWh = dailyDemandKwh * 1000;
    return activeProfile.hourlyWeights.map((w) => Math.round((w / weightSum) * targetDailyWh));
  }, [activeProfile, dailyDemandKwh]);

  // Combined Wind + Same-Budget Solar Hybrid 24-hour curve in Watts
  const hybridHourlyW = useMemo(() => {
    return windHourlyW.map((w, hr) => w + (solarHourlyW[hr] ?? 0));
  }, [windHourlyW, solarHourlyW]);

  // Core Correlation & Self-Sufficiency Metrics
  const metrics = useMemo(() => {
    const totalLoadWh = loadHourlyW.reduce((s, v) => s + v, 0);
    const totalWindWh = windHourlyW.reduce((s, v) => s + v, 0);
    const totalSolarWh = solarHourlyW.reduce((s, v) => s + v, 0);

    let directWindSelfConsumedWh = 0;
    let directSolarSelfConsumedWh = 0;
    let directHybridSelfConsumedWh = 0;
    let directCompWindSelfConsumedWh = 0;

    let windSurplusWh = 0;
    let solarSurplusWh = 0;
    let peakLoadW = -1;
    let peakLoadHour = 0;

    for (let hr = 0; hr < 24; hr++) {
      const loadW = loadHourlyW[hr];
      const windW = windHourlyW[hr] ?? 0;
      const solarW = solarHourlyW[hr] ?? 0;
      const hybridW = windW + solarW;
      const compW = compWindHourlyW?.[hr] ?? 0;

      directWindSelfConsumedWh += Math.min(loadW, windW);
      directSolarSelfConsumedWh += Math.min(loadW, solarW);
      directHybridSelfConsumedWh += Math.min(loadW, hybridW);
      directCompWindSelfConsumedWh += Math.min(loadW, compW);

      windSurplusWh += Math.max(0, windW - loadW);
      solarSurplusWh += Math.max(0, solarW - loadW);

      if (loadW > peakLoadW) {
        peakLoadW = loadW;
        peakLoadHour = hr;
      }
    }

    const windCoveragePct =
      totalLoadWh > 0 ? Number(((directWindSelfConsumedWh / totalLoadWh) * 100).toFixed(1)) : 0;
    const solarCoveragePct =
      totalLoadWh > 0 ? Number(((directSolarSelfConsumedWh / totalLoadWh) * 100).toFixed(1)) : 0;
    const hybridCoveragePct =
      totalLoadWh > 0 ? Number(((directHybridSelfConsumedWh / totalLoadWh) * 100).toFixed(1)) : 0;
    const compWindCoveragePct =
      totalLoadWh > 0 ? Number(((directCompWindSelfConsumedWh / totalLoadWh) * 100).toFixed(1)) : 0;

    const windPearsonR = computePearsonCorrelation(windHourlyW, loadHourlyW);
    const solarPearsonR = computePearsonCorrelation(solarHourlyW, loadHourlyW);
    const compWindPearsonR = compWindHourlyW
      ? computePearsonCorrelation(compWindHourlyW, loadHourlyW)
      : null;

    const windAtPeakHourW = windHourlyW[peakLoadHour] ?? 0;
    const solarAtPeakHourW = solarHourlyW[peakLoadHour] ?? 0;
    const peakHourWindSharePct =
      peakLoadW > 0 ? Number(Math.min(100, (windAtPeakHourW / peakLoadW) * 100).toFixed(1)) : 0;
    const peakHourSolarSharePct =
      peakLoadW > 0 ? Number(Math.min(100, (solarAtPeakHourW / peakLoadW) * 100).toFixed(1)) : 0;

    const unmetWindGridDeficitKwh = Math.max(0, (totalLoadWh - directWindSelfConsumedWh) / 1000);
    const dailyGridBillWithWindInr = unmetWindGridDeficitKwh * config.tariffInr;
    const dailyWindSavingsInr = (directWindSelfConsumedWh / 1000) * config.tariffInr;

    // Evening load (18:00 - 23:00) kWh for battery sizing recommendation
    const eveningLoadKwh =
      (loadHourlyW[18] +
        loadHourlyW[19] +
        loadHourlyW[20] +
        loadHourlyW[21] +
        loadHourlyW[22] +
        loadHourlyW[23]) /
      1000;

    return {
      totalLoadKwh: totalLoadWh / 1000,
      totalWindKwh: totalWindWh / 1000,
      totalSolarKwh: totalSolarWh / 1000,
      windCoveragePct,
      solarCoveragePct,
      hybridCoveragePct,
      compWindCoveragePct,
      windPearsonR,
      solarPearsonR,
      compWindPearsonR,
      peakLoadW,
      peakLoadHour,
      windAtPeakHourW,
      solarAtPeakHourW,
      peakHourWindSharePct,
      peakHourSolarSharePct,
      unmetWindGridDeficitKwh: Number(unmetWindGridDeficitKwh.toFixed(2)),
      windSurplusKwh: Number((windSurplusWh / 1000).toFixed(2)),
      solarSurplusKwh: Number((solarSurplusWh / 1000).toFixed(2)),
      dailyGridBillWithWindInr: Math.round(dailyGridBillWithWindInr),
      dailyWindSavingsInr: Number(dailyWindSavingsInr.toFixed(1)),
      recommendedBatteryKwh: Number((eveningLoadKwh * 1.15).toFixed(1))
    };
  }, [loadHourlyW, windHourlyW, solarHourlyW, compWindHourlyW, config.tariffInr]);

  // Qualitative badge for Pearson r
  const getCorrelationBadge = (r: number) => {
    if (r >= 0.45) {
      return {
        label: 'Strong Diurnal Match',
        className: 'bg-emerald-100 text-emerald-800 border-emerald-200'
      };
    }
    if (r >= 0.1) {
      return {
        label: 'Moderate Phase Overlap',
        className: 'bg-cyan-100 text-cyan-800 border-cyan-200'
      };
    }
    if (r >= -0.25) {
      return {
        label: 'Weak / Flat Correlation',
        className: 'bg-amber-100 text-amber-800 border-amber-200'
      };
    }
    return {
      label: 'Out-of-Phase Mismatch',
      className: 'bg-rose-100 text-rose-800 border-rose-200'
    };
  };

  const windCorrBadge = getCorrelationBadge(metrics.windPearsonR);

  // Manage Chart.js Instance on canvasRef
  useEffect(() => {
    if (!canvasRef.current) return;

    const datasets: any[] = [
      {
        label: `${activeProfile.shortLabel} Load Demand (W)`,
        data: loadHourlyW,
        borderColor: '#0F172A',
        backgroundColor: 'rgba(15, 23, 42, 0.06)',
        borderWidth: 2.5,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        tension: 0.35,
        fill: true,
        order: 1
      },
      {
        label: showComparisonOverlay
          ? `Micro-Wind Output (${shortActiveName})`
          : `Micro-Wind Output (${config.ratedPowerW}W @ ${config.hubHeightM}m)`,
        data: windHourlyW,
        borderColor: '#0891B2',
        backgroundColor: 'rgba(6, 182, 212, 0.22)',
        borderWidth: 2.5,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        tension: 0.35,
        fill: true,
        order: 2
      }
    ];

    if (showComparisonOverlay && compWindHourlyW) {
      datasets.push({
        label: `Micro-Wind Output (${shortCompName})`,
        data: compWindHourlyW,
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79, 70, 229, 0.12)',
        borderWidth: 2.2,
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.35,
        fill: true,
        order: 3
      });
    }

    if (showHybridCurve) {
      datasets.push({
        label: `Hybrid Wind + Same-Budget Solar (${audit.solarEquivalentKw.toFixed(1)} kW)`,
        data: hybridHourlyW,
        borderColor: '#059669',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderWidth: 2.2,
        borderDash: [4, 3],
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.35,
        fill: false,
        order: 4
      });
    } else {
      datasets.push({
        label: `Same-Budget Rooftop Solar (${audit.solarEquivalentKw.toFixed(1)} kW)`,
        data: solarHourlyW,
        borderColor: '#D97706',
        backgroundColor: 'rgba(245, 158, 11, 0.10)',
        borderWidth: 2,
        borderDash: [5, 4],
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.35,
        fill: false,
        order: 4
      });
    }

    if (chartInstanceRef.current) {
      chartInstanceRef.current.data.labels = HOUR_LABELS;
      chartInstanceRef.current.data.datasets = datasets;
      chartInstanceRef.current.update('none');
      return;
    }

    chartInstanceRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: HOUR_LABELS,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              color: '#334155',
              boxWidth: 12,
              boxHeight: 12,
              usePointStyle: true,
              pointStyle: 'circle',
              font: {
                family: "'Plus Jakarta Sans', sans-serif",
                size: 11
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#F8FAFC',
            bodyColor: '#E2E8F0',
            borderColor: 'rgba(148, 163, 184, 0.25)',
            borderWidth: 1,
            padding: 10
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(226, 232, 240, 0.6)' },
            ticks: {
              color: '#64748B',
              font: { family: "'JetBrains Mono', monospace", size: 10 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(226, 232, 240, 0.7)' },
            ticks: {
              color: '#64748B',
              font: { family: "'JetBrains Mono', monospace", size: 10 },
              callback: (val) => `${val} W`
            },
            title: {
              display: true,
              text: 'Hourly Power Demand vs. Generation (Watts)',
              color: '#64748B',
              font: { size: 10 }
            }
          }
        }
      }
    });
  }, [
    activeProfile.shortLabel,
    loadHourlyW,
    windHourlyW,
    solarHourlyW,
    hybridHourlyW,
    compWindHourlyW,
    showComparisonOverlay,
    showHybridCurve,
    shortActiveName,
    shortCompName,
    config.ratedPowerW,
    config.hubHeightM,
    audit.solarEquivalentKw
  ]);

  useEffect(() => {
    return () => {
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;
    };
  }, []);

  const profileButtons: {
    id: LoadProfileId;
    label: string;
    sub: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'residential',
      label: 'Standard Residential',
      sub: 'Morning & Evening Peak',
      icon: <Home className="h-4 w-4" />
    },
    {
      id: 'office',
      label: 'Commercial Office',
      sub: '09:00–18:00 HVAC Load',
      icon: <Building2 className="h-4 w-4" />
    },
    {
      id: 'agri_pump',
      label: 'Agricultural Pump',
      sub: '3 HP Irrigation Blocks',
      icon: <Tractor className="h-4 w-4" />
    },
    {
      id: 'continuous_24x7',
      label: '24/7 Microgrid',
      sub: 'Cold Room / Telecom',
      icon: <Server className="h-4 w-4" />
    }
  ];

  const inspectedHour = hoveredHour ?? metrics.peakLoadHour;
  const inspectedLoadW = loadHourlyW[inspectedHour] ?? 0;
  const inspectedWindW = windHourlyW[inspectedHour] ?? 0;
  const inspectedSolarW = solarHourlyW[inspectedHour] ?? 0;
  const inspectedNetWindW = inspectedWindW - inspectedLoadW;

  return (
    <section className="bento-card p-5 sm:p-6">
      {/* Header Row */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#D4D4CE] dark:border-[#22252A] pb-4 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 border border-[#0F62FE]/30 dark:border-sky-400/30 bg-[#0F62FE]/10 dark:bg-sky-500/10 px-2 py-0.5 font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-[#0F62FE] dark:text-sky-400">
              <Activity className="h-3 w-3" />
              Diurnal Demand-Supply Correlation Engine
            </span>
            <span className="font-mono-tabular border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6] dark:bg-[#161A20] px-2 py-0.5 text-[10px] font-semibold text-[#52565E] dark:text-[#9CA3AF]">
              {seasonBadgeText}
            </span>
          </div>
          <h2 className="mt-1.5 font-display text-lg font-bold tracking-tight text-[#111214] dark:text-[#F3F4F6] sm:text-xl">
            Home &amp; Facility Load Profile Correlation — Hourly Demand vs. Micro-Wind Output
          </h2>
          <p className="mt-0.5 text-xs text-[#52565E] dark:text-[#9CA3AF]">
            Toggle between residential, office, agricultural pump, and 24/7 microgrid consumption curves to test how{' '}
            <strong className="text-[#111214] dark:text-[#D1D5DB]">{shortActiveName}</strong> wind generation aligns with real hourly energy use.
          </p>
        </div>

        {/* Seasonal Window Selector & Hybrid Curve Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6] dark:bg-[#0A0B0D] p-1 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setSeasonalWindow('annual')}
              className={`px-2.5 py-1 transition-all ${
                seasonalWindow === 'annual'
                  ? 'bg-[#F4F4F0] dark:bg-[#1C2026] text-[#111214] dark:text-[#F3F4F6] shadow-sm'
                  : 'text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111214] dark:hover:text-[#F3F4F6]'
              }`}
            >
              Annual Mean
            </button>
            <button
              type="button"
              onClick={() => setSeasonalWindow('monsoon')}
              className={`px-2.5 py-1 transition-all ${
                seasonalWindow === 'monsoon'
                  ? 'bg-[#F4F4F0] dark:bg-[#1C2026] text-[#0F62FE] dark:text-sky-400 shadow-sm'
                  : 'text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111214] dark:hover:text-[#F3F4F6]'
              }`}
            >
              Monsoon (May–Sep)
            </button>
            <button
              type="button"
              onClick={() => setSeasonalWindow('non_monsoon')}
              className={`px-2.5 py-1 transition-all ${
                seasonalWindow === 'non_monsoon'
                  ? 'bg-[#F4F4F0] dark:bg-[#1C2026] text-[#D97706] dark:text-amber-400 shadow-sm'
                  : 'text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111214] dark:hover:text-[#F3F4F6]'
              }`}
            >
              Dry Season (Oct–Apr)
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowHybridCurve((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-[11px] font-bold transition-all ${
              showHybridCurve
                ? 'border-emerald-600/40 dark:border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#161A20] text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111214] dark:hover:text-[#F3F4F6]'
            }`}
          >
            <Layers className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{showHybridCurve ? 'Showing Hybrid Wind+Solar' : 'Show Hybrid Wind+Solar'}</span>
          </button>
        </div>
      </div>

      {/* 4 Load Profile Selector Cards + Daily Consumption Slider */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:col-span-8">
          {profileButtons.map((btn) => {
            const isSelected = selectedProfileId === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => handleSelectProfile(btn.id)}
                className={`flex flex-col items-start justify-between border p-3 text-left transition-all ${
                  isSelected
                    ? 'border-[#111214] dark:border-[#F3F4F6] bg-[#111214] dark:bg-[#1C2026] text-white dark:text-[#F3F4F6] shadow-md'
                    : 'border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/70 dark:bg-[#0A0B0D]/70 text-[#111214] dark:text-[#D1D5DB] hover:border-[#52565E] dark:hover:border-[#3D4249] hover:bg-[#ECECE6] dark:hover:bg-[#161A20]'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span
                    className={`flex h-7 w-7 items-center justify-center ${
                      isSelected ? 'bg-sky-500/20 text-sky-400' : 'bg-[#ECECE6] dark:bg-[#161A20] text-[#52565E] dark:text-[#9CA3AF]'
                    }`}
                  >
                    {btn.icon}
                  </span>
                  <span
                    className={`font-mono-tabular px-1.5 py-0.5 text-[10px] font-bold ${
                      isSelected ? 'bg-white/15 text-sky-300 dark:text-sky-400' : 'bg-[#D4D4CE]/75 dark:bg-[#22252A]/75 text-[#52565E] dark:text-[#9CA3AF]'
                    }`}
                  >
                    {HOME_LOAD_PROFILES[btn.id].defaultDailyKwh.toFixed(1)} kWh/d
                  </span>
                </div>
                <div className="mt-2.5">
                  <div className="text-xs font-extrabold leading-tight">{btn.label}</div>
                  <div
                    className={`mt-0.5 text-[10px] ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {btn.sub}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Daily Energy Consumption Scaler Box */}
        <div className="flex flex-col justify-between border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/80 dark:bg-[#0A0B0D]/80 p-3.5 lg:col-span-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#52565E] dark:text-[#9CA3AF]">
              Daily Load Demand Scale
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono-tabular text-sm font-extrabold text-[#111214] dark:text-[#F3F4F6]">
                {dailyDemandKwh.toFixed(1)} kWh/day
              </span>
              {customDailyKwh !== null && (
                <button
                  type="button"
                  onClick={() => setCustomDailyKwh(null)}
                  title="Reset to profile default kWh/day"
                  className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#161A20] p-1 text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111214] dark:hover:text-[#F3F4F6]"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <input
            type="range"
            min={4}
            max={36}
            step={0.5}
            value={dailyDemandKwh}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) {
                setCustomDailyKwh(Math.min(100, Math.max(2, v)));
              }
            }}
            className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-slate-900"
          />

          <div className="mt-1.5 flex items-center justify-between text-[10px] font-medium text-slate-500">
            <span>4 kWh/d (Small Rural)</span>
            <span className="font-mono-tabular text-slate-700">
              ~{Math.round(dailyDemandKwh * 30)} kWh/month
            </span>
            <span>36 kWh/d (Heavy Load)</span>
          </div>
        </div>
      </div>

      {/* 4 Correlation & Self-Sufficiency KPI Cards */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Diurnal Pearson Correlation (r) */}
        <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/90 dark:bg-[#101216]/90 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#52565E] dark:text-[#9CA3AF]">
              1. Diurnal Correlation (r)
            </span>
            <span
              className={`border px-2 py-0.5 font-mono-tabular text-[10px] font-bold ${windCorrBadge.className}`}
            >
              {windCorrBadge.label}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono-tabular text-2xl font-extrabold text-[#0F62FE] dark:text-sky-400">
              {metrics.windPearsonR >= 0 ? `+${metrics.windPearsonR.toFixed(2)}` : metrics.windPearsonR.toFixed(2)}
            </span>
            <span className="text-xs font-semibold text-[#52565E] dark:text-[#9CA3AF]">Wind vs. Load</span>
          </div>
          {showComparisonOverlay && metrics.compWindPearsonR !== null && (
            <div className="mt-1 font-mono-tabular text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
              {shortCompName} Wind r ={' '}
              {metrics.compWindPearsonR >= 0
                ? `+${metrics.compWindPearsonR.toFixed(2)}`
                : metrics.compWindPearsonR.toFixed(2)}
            </div>
          )}
          <div className="mt-1.5 flex items-center justify-between border-t border-[#D4D4CE] dark:border-[#22252A] pt-1.5 text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
            <span>Same-Budget Solar r:</span>
            <span className="font-mono-tabular font-bold text-[#D97706] dark:text-amber-400">
              {metrics.solarPearsonR >= 0
                ? `+${metrics.solarPearsonR.toFixed(2)}`
                : metrics.solarPearsonR.toFixed(2)}
            </span>
          </div>
        </div>

        {/* KPI 2: Direct Real-Time Self-Supply Coverage (%) */}
        <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/90 dark:bg-[#101216]/90 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#52565E] dark:text-[#9CA3AF]">
              2. Direct Load Coverage
            </span>
            <Zap className="h-3.5 w-3.5 text-[#0F62FE] dark:text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono-tabular text-2xl font-extrabold text-[#111214] dark:text-[#F3F4F6]">
              {metrics.windCoveragePct}%
            </span>
            <span className="text-xs font-semibold text-[#52565E] dark:text-[#9CA3AF]">by Micro-Wind</span>
          </div>
          {showComparisonOverlay && (
            <div className="mt-1 font-mono-tabular text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
              {shortCompName}: {metrics.compWindCoveragePct}% load covered
            </div>
          )}
          <div className="mt-1.5 flex items-center justify-between border-t border-[#D4D4CE] dark:border-[#22252A] pt-1.5 text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
            <span>Solar Direct / Hybrid:</span>
            <span className="font-mono-tabular font-bold text-[#D97706] dark:text-amber-400">
              {metrics.solarCoveragePct}%{' '}
              <span className="text-emerald-600 dark:text-emerald-400">({metrics.hybridCoveragePct}% Hybrid)</span>
            </span>
          </div>
        </div>

        {/* KPI 3: Peak Demand Hour Performance */}
        <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/90 dark:bg-[#101216]/90 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#52565E] dark:text-[#9CA3AF]">
              3. Peak Hour ({String(metrics.peakLoadHour).padStart(2, '0')}:00)
            </span>
            <Clock className="h-3.5 w-3.5 text-[#52565E] dark:text-[#9CA3AF]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono-tabular text-2xl font-extrabold text-[#111214] dark:text-[#F3F4F6]">
              {metrics.peakLoadW} W
            </span>
            <span className="text-xs font-semibold text-[#52565E] dark:text-[#9CA3AF]">Peak Demand</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-[#D4D4CE] dark:border-[#22252A] pt-1.5 text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
            <span>Wind @ {String(metrics.peakLoadHour).padStart(2, '0')}:00:</span>
            <span className="font-mono-tabular font-bold text-[#0F62FE] dark:text-sky-400">
              {metrics.windAtPeakHourW} W ({metrics.peakHourWindSharePct}%)
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
            <span>Solar @ {String(metrics.peakLoadHour).padStart(2, '0')}:00:</span>
            <span className="font-mono-tabular font-bold text-[#D97706] dark:text-amber-400">
              {metrics.solarAtPeakHourW} W ({metrics.peakHourSolarSharePct}%)
            </span>
          </div>
        </div>

        {/* KPI 4: Unmet Grid Import & Battery Buffer */}
        <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/90 dark:bg-[#101216]/90 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#52565E] dark:text-[#9CA3AF]">
              4. Grid Deficit &amp; Storage
            </span>
            <BatteryCharging className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono-tabular text-2xl font-extrabold text-rose-600 dark:text-rose-400">
              {metrics.unmetWindGridDeficitKwh}
            </span>
            <span className="text-xs font-semibold text-[#52565E] dark:text-[#9CA3AF]">kWh/day Grid Import</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-[#D4D4CE] dark:border-[#22252A] pt-1.5 text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
            <span>Wind Curtailed Surplus:</span>
            <span className="font-mono-tabular font-bold text-[#0F62FE] dark:text-sky-400">
              {metrics.windSurplusKwh} kWh/d (Solar: {metrics.solarSurplusKwh})
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
            <span>Evening Battery Buffer:</span>
            <span className="font-mono-tabular font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.recommendedBatteryKwh} kWh LiFePO₄
            </span>
          </div>
        </div>
      </div>

      {/* Main 24-Hour Load vs. Generation Chart Canvas */}
      <div className="mt-4 min-w-0 border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-extrabold text-[#111214] dark:text-[#F3F4F6]">
              24-Hour Diurnal Curve: {activeProfile.name} ({dailyDemandKwh.toFixed(1)} kWh/day)
            </span>
            <span className="ml-2 text-[11px] text-[#52565E] dark:text-[#9CA3AF]">{activeProfile.tagline}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 bg-[#ECECE6] dark:bg-[#161A20] px-2 py-0.5 font-mono-tabular font-semibold text-[#111214] dark:text-[#D1D5DB]">
              Peak Window: {activeProfile.peakWindowLabel}
            </span>
          </div>
        </div>

        <div className="relative h-64 w-full min-w-0 overflow-hidden sm:h-72">
          <canvas ref={canvasRef} />
        </div>

        {/* 24-Hour Interactive Surplus / Deficit Timeline Strip */}
        <div className="mt-4 border-t border-[#D4D4CE] dark:border-[#22252A] pt-3">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold uppercase tracking-wider text-[#52565E] dark:text-[#9CA3AF]">
                Hourly Wind Balance Strip (00:00–23:00):
              </span>
              <span className="font-mono-tabular bg-[#111214] dark:bg-[#1C2026] px-2 py-0.5 text-[11px] font-bold text-white dark:text-[#F3F4F6]">
                {String(inspectedHour).padStart(2, '0')}:00
              </span>
              <span className="font-mono-tabular text-[#52565E] dark:text-[#D1D5DB]">
                Load: <strong>{inspectedLoadW} W</strong>
              </span>
              <span className="text-[#D4D4CE] dark:text-[#22252A]">·</span>
              <span className="font-mono-tabular text-[#0F62FE] dark:text-sky-400">
                Wind: <strong>{inspectedWindW} W</strong>
              </span>
              <span className="text-[#D4D4CE] dark:text-[#22252A]">·</span>
              <span className="font-mono-tabular text-[#D97706] dark:text-amber-400">
                Solar: <strong>{inspectedSolarW} W</strong>
              </span>
              <span className="text-[#D4D4CE] dark:text-[#22252A]">·</span>
              <span
                className={`font-mono-tabular font-bold ${
                  inspectedNetWindW >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {inspectedNetWindW >= 0
                  ? `+${inspectedNetWindW} W Wind Surplus`
                  : `${inspectedNetWindW} W Grid Import`}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-[#52565E] dark:text-[#9CA3AF]">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 bg-rose-500/25 ring-1 ring-rose-400" />
                0 W Wind Stall
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 bg-sky-400/40 ring-1 ring-sky-400" />
                Partial Wind Offset
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 bg-emerald-500 ring-1 ring-emerald-700" />
                100%+ Wind Surplus
              </span>
            </div>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="grid min-w-[520px] grid-cols-[repeat(24,minmax(0,1fr))] gap-1">
              {HOUR_LABELS.map((hrLabel, hr) => {
                const loadW = loadHourlyW[hr] ?? 1;
                const windW = windHourlyW[hr] ?? 0;
                const ratio = loadW > 0 ? windW / loadW : 0;

                let cellStyle = 'bg-rose-500/20 border-rose-400/50 text-rose-700 dark:text-rose-300';
                if (windW <= 1) {
                  cellStyle = 'bg-rose-500/15 border-rose-300/40 text-rose-600 dark:text-rose-400';
                } else if (ratio >= 1.0) {
                  cellStyle = 'bg-emerald-500 border-emerald-700 text-white';
                } else if (ratio >= 0.4) {
                  cellStyle = 'bg-sky-400 border-sky-600 text-slate-950';
                } else {
                  cellStyle = 'bg-sky-500/15 border-sky-400/40 text-[#0F62FE] dark:text-sky-300';
                }

                const isPeakHr = hr === metrics.peakLoadHour;

                return (
                  <div
                    key={hrLabel}
                    onMouseEnter={() => setHoveredHour(hr)}
                    onMouseLeave={() => setHoveredHour(null)}
                    className={`flex flex-col items-center justify-center border py-1 transition-transform hover:scale-110 cursor-pointer ${cellStyle} ${
                      isPeakHr ? 'ring-2 ring-[#111214] dark:ring-[#F3F4F6] ring-offset-1' : ''
                    }`}
                    title={`${hrLabel} — Load: ${loadW}W | Wind: ${windW}W (${Math.round(
                      ratio * 100
                    )}%)`}
                  >
                    <span className="font-mono-tabular text-[8px] font-bold leading-none">
                      {String(hr).padStart(2, '0')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Profile-Specific Engineering Takeaway Banner */}
        <div className="mt-3 flex items-start gap-2.5 border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/70 dark:bg-[#161A20] px-3.5 py-2.5 text-xs text-[#52565E] dark:text-[#D1D5DB]">
          <Sun className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <strong className="font-bold text-[#111214] dark:text-[#F3F4F6]">
              {activeProfile.name} Engineering Takeaway:
            </strong>{' '}
            {activeProfile.engineeringInsight}
          </div>
        </div>
      </div>
    </section>
  );
};
