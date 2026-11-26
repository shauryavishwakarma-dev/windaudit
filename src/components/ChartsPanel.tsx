import React, { useEffect, useRef, useState } from 'react';
import {
  Chart,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  Filler,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  Tooltip,
  Legend
} from 'chart.js';
import { BarChart3, Activity, Zap } from 'lucide-react';
import { AuditResult } from '../physics';

Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  Filler,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  Tooltip,
  Legend
);

interface ChartsPanelProps {
  audit: AuditResult;
  hubHeightM: number;
  siteName?: string;
  isComparing?: boolean;
  comparisonAudit?: AuditResult | null;
  comparisonSiteName?: string | null;
  theme?: 'dark' | 'light';
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getChartPalette(isDark: boolean) {
  return isDark
    ? {
        windBg: 'rgba(56, 189, 248, 0.85)',
        windBorder: '#38BDF8',
        solarBg: 'rgba(16, 185, 129, 0.72)',
        solarBorder: '#10B981',
        compBg: 'rgba(96, 165, 250, 0.72)',
        compBorder: '#60A5FA',
        powerColor: '#60A5FA',
        powerFill: 'rgba(96, 165, 250, 0.14)',
        rayleighColor: '#F59E0B',
        rayleighFill: 'rgba(245, 158, 11, 0.08)',
        deadZoneBg: 'rgba(239, 68, 68, 0.56)',
        deadZoneBorder: '#EF4444',
        cutOutBg: 'rgba(107, 114, 128, 0.45)',
        activeBg: 'rgba(56, 189, 248, 0.68)',
        activeBorder: '#38BDF8',
        tickColor: '#9CA3AF',
        legendColor: '#E5E7EB',
        titleColor: '#9CA3AF',
        gridColor: '#22252A',
        gridSoft: 'rgba(34, 37, 42, 0.65)',
        tooltipBg: 'rgba(10, 11, 13, 0.96)',
        tooltipTitle: '#F3F4F6',
        tooltipBody: '#D1D5DB',
        tooltipBorder: '#2E333C',
        hoursAxisTitle: '#38BDF8',
        powerAxisTitle: '#60A5FA'
      }
    : {
        windBg: 'rgba(15, 98, 254, 0.84)',
        windBorder: '#0F62FE',
        solarBg: 'rgba(5, 150, 105, 0.78)',
        solarBorder: '#059669',
        compBg: 'rgba(99, 102, 241, 0.75)',
        compBorder: '#4F46E5',
        powerColor: '#0F62FE',
        powerFill: 'rgba(15, 98, 254, 0.12)',
        rayleighColor: '#D97706',
        rayleighFill: 'rgba(217, 119, 6, 0.08)',
        deadZoneBg: 'rgba(220, 38, 38, 0.56)',
        deadZoneBorder: '#DC2626',
        cutOutBg: 'rgba(100, 116, 139, 0.45)',
        activeBg: 'rgba(15, 98, 254, 0.68)',
        activeBorder: '#0F62FE',
        tickColor: '#52565E',
        legendColor: '#111315',
        titleColor: '#52565E',
        gridColor: '#D4D4CE',
        gridSoft: 'rgba(212, 212, 206, 0.65)',
        tooltipBg: 'rgba(244, 244, 240, 0.98)',
        tooltipTitle: '#111315',
        tooltipBody: '#272A2E',
        tooltipBorder: '#B8B8B0',
        hoursAxisTitle: '#0F62FE',
        powerAxisTitle: '#059669'
      };
}

export const ChartsPanel: React.FC<ChartsPanelProps> = ({
  audit,
  hubHeightM,
  siteName = 'Active Site',
  isComparing = false,
  comparisonAudit = null,
  comparisonSiteName = null,
  theme = 'dark'
}) => {
  const isDark = theme === 'dark';
  const monthlyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const monthlyChartRef = useRef<Chart | null>(null);
  const monthlyThemeRef = useRef<boolean>(isDark);
  const monthlyScaleRef = useRef<'linear' | 'log'>('linear');

  const histCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const histChartRef = useRef<Chart | null>(null);

  const [monthlyScaleMode, setMonthlyScaleMode] = useState<'linear' | 'log'>('linear');
  const [distViewMode, setDistViewMode] = useState<'power_curve_rayleigh' | 'empirical_hist'>(
    'power_curve_rayleigh'
  );

  const shortActiveName = siteName.split(' (')[0].split(',')[0];
  const shortCompName = comparisonSiteName
    ? comparisonSiteName.split(' (')[0].split(',')[0]
    : 'Baseline B';
  const showOverlay = Boolean(isComparing && comparisonAudit);

  const windShareRatio =
    audit.annualSolarKwh > 0 ? audit.annualWindKwh / audit.annualSolarKwh : 0;
  const isExtremeWindRatio = audit.annualSolarKwh > 0 && windShareRatio < 0.02;
  const windSharePct = windShareRatio * 100;
  const windShareFormatted =
    windSharePct <= 0 ? '0%' : windSharePct < 0.1 ? '<0.1%' : `${windSharePct.toFixed(1)}%`;

  // 1. Initialize & Sync Monthly Wind vs Same-Budget Solar (+ Optional Comparison Site Overlay)
  useEffect(() => {
    if (!monthlyCanvasRef.current) return;
    const p = getChartPalette(isDark);
    const toPlotVal = (v: number) =>
      monthlyScaleMode === 'log' ? (v > 0 ? Math.max(0.1, v) : null) : v;

    const rawSeriesList: number[][] = [
      audit.monthlyWindKwh,
      ...(showOverlay && comparisonAudit ? [comparisonAudit.monthlyWindKwh] : []),
      audit.monthlySolarKwh
    ];

    const datasets = [
      {
        label: showOverlay ? `${shortActiveName} Wind (kWh)` : 'Wind (kWh)',
        data: audit.monthlyWindKwh.map(toPlotVal),
        backgroundColor: p.windBg,
        borderColor: p.windBorder,
        borderWidth: 1,
        borderRadius: 0
      },
      ...(showOverlay && comparisonAudit
        ? [
            {
              label: `${shortCompName} Wind (kWh)`,
              data: comparisonAudit.monthlyWindKwh.map(toPlotVal),
              backgroundColor: p.compBg,
              borderColor: p.compBorder,
              borderWidth: 1,
              borderRadius: 0
            }
          ]
        : []),
      {
        label: showOverlay
          ? `${shortActiveName} Solar (${audit.solarEquivalentKw.toFixed(1)}kW)`
          : `Rooftop Solar (${audit.solarEquivalentKw.toFixed(1)} kW)`,
        data: audit.monthlySolarKwh.map(toPlotVal),
        backgroundColor: p.solarBg,
        borderColor: p.solarBorder,
        borderWidth: 1,
        borderRadius: 0
      }
    ];

    if (
      monthlyChartRef.current &&
      (monthlyThemeRef.current !== isDark || monthlyScaleRef.current !== monthlyScaleMode)
    ) {
      monthlyChartRef.current.destroy();
      monthlyChartRef.current = null;
    }

    if (!monthlyChartRef.current) {
      monthlyThemeRef.current = isDark;
      monthlyScaleRef.current = monthlyScaleMode;
      monthlyChartRef.current = new Chart(monthlyCanvasRef.current, {
        type: 'bar',
        data: {
          labels: MONTH_LABELS,
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { right: 8 } },
          animation: { duration: 200 },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top',
              align: 'end',
              labels: {
                color: p.legendColor,
                boxWidth: 10,
                boxHeight: 10,
                font: {
                  family: "'JetBrains Mono', monospace",
                  size: 10,
                  weight: 600
                }
              }
            },
            tooltip: {
              backgroundColor: p.tooltipBg,
              titleColor: p.tooltipTitle,
              bodyColor: p.tooltipBody,
              borderColor: p.tooltipBorder,
              borderWidth: 1,
              padding: 10,
              cornerRadius: 0,
              bodyFont: {
                family: "'JetBrains Mono', monospace",
                size: 11
              },
              callbacks: {
                label: (ctx) => {
                  const rawSeries = rawSeriesList[ctx.datasetIndex];
                  const rawValue = rawSeries ? rawSeries[ctx.dataIndex] : ctx.parsed.y;
                  const val = Number(rawValue || 0).toLocaleString('en-IN');
                  return ` ${ctx.dataset.label}: ${val} kWh`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: p.gridSoft },
              ticks: {
                color: p.tickColor,
                font: { family: "'JetBrains Mono', monospace", size: 10 }
              }
            },
            y:
              monthlyScaleMode === 'log'
                ? {
                    type: 'logarithmic',
                    min: 0.1,
                    grid: { color: p.gridColor },
                    ticks: {
                      color: p.tickColor,
                      font: { family: "'JetBrains Mono', monospace", size: 10 },
                      callback: (value) => {
                        const num = Number(value);
                        const exp = Math.log10(num);
                        if (Number.isFinite(exp) && Math.abs(exp - Math.round(exp)) < 1e-6) {
                          return `${num >= 1 ? num.toLocaleString('en-IN') : num} kWh`;
                        }
                        return '';
                      }
                    }
                  }
                : {
                    type: 'linear',
                    beginAtZero: true,
                    grid: { color: p.gridColor },
                    ticks: {
                      color: p.tickColor,
                      font: { family: "'JetBrains Mono', monospace", size: 10 },
                      callback: (value) => `${value} kWh`
                    }
                  }
          }
        }
      });
    } else {
      const chart = monthlyChartRef.current;
      chart.data.datasets = datasets;
      chart.update('none');
    }
  }, [audit, showOverlay, comparisonAudit, shortActiveName, shortCompName, isDark, monthlyScaleMode]);

  // 2. Initialize & Sync Turbine Power Curve & Rayleigh Distribution (0-25 m/s) OR 8,760-Hr Empirical Histogram
  useEffect(() => {
    if (!histCanvasRef.current) return;
    const p = getChartPalette(isDark);

    if (histChartRef.current) {
      histChartRef.current.destroy();
      histChartRef.current = null;
    }

    const histCtx = histCanvasRef.current.getContext('2d');
    if (histCtx) {
      histCtx.clearRect(0, 0, histCanvasRef.current.width, histCanvasRef.current.height);
    }

    if (distViewMode === 'power_curve_rayleigh') {
      const bins = audit.powerCurveBins || [];
      const labels = bins.map((b) => `${b.speedMs}`);
      const powerDataW = bins.map((b) => b.powerW);
      const rayleighHrs = bins.map((b) => b.rayleighHoursYr);
      const empiricalHrs = bins.map((b) => b.empiricalHoursYr);
      const barColors = bins.map((b) =>
        b.speedMs < audit.cutInSpeedMs
          ? p.deadZoneBg
          : b.speedMs >= audit.cutOutSpeedMs
          ? p.cutOutBg
          : p.activeBg
      );

      histChartRef.current = new Chart(histCanvasRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              type: 'line',
              label: 'Power Curve',
              data: powerDataW,
              yAxisID: 'yPower',
              borderColor: p.powerColor,
              backgroundColor: p.powerFill,
              borderWidth: 2,
              pointRadius: 2,
              pointHoverRadius: 4,
              fill: true,
              tension: 0.2,
              order: 1
            },
            {
              type: 'line',
              label: 'Rayleigh (k=2)',
              data: rayleighHrs,
              yAxisID: 'yHours',
              borderColor: p.rayleighColor,
              backgroundColor: p.rayleighFill,
              borderWidth: 2,
              borderDash: [4, 3],
              pointRadius: 0,
              pointHoverRadius: 3,
              fill: false,
              tension: 0.35,
              order: 2
            },
            {
              type: 'bar',
              label: '8,760h Empirical',
              data: empiricalHrs,
              yAxisID: 'yHours',
              backgroundColor: barColors,
              borderRadius: 0,
              order: 3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 4, right: 6, bottom: 2 } },
          animation: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              align: 'center',
              labels: {
                color: p.legendColor,
                boxWidth: 9,
                boxHeight: 9,
                padding: 10,
                font: {
                  family: "'JetBrains Mono', monospace",
                  size: 9.5,
                  weight: 600
                }
              }
            },
            tooltip: {
              backgroundColor: p.tooltipBg,
              titleColor: p.tooltipTitle,
              bodyColor: p.tooltipBody,
              borderColor: p.tooltipBorder,
              borderWidth: 1,
              padding: 10,
              cornerRadius: 0,
              bodyFont: {
                family: "'JetBrains Mono', monospace",
                size: 11
              },
              callbacks: {
                title: (items) => {
                  const idx = items[0]?.dataIndex ?? 0;
                  const b = bins[idx];
                  if (!b) return '';
                  const zone =
                    b.speedMs < audit.cutInSpeedMs
                      ? `Below Cut-In (<${audit.cutInSpeedMs.toFixed(1)} m/s — 0 W)`
                      : b.speedMs >= audit.cutOutSpeedMs
                      ? `Storm Cut-Out (≥${audit.cutOutSpeedMs.toFixed(0)} m/s — 0 W)`
                      : b.speedMs >= audit.ratedWindSpeedMs
                      ? `Rated Plateau (≥${audit.ratedWindSpeedMs.toFixed(1)} m/s)`
                      : 'Cubic v³ Ramp Zone';
                  return `Wind Speed: ${b.speedMs} m/s · ${zone}`;
                },
                afterBody: (items) => {
                  const idx = items[0]?.dataIndex ?? 0;
                  const b = bins[idx];
                  if (!b) return '';
                  return `Rayleigh Bin Yield: ${b.rayleighEnergyKwh.toFixed(2)} kWh/yr (${b.rayleighPdfPct.toFixed(2)}% prob)`;
                }
              }
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Hub Wind Speed v (0 to 25 m/s)',
                color: p.titleColor,
                font: {
                  family: "'JetBrains Mono', monospace",
                  size: 10,
                  weight: 600
                }
              },
              grid: { color: p.gridSoft },
              ticks: {
                color: p.tickColor,
                maxTicksLimit: 13,
                font: { family: "'JetBrains Mono', monospace", size: 10 }
              }
            },
            yHours: {
              type: 'linear',
              position: 'left',
              beginAtZero: true,
              title: {
                display: true,
                text: 'Hours / Year',
                color: p.hoursAxisTitle,
                font: { family: "'JetBrains Mono', monospace", size: 10, weight: 600 }
              },
              grid: { color: p.gridColor },
              ticks: {
                color: p.tickColor,
                maxTicksLimit: 7,
                padding: 6,
                font: { family: "'JetBrains Mono', monospace", size: 10 },
                callback: (value) => `${value}h`
              }
            },
            yPower: {
              type: 'linear',
              position: 'right',
              beginAtZero: true,
              title: {
                display: true,
                text: 'Turbine Power (W)',
                color: p.powerAxisTitle,
                font: { family: "'JetBrains Mono', monospace", size: 10, weight: 600 }
              },
              grid: { drawOnChartArea: false },
              ticks: {
                color: p.tickColor,
                font: { family: "'JetBrains Mono', monospace", size: 10 },
                callback: (value) => `${value}W`
              }
            }
          }
        }
      });
      return;
    }

    const labels = audit.histogramBins.map((b) => b.label.replace(' m/s', ''));
    const dataHours = audit.histogramBins.map((b) => b.hours);
    const bgColors = audit.histogramBins.map((b) =>
      b.isBelowCutIn ? p.deadZoneBg : p.activeBg
    );
    const borderColors = audit.histogramBins.map((b) =>
      b.isBelowCutIn ? p.deadZoneBorder : p.activeBorder
    );

    const histDatasets = [
      {
        label: `${shortActiveName} (hrs/yr)`,
        data: dataHours,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 1,
        borderRadius: 0
      },
      ...(showOverlay && comparisonAudit
        ? [
            {
              label: `${shortCompName} (hrs/yr)`,
              data: comparisonAudit.histogramBins.map((b) => b.hours),
              backgroundColor: p.compBg,
              borderColor: p.compBorder,
              borderWidth: 1,
              borderRadius: 0
            }
          ]
        : [])
    ];

    histChartRef.current = new Chart(histCanvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: histDatasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: showOverlay,
            position: 'top',
            align: 'end',
            labels: {
              color: p.legendColor,
              boxWidth: 10,
              boxHeight: 10,
              font: {
                family: "'JetBrains Mono', monospace",
                size: 10,
                weight: 600
              }
            }
          },
          tooltip: {
            backgroundColor: p.tooltipBg,
            titleColor: p.tooltipTitle,
            bodyColor: p.tooltipBody,
            borderColor: p.tooltipBorder,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 0,
            bodyFont: {
              family: "'JetBrains Mono', monospace",
              size: 11
            },
            callbacks: {
              title: (items) => {
                const idx = items[0]?.dataIndex ?? 0;
                const bin = audit.histogramBins[idx];
                return bin
                  ? `${bin.label} ${
                      bin.isBelowCutIn
                        ? `(Dead Zone < ${audit.cutInSpeedMs.toFixed(1)} m/s — 0 W)`
                        : '(Active Power Zone)'
                    }`
                  : '';
              },
              label: (ctx) => {
                const hrs = Number(ctx.parsed.y || 0).toLocaleString('en-IN');
                const pct = ((Number(ctx.parsed.y || 0) / 8760) * 100).toFixed(1);
                return ` ${ctx.dataset.label}: ${hrs} hrs (${pct}%)`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Hub Wind Speed Bin (m/s)',
              color: p.titleColor,
              font: {
                family: "'JetBrains Mono', monospace",
                size: 10,
                weight: 600
              }
            },
            grid: { color: p.gridSoft },
            ticks: {
              color: p.tickColor,
              font: { family: "'JetBrains Mono', monospace", size: 10 }
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: p.gridColor },
            ticks: {
              color: p.tickColor,
              font: { family: "'JetBrains Mono', monospace", size: 10 },
              callback: (value) => `${value}h`
            }
          }
        }
      }
    });
  }, [audit, distViewMode, showOverlay, comparisonAudit, shortActiveName, shortCompName, isDark]);

  // Responsive resize sync so canvases never clip right edges inside grid columns
  useEffect(() => {
    const nodes = [monthlyCanvasRef.current?.parentElement, histCanvasRef.current?.parentElement].filter(
      (el): el is HTMLElement => Boolean(el)
    );
    if (nodes.length === 0 || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      monthlyChartRef.current?.resize();
      histChartRef.current?.resize();
    });
    nodes.forEach((n) => ro.observe(n));
    return () => ro.disconnect();
  }, []);

  // Clean unmount destruction
  useEffect(() => {
    return () => {
      if (monthlyChartRef.current) {
        monthlyChartRef.current.destroy();
        monthlyChartRef.current = null;
      }
      if (histChartRef.current) {
        histChartRef.current.destroy();
        histChartRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Bento Chart Tile 1: Monthly Wind vs Same-Budget Solar */}
        <div className="print-break-avoid flex min-w-0 flex-col justify-between border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/30 dark:bg-[#101216] p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#16191F] text-[#0F62FE] dark:text-sky-400">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-mono-tabular text-[11px] font-bold uppercase tracking-widest text-[#111315] dark:text-[#F3F4F6]">
                  Monthly Wind vs. Solar Yield (Jan–Dec)
                </h3>
                <p className="text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
                  {showOverlay
                    ? `Overlaying ${shortActiveName} vs. ${shortCompName} monthly kWh yield`
                    : 'Head-to-head monthly energy yield (kWh) for identical CAPEX'}
                </p>
              </div>
            </div>

            <div className="no-print flex flex-wrap items-center gap-2">
              <div
                className="flex items-center border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-0.5 text-[10px] font-mono-tabular uppercase"
                role="group"
                aria-label="Monthly yield y-axis scale toggle"
              >
                <button
                  type="button"
                  onClick={() => setMonthlyScaleMode('linear')}
                  className={`px-2 py-1 transition-all cursor-pointer ${
                    monthlyScaleMode === 'linear'
                      ? 'bg-[#0F62FE] text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 font-bold'
                      : 'text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111315] dark:hover:text-white'
                  }`}
                >
                  Linear
                </button>
                <button
                  type="button"
                  onClick={() => setMonthlyScaleMode('log')}
                  className={`px-2 py-1 transition-all cursor-pointer ${
                    monthlyScaleMode === 'log'
                      ? 'bg-[#0F62FE] text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 font-bold'
                      : 'text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111315] dark:hover:text-white'
                  }`}
                >
                  Log
                </button>
              </div>

              <div className="font-mono-tabular border border-[#059669]/40 dark:border-[#10B981]/40 bg-[#059669]/10 dark:bg-[#10B981]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#059669] dark:text-[#34D399]">
                {audit.annualWindKwh > audit.annualSolarKwh
                  ? `Wind +${(audit.annualWindKwh - audit.annualSolarKwh).toLocaleString('en-IN')} kWh/yr`
                  : `Solar +${Math.max(0, audit.annualSolarKwh - audit.annualWindKwh).toLocaleString('en-IN')} kWh/yr`}
              </div>
            </div>
          </div>

          {isExtremeWindRatio && (
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/80 dark:bg-[#0A0B0D]/80 px-2.5 py-1.5 font-mono-tabular text-[10px]">
              <span className="text-[#52565E] dark:text-[#D1D5DB]">
                Wind yield:{' '}
                <strong className="text-[#0F62FE] dark:text-sky-400">
                  {audit.annualWindKwh.toLocaleString('en-IN')} kWh/yr
                </strong>{' '}
                ({windShareFormatted} of solar){' '}
                {monthlyScaleMode === 'linear'
                  ? '— switch to Log scale to compare'
                  : '— Log scale active'}
              </span>
              {monthlyScaleMode === 'linear' && (
                <button
                  type="button"
                  onClick={() => setMonthlyScaleMode('log')}
                  className="font-bold text-[#0F62FE] dark:text-sky-400 underline cursor-pointer shrink-0"
                >
                  Switch to Log
                </button>
              )}
            </div>
          )}

          <div className="relative h-[240px] w-full min-w-0 overflow-hidden sm:h-[260px]">
            <canvas ref={monthlyCanvasRef} className="block w-full h-full max-w-full" />
          </div>
        </div>

        {/* Bento Chart Tile 2: Turbine Power Curve (W) & Rayleigh Wind Distribution */}
        <div className="print-break-avoid flex min-w-0 flex-col justify-between border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/30 dark:bg-[#101216] p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#16191F] text-[#0F62FE] dark:text-sky-400">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-mono-tabular text-[11px] font-bold uppercase tracking-widest text-[#111315] dark:text-[#F3F4F6]">
                  {distViewMode === 'power_curve_rayleigh'
                    ? `Power Curve & Rayleigh Distribution (${hubHeightM}m)`
                    : `8,760-Hr Wind Speed Histogram (${hubHeightM}m Hub)`}
                </h3>
                <p className="text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
                  {distViewMode === 'power_curve_rayleigh'
                    ? `Cut-in ${audit.cutInSpeedMs.toFixed(1)}m/s · Rated ${audit.ratedWindSpeedMs.toFixed(1)}m/s · Cut-out ${audit.cutOutSpeedMs.toFixed(0)}m/s`
                    : `Cut-in dead zone (<${audit.cutInSpeedMs.toFixed(1)} m/s = 0 W) vs. active generation hours`}
                </p>
              </div>
            </div>

            {/* Segmented Toggle: Power Curve & Rayleigh vs 8,760-Hr Histogram */}
            <div className="no-print flex items-center border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-0.5 text-[10px] font-mono-tabular uppercase">
              <button
                type="button"
                onClick={() => setDistViewMode('power_curve_rayleigh')}
                className={`flex items-center gap-1 px-2.5 py-1 transition-all cursor-pointer ${
                  distViewMode === 'power_curve_rayleigh'
                    ? 'bg-[#0F62FE] text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 font-bold'
                    : 'text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111315] dark:hover:text-white'
                }`}
              >
                <Zap className="h-3 w-3" />
                <span>Power + Rayleigh</span>
              </button>
              <button
                type="button"
                onClick={() => setDistViewMode('empirical_hist')}
                className={`flex items-center gap-1 px-2.5 py-1 transition-all cursor-pointer ${
                  distViewMode === 'empirical_hist'
                    ? 'bg-[#0F62FE] text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 font-bold'
                    : 'text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111315] dark:hover:text-white'
                }`}
              >
                <Activity className="h-3 w-3" />
                <span>8,760h Hist</span>
              </button>
            </div>
          </div>
          <div className="relative h-[240px] w-full min-w-0 overflow-hidden sm:h-[260px]">
            <canvas ref={histCanvasRef} className="block w-full h-full max-w-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
