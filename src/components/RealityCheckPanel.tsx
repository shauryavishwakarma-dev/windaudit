import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Scale,
  Sun,
  Wind,
  Compass,
  AlertOctagon,
  Calculator,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Copy,
  Check,
  FileDown
} from 'lucide-react';
import {
  AuditConfig,
  AuditResult,
  TERRAIN_PROFILES,
  TURBINE_ARCHITECTURES,
  buildShareableAuditSummary,
  formatPaybackPeriod
} from '../physics';

interface RealityCheckPanelProps {
  audit: AuditResult;
  config: AuditConfig;
  siteName: string;
  lat: number;
  lon: number;
  onConfigChange: (updated: Partial<AuditConfig>) => void;
  showMathDrawer: boolean;
  onToggleMathDrawer: () => void;
  onExportPdf?: () => void;
}

const COMPASS_PRESETS: Array<{ label: string; short: string; deg: number; hint: string }> = [
  { label: 'South (180°)', short: 'S 180°', deg: 180, hint: 'Optimal in India (Northern Hemisphere)' },
  { label: 'South-East (135°)', short: 'SE 135°', deg: 135, hint: 'Morning solar peak bias' },
  { label: 'South-West (225°)', short: 'SW 225°', deg: 225, hint: 'Afternoon peak load bias' },
  { label: 'East (90°)', short: 'E 90°', deg: 90, hint: 'East-pitched roof slope' },
  { label: 'West (270°)', short: 'W 270°', deg: 270, hint: 'West-pitched roof slope' },
  { label: 'North (0°)', short: 'N 0°', deg: 0, hint: 'Unfavorable North slope penalty' }
];

export const RealityCheckPanel: React.FC<RealityCheckPanelProps> = ({
  audit,
  config,
  siteName,
  lat,
  lon,
  onConfigChange,
  showMathDrawer,
  onToggleMathDrawer,
  onExportPdf
}) => {
  const [copiedMathSummary, setCopiedMathSummary] = useState(false);

  const terrainProfile = TERRAIN_PROFILES[config.terrain] || TERRAIN_PROFILES.urban;
  const turbineSpec = TURBINE_ARCHITECTURES[audit.turbineType] || TURBINE_ARCHITECTURES.hawt;

  const isOptimalSolar =
    Math.abs(audit.solarTiltDeg - audit.solarOptimalTiltDeg) <= 1 &&
    Math.abs(audit.solarAzimuthDeg - audit.solarOptimalAzimuthDeg) <= 5;

  const windPaybackStr = formatPaybackPeriod(audit.paybackYears, 'short');
  const solarPaybackStr = formatPaybackPeriod(audit.solarPaybackYears, 'short');

  const wind10YrLcoeStr =
    audit.wind10YrLcoeInr !== null && audit.wind10YrLcoeInr < 999
      ? `₹${audit.wind10YrLcoeInr.toFixed(2)}/kWh`
      : 'N/A';
  const solar10YrLcoeStr =
    audit.solar10YrLcoeInr !== null ? `₹${audit.solar10YrLcoeInr.toFixed(2)}/kWh` : 'N/A';

  const windLcoeStr =
    audit.windLcoeInr !== null && audit.windLcoeInr < 999
      ? `₹${audit.windLcoeInr.toFixed(2)}/kWh`
      : 'N/A';
  const solarLcoeStr =
    audit.solarLcoeInr !== null ? `₹${audit.solarLcoeInr.toFixed(2)}/kWh` : 'N/A';

  const windBeatsSolar = audit.annualWindKwh > audit.annualSolarKwh && audit.annualSolarKwh > 0;
  const advantageFactor = windBeatsSolar
    ? audit.annualWindKwh / Math.max(1, audit.annualSolarKwh)
    : audit.solarToWindRatio;
  const advantageLabel = advantageFactor >= 100 ? '100+×' : `${advantageFactor.toFixed(1)}×`;

  const maxComparisonKwh = Math.max(1, audit.annualSolarKwh, audit.annualWindKwh);
  const windBarPct = Math.max(2, Math.min(100, (audit.annualWindKwh / maxComparisonKwh) * 100));
  const solarBarPct = Math.max(4, Math.min(100, (audit.annualSolarKwh / maxComparisonKwh) * 100));

  const sliderPct = (val: number, min: number, max: number) =>
    `${Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100)).toFixed(1)}%`;

  const handleCopyAudit = async () => {
    const text = buildShareableAuditSummary(siteName, lat, lon, config, audit);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMathSummary(true);
      setTimeout(() => setCopiedMathSummary(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopiedMathSummary(true);
        setTimeout(() => setCopiedMathSummary(false), 2500);
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };

  // SVG Tilt geometry coordinates
  const tiltRad = (audit.solarTiltDeg * Math.PI) / 180;
  const panelLen = 36;
  const panelX2 = 10 + panelLen * Math.cos(tiltRad);
  const panelY2 = 42 - panelLen * Math.sin(tiltRad);

  return (
    <section className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/30 dark:bg-[#101216] p-6 sm:p-7">
      {/* Header Bar */}
      <div className="flex flex-col gap-3 border-b border-[#D4D4CE] dark:border-[#22252A] pb-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono-tabular text-[11px] font-bold uppercase tracking-widest text-[#0F62FE] dark:text-sky-400">
            <Scale className="h-3.5 w-3.5 shrink-0" />
            <span>Side-by-Side Comparison · Same ₹{config.budgetInr.toLocaleString('en-IN')} Budget</span>
          </div>
          <h3 className="font-display mt-1 text-lg sm:text-xl font-extrabold tracking-tight text-[#111315] dark:text-[#F3F4F6]">
            Wind vs. Solar Benchmark &amp; Claim Reality Audit
          </h3>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2 shrink-0">
          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              className="flex items-center gap-1.5 border border-[#0F62FE] bg-[#0F62FE] dark:border-sky-400 dark:bg-sky-400 px-3 py-1.5 font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-white dark:text-[#0A0B0D] transition-opacity hover:opacity-90 whitespace-nowrap cursor-pointer"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Export PDF</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyAudit}
            className={`flex items-center gap-1.5 border px-3 py-1.5 font-mono-tabular text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer ${
              copiedMathSummary
                ? 'border-[#059669] bg-[#059669] text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950'
                : 'border-[#D4D4CE] dark:border-[#2E333C] bg-[#F4F4F0] dark:bg-[#0A0B0D] text-[#111315] dark:text-[#F3F4F6] hover:border-[#0F62FE] dark:hover:border-sky-400'
            }`}
          >
            {copiedMathSummary ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedMathSummary ? 'Copied' : 'Copy Summary'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleMathDrawer}
            className={`flex items-center gap-1.5 border px-3 py-1.5 font-mono-tabular text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer ${
              showMathDrawer
                ? 'border-[#111315] bg-[#111315] text-white dark:border-[#F3F4F6] dark:bg-[#F3F4F6] dark:text-[#0A0B0D]'
                : 'border-[#D4D4CE] dark:border-[#2E333C] bg-[#F4F4F0] dark:bg-[#0A0B0D] text-[#0F62FE] dark:text-sky-400 hover:border-[#0F62FE] dark:hover:border-sky-400'
            }`}
          >
            <Calculator className="h-3.5 w-3.5" />
            <span>{showMathDrawer ? 'Hide Formulas' : 'Show Formulas'}</span>
            {showMathDrawer ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* SECTION 1: Solar Panel Tilt Angle & Compass Orientation Optimizer */}
      <div className="no-print mt-5 border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-[#059669] dark:text-[#10B981]" />
              <h4 className="font-mono-tabular text-xs font-bold uppercase tracking-widest text-[#111315] dark:text-[#F3F4F6]">
                Solar Rooftop Angle Optimizer
              </h4>
            </div>
            <p className="mt-1 text-xs text-[#52565E] dark:text-[#9CA3AF]">
              Optimal panel angle for your location:{' '}
              <strong className="font-mono-tabular text-[#059669] dark:text-[#10B981]">
                {audit.solarOptimalTiltDeg}° tilt
              </strong>{' '}
              facing{' '}
              <strong className="font-mono-tabular text-[#059669] dark:text-[#10B981]">South</strong> for maximum
              annual generation.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              onConfigChange({
                solarTiltDeg: audit.solarOptimalTiltDeg,
                solarAzimuthDeg: audit.solarOptimalAzimuthDeg
              })
            }
            disabled={isOptimalSolar}
            className={`flex items-center gap-1.5 self-start border px-3 py-1.5 font-mono-tabular text-[11px] font-bold uppercase tracking-wider transition-colors sm:self-auto ${
              isOptimalSolar
                ? 'border-[#059669]/40 bg-[#059669]/10 text-[#059669] dark:border-[#10B981]/40 dark:bg-[#10B981]/12 dark:text-[#34D399]'
                : 'border-[#0F62FE] bg-[#0F62FE] text-white dark:border-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 cursor-pointer hover:opacity-90'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              {isOptimalSolar
                ? `Optimized · ${lat.toFixed(1)}°N (${audit.solarOptimalTiltDeg}° S)`
                : `Optimize (${audit.solarOptimalTiltDeg}° · 180° S)`}
            </span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left 5 cols: Panel Tilt Angle (0° to 60°) */}
          <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/40 dark:bg-[#101216] p-3.5 lg:col-span-5">
            <div className="mb-2 flex items-center justify-between text-xs">
              <label htmlFor="solar-tilt-slider" className="font-semibold text-[#111315] dark:text-[#F3F4F6]">
                Panel Tilt Angle (&beta;)
              </label>
              <span className="font-mono-tabular font-bold text-[#0F62FE] dark:text-sky-400">
                {audit.solarTiltDeg}°{' '}
                <span className="text-[10px] font-normal text-[#52565E] dark:text-[#9CA3AF]">
                  (Opt: {audit.solarOptimalTiltDeg}°)
                </span>
              </span>
            </div>
            <input
              id="solar-tilt-slider"
              type="range"
              min={0}
              max={60}
              step={1}
              value={audit.solarTiltDeg}
              style={{ '--slider-pct': sliderPct(audit.solarTiltDeg, 0, 60) } as React.CSSProperties}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) {
                  onConfigChange({ solarTiltDeg: Math.max(0, Math.min(60, Math.round(v))) });
                }
              }}
              className="aero-slider w-full"
            />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {[
                { label: '0° Flat', val: 0 },
                { label: '15° Low', val: 15 },
                { label: `${audit.solarOptimalTiltDeg}° Lat Opt`, val: audit.solarOptimalTiltDeg },
                { label: '35° Winter', val: 35 },
                { label: '45° Steep', val: 45 }
              ].map((preset) => {
                const active = audit.solarTiltDeg === preset.val;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onConfigChange({ solarTiltDeg: preset.val })}
                    className={`font-mono-tabular border px-2.5 py-1.5 sm:py-1 min-h-[34px] sm:min-h-0 text-[10px] font-bold transition-colors cursor-pointer ${
                      active
                        ? 'border-[#0F62FE] bg-[#0F62FE] text-white dark:border-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950'
                        : 'border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] text-[#52565E] dark:text-[#9CA3AF] hover:border-[#0F62FE] dark:hover:border-sky-400'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center 4 cols: Compass Orientation / Azimuth (0° to 360°) */}
          <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/40 dark:bg-[#101216] p-3.5 lg:col-span-4">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <label
                htmlFor="solar-azimuth-slider"
                className="flex items-center gap-1.5 font-semibold text-[#111315] dark:text-[#F3F4F6] whitespace-nowrap"
              >
                <Compass className="h-3.5 w-3.5 text-[#0F62FE] dark:text-sky-400 shrink-0" />
                <span>Azimuth (&gamma;)</span>
              </label>
              <span className="font-mono-tabular font-bold text-[#0F62FE] dark:text-sky-400 whitespace-nowrap">
                {audit.solarAzimuthDeg}° ({audit.solarCompassDirection})
              </span>
            </div>
            <input
              id="solar-azimuth-slider"
              type="range"
              min={0}
              max={355}
              step={5}
              value={audit.solarAzimuthDeg}
              style={{ '--slider-pct': sliderPct(audit.solarAzimuthDeg, 0, 355) } as React.CSSProperties}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) {
                  onConfigChange({ solarAzimuthDeg: ((Math.round(v) % 360) + 360) % 360 });
                }
              }}
              className="aero-slider w-full"
            />
            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              {COMPASS_PRESETS.map((cp) => {
                const active = Math.abs(audit.solarAzimuthDeg - cp.deg) <= 5;
                return (
                  <button
                    key={cp.short}
                    type="button"
                    onClick={() => onConfigChange({ solarAzimuthDeg: cp.deg })}
                    title={cp.hint}
                    className={`font-mono-tabular border px-1.5 py-1.5 sm:py-1 min-h-[34px] sm:min-h-0 text-[10px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'border-[#0F62FE] bg-[#0F62FE] text-white dark:border-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950'
                        : 'border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] text-[#52565E] dark:text-[#9CA3AF] hover:border-[#0F62FE] dark:hover:border-sky-400'
                    }`}
                  >
                    {cp.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right 3 cols: Visual SVG Tilt & Compass Rose + POA Gain Readout */}
          <div className="flex flex-col justify-between border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/40 dark:bg-[#101216] p-3.5 lg:col-span-3 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 shrink-0">
                <svg viewBox="0 0 60 50" className="h-10 w-12 shrink-0">
                  <line x1="6" y1="42" x2="54" y2="42" stroke="#6B7280" strokeWidth="1.5" strokeDasharray="2 2" />
                  <line x1={panelX2 - 4} y1={panelY2 + 2} x2={panelX2 - 4} y2="42" stroke="#6B7280" strokeWidth="1.5" />
                  <line
                    x1="10"
                    y1="42"
                    x2={panelX2}
                    y2={panelY2}
                    stroke="#10B981"
                    strokeWidth="3.5"
                    strokeLinecap="square"
                  />
                  <text
                    x="12"
                    y="13"
                    fill="currentColor"
                    className="font-mono text-[9px] font-bold text-[#059669] dark:text-[#34D399]"
                  >
                    β={audit.solarTiltDeg}°
                  </text>
                </svg>

                <svg viewBox="0 0 52 52" className="h-10 w-10 shrink-0">
                  <circle cx="26" cy="26" r="22" fill="rgba(16, 185, 129, 0.08)" stroke="#10B981" strokeWidth="1.2" />
                  <text x="26" y="10" textAnchor="middle" fill="#6B7280" className="font-mono text-[7px] font-bold">
                    N
                  </text>
                  <text x="44" y="28" textAnchor="middle" fill="#6B7280" className="font-mono text-[7px] font-bold">
                    E
                  </text>
                  <text x="26" y="46" textAnchor="middle" fill="#10B981" className="font-mono text-[7px] font-extrabold">
                    S
                  </text>
                  <text x="8" y="28" textAnchor="middle" fill="#6B7280" className="font-mono text-[7px] font-bold">
                    W
                  </text>
                  <g transform={`rotate(${audit.solarAzimuthDeg} 26 26)`}>
                    <line x1="26" y1="26" x2="26" y2="11" stroke="#10B981" strokeWidth="2.2" />
                    <circle cx="26" cy="11" r="2.2" fill="#10B981" />
                  </g>
                  <circle cx="26" cy="26" r="2" fill="#9CA3AF" />
                </svg>
              </div>

              <div className="min-w-0 text-right ml-auto">
                <div className="font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-[#52565E] dark:text-[#9CA3AF]">
                  POA vs Flat 0°
                </div>
                <div
                  className={`font-mono-tabular text-base font-bold ${
                    audit.solarTiltGainPct >= 0
                      ? 'text-[#059669] dark:text-[#34D399]'
                      : 'text-[#DC2626] dark:text-[#F87171]'
                  }`}
                >
                  {audit.solarTiltGainPct >= 0 ? '+' : ''}
                  {audit.solarTiltGainPct.toFixed(1)}%
                </div>
                <div className="font-mono-tabular text-[10px] text-[#52565E] dark:text-[#9CA3AF] whitespace-nowrap">
                  {audit.avgSolarPoaKwhM2Day.toFixed(2)} kWh/m²/d
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1 border-t border-[#D4D4CE] dark:border-[#22252A] pt-2 font-mono-tabular text-[10px] text-[#52565E] dark:text-[#9CA3AF]">
              <span>Flat 0°: {audit.flatHorizontalSolarKwh.toLocaleString('en-IN')} kWh</span>
              <strong className="text-[#059669] dark:text-[#34D399]">
                POA: {audit.annualSolarKwh.toLocaleString('en-IN')} kWh
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Full-Width Same-Budget Reality Check (Wind vs Solar) + Full-Width Horizontal Marketing Claim vs Physics */}
      <div className="mt-5 grid grid-cols-1 gap-5">
        {/* Top Full-Width: Same-Budget Head-to-Head Comparison Table */}
        <div className="col-span-full border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4D4CE] dark:border-[#22252A] pb-3">
            <span className="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-[#111315] dark:text-[#F3F4F6]">
              Same-Budget Head-to-Head (₹{config.budgetInr.toLocaleString('en-IN')} Capital Spend)
            </span>
            <span
              className={`font-mono-tabular border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${
                windBeatsSolar
                  ? 'border-[#0F62FE]/40 dark:border-sky-400/40 bg-[#0F62FE]/10 dark:bg-sky-500/10 text-[#0F62FE] dark:text-sky-400'
                  : 'border-[#059669]/40 dark:border-[#10B981]/40 bg-[#059669]/10 dark:bg-[#10B981]/10 text-[#059669] dark:text-[#34D399]'
              }`}
            >
              {windBeatsSolar ? 'Wind Advantage' : 'Solar Advantage'}: {advantageLabel} kWh/₹
            </span>
          </div>

          {/* Visual Energy Yield Bar Comparison */}
          <div className="mt-4 space-y-3.5">
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-[#111315] dark:text-[#F3F4F6]">
                  <Wind className="h-3.5 w-3.5 text-[#0F62FE] dark:text-[#38BDF8]" />
                  <span>
                    Micro-Wind ({config.ratedPowerW}W {turbineSpec.shortLabel} @ {config.hubHeightM}m)
                  </span>
                </span>
                <span className="font-mono-tabular font-bold text-[#0F62FE] dark:text-[#38BDF8] whitespace-nowrap">
                  {audit.annualWindKwh.toLocaleString('en-IN')} kWh/yr ({audit.capacityFactorPct.toFixed(1)}% CF)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden bg-[#D4D4CE] dark:bg-[#22252A]">
                <div
                  className="h-full bg-[#0F62FE] dark:bg-[#0EA5E9] transition-all duration-300"
                  style={{ width: `${windBarPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-[#111315] dark:text-[#F3F4F6]">
                  <Sun className="h-3.5 w-3.5 text-[#059669] dark:text-[#10B981]" />
                  <span>
                    Rooftop Solar ({audit.solarEquivalentKw.toFixed(2)} kWp @ {audit.solarTiltDeg}°{' '}
                    {audit.solarCompassDirection})
                  </span>
                </span>
                <span className="font-mono-tabular font-bold text-[#059669] dark:text-[#34D399] whitespace-nowrap">
                  {audit.annualSolarKwh.toLocaleString('en-IN')} kWh/yr ({audit.effectiveSolarPrPct}% PR)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden bg-[#D4D4CE] dark:bg-[#22252A]">
                <div
                  className="h-full bg-[#059669] dark:bg-[#10B981] transition-all duration-300"
                  style={{ width: `${solarBarPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* 7-Metric Engineering & Financial Comparison Table */}
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#D4D4CE] dark:border-[#22252A] font-mono-tabular text-[10px] font-bold uppercase tracking-widest text-[#52565E] dark:text-[#9CA3AF]">
                  <th className="pb-2.5 pr-4 whitespace-nowrap">Metric (Same ₹{config.budgetInr.toLocaleString('en-IN')})</th>
                  <th className="pb-2.5 px-3 text-right text-[#0F62FE] dark:text-[#38BDF8] whitespace-nowrap">Micro-Wind</th>
                  <th className="pb-2.5 pl-3 text-right text-[#059669] dark:text-[#34D399] whitespace-nowrap">Rooftop Solar PV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4D4CE]/70 dark:divide-[#22252A] font-mono-tabular">
                <tr>
                  <td className="py-2.5 pr-4 font-sans font-semibold text-[#111315] dark:text-[#D1D5DB]">
                    Annual Energy Yield (8,760h / Rayleigh)
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-[#111315] dark:text-[#F3F4F6] whitespace-nowrap">
                    <div>{audit.annualWindKwh.toLocaleString('en-IN')} kWh/yr</div>
                    <div className="text-[10px] font-normal text-[#52565E] dark:text-[#9CA3AF] whitespace-nowrap">
                      Rayleigh: {audit.rayleighAnnualWindKwh.toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td className="py-2.5 pl-3 text-right font-bold text-[#059669] dark:text-[#34D399] whitespace-nowrap">
                    {audit.annualSolarKwh.toLocaleString('en-IN')} kWh/yr
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-sans font-semibold text-[#111315] dark:text-[#D1D5DB]">
                    Capacity Factor (%)
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-[#111315] dark:text-[#F3F4F6] whitespace-nowrap">
                    {audit.capacityFactorPct.toFixed(1)}%
                  </td>
                  <td className="py-2.5 pl-3 text-right font-bold text-[#059669] dark:text-[#34D399] whitespace-nowrap">
                    <div>{audit.solarCapacityFactorPct.toFixed(1)}%</div>
                    <div className="text-[10px] font-normal text-[#52565E] dark:text-[#9CA3AF] whitespace-nowrap">
                      {audit.effectiveSolarPrPct}% PR
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-sans font-semibold text-[#111315] dark:text-[#D1D5DB]">
                    Upfront CapEx (Installed Budget)
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-[#111315] dark:text-[#F3F4F6] whitespace-nowrap">
                    ₹{config.budgetInr.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 pl-3 text-right font-bold text-[#111315] dark:text-[#F3F4F6] whitespace-nowrap">
                    ₹{config.budgetInr.toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-sans font-semibold text-[#111315] dark:text-[#D1D5DB]">
                    Estimated Maintenance (Annual O&amp;M)
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-[#DC2626] dark:text-[#F87171] whitespace-nowrap">
                    ₹{audit.windAnnualOmInr.toLocaleString('en-IN')}/yr{' '}
                    <span className="text-[10px] font-normal text-[#52565E] dark:text-[#9CA3AF]">(1.5%)</span>
                  </td>
                  <td className="py-2.5 pl-3 text-right font-bold text-[#059669] dark:text-[#34D399] whitespace-nowrap">
                    ₹{audit.solarAnnualOmInr.toLocaleString('en-IN')}/yr{' '}
                    <span className="text-[10px] font-normal text-[#52565E] dark:text-[#9CA3AF]">(0.5%)</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-sans font-semibold text-[#111315] dark:text-[#D1D5DB]">
                    Simple Payback Period
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                      audit.paybackYears !== null && audit.paybackYears <= 15
                        ? 'text-[#059669] dark:text-[#34D399]'
                        : 'text-[#DC2626] dark:text-[#F87171]'
                    }`}
                  >
                    {windPaybackStr}
                  </td>
                  <td className="py-2.5 pl-3 text-right font-bold text-[#059669] dark:text-[#34D399] whitespace-nowrap">
                    {solarPaybackStr}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-sans font-semibold text-[#111315] dark:text-[#D1D5DB]">
                    10-Year LCOE (Levelized Cost)
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                      audit.wind10YrLcoeInr !== null && audit.wind10YrLcoeInr <= config.tariffInr
                        ? 'text-[#059669] dark:text-[#34D399]'
                        : 'text-[#DC2626] dark:text-[#F87171]'
                    }`}
                  >
                    {wind10YrLcoeStr}
                  </td>
                  <td className="py-2.5 pl-3 text-right font-bold text-[#059669] dark:text-[#34D399] whitespace-nowrap">
                    {solar10YrLcoeStr}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-sans font-semibold text-[#111315] dark:text-[#D1D5DB]">
                    20-Year LCOE &amp; Year-1 Savings
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-[#111315] dark:text-[#F3F4F6] whitespace-nowrap">
                    {windLcoeStr} · ₹{audit.annualSavingsInr.toLocaleString('en-IN')}/yr
                  </td>
                  <td className="py-2.5 pl-3 text-right font-bold text-[#059669] dark:text-[#34D399] whitespace-nowrap">
                    {solarLcoeStr} · ₹{audit.solarAnnualSavingsInr.toLocaleString('en-IN')}/yr
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Full-Width: Marketing Claim vs. Physics Reality (3 Horizontal Columns on Desktop) */}
        <div className="col-span-full flex flex-col justify-between border border-[#DC2626]/40 dark:border-[#EF4444]/40 bg-[#DC2626]/5 dark:bg-[#140E10] p-5 sm:p-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DC2626]/25 dark:border-[#EF4444]/25 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#111315] dark:text-[#F3F4F6]">
                <AlertOctagon className="h-4 w-4 text-[#DC2626] dark:text-[#F87171] shrink-0" />
                <span className="font-mono-tabular uppercase tracking-wider">
                  Marketing Claim vs. Physics
                </span>
              </div>
              <span className="font-mono-tabular border border-[#DC2626]/40 dark:border-[#EF4444]/40 bg-[#DC2626]/10 dark:bg-[#EF4444]/15 px-2 py-0.5 text-[10px] font-bold text-[#DC2626] dark:text-[#FCA5A5] shrink-0 whitespace-nowrap">
                {audit.marketingRealityRatio}× Hype Gap
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="border border-[#D4D4CE] dark:border-[#2A1C1F] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-3.5 flex flex-col justify-between">
                <div className="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-[#52565E] dark:text-[#9CA3AF]">
                  1. Rated Output &amp; Annual Yield ({config.ratedPowerW}W Sticker)
                </div>
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-[#52565E] dark:text-[#9CA3AF]">Seller Brochure Claim:</span>
                    <span className="font-mono-tabular font-bold text-[#52565E] dark:text-[#9CA3AF] line-through whitespace-nowrap">
                      ~{audit.marketingClaimWindKwh.toLocaleString('en-IN')} kWh/yr
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="font-semibold text-[#111315] dark:text-[#F3F4F6]">
                      8,760-Hr Reality:
                    </span>
                    <span className="font-mono-tabular font-bold text-[#DC2626] dark:text-[#F87171] whitespace-nowrap">
                      {audit.annualWindKwh.toLocaleString('en-IN')} kWh/yr ({audit.hoursAtRatedCap}h @ rated)
                    </span>
                  </div>
                </div>
              </div>

              <div className="border border-[#D4D4CE] dark:border-[#2A1C1F] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-3.5 flex flex-col justify-between">
                <div className="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-[#52565E] dark:text-[#9CA3AF]">
                  2. Cut-In Dead Zone &amp; Cogging Torque
                </div>
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-[#52565E] dark:text-[#9CA3AF]">Brochure Claim:</span>
                    <span className="font-mono-tabular font-semibold text-[#52565E] dark:text-[#9CA3AF] whitespace-nowrap">
                      &ldquo;Spins in 1.5 m/s&rdquo;
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="font-semibold text-[#111315] dark:text-[#F3F4F6]">
                      Zero-Watt (&lt;{audit.cutInSpeedMs.toFixed(1)} m/s):
                    </span>
                    <span className="font-mono-tabular font-bold text-[#DC2626] dark:text-[#F87171] whitespace-nowrap">
                      {audit.hoursBelowCutIn.toLocaleString('en-IN')} hrs/yr ({audit.pctBelowCutIn.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="border border-[#D4D4CE] dark:border-[#2A1C1F] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-3.5 flex flex-col justify-between">
                <div className="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-[#52565E] dark:text-[#9CA3AF]">
                  3. Lab Wind Tunnel vs. Real Roof Speed
                </div>
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-[#52565E] dark:text-[#9CA3AF]">Brochure Test Wind:</span>
                    <span className="font-mono-tabular font-semibold text-[#52565E] dark:text-[#9CA3AF] whitespace-nowrap">
                      {audit.ratedWindSpeedMs.toFixed(1)} m/s (Gale)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="font-semibold text-[#111315] dark:text-[#F3F4F6]">
                      Rooftop Average:
                    </span>
                    <span className="font-mono-tabular font-bold text-[#DC2626] dark:text-[#F87171] whitespace-nowrap">
                      {audit.avgWindSpeedMs.toFixed(2)} m/s
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-4 border-t border-[#DC2626]/20 dark:border-[#EF4444]/20 pt-3 text-xs leading-relaxed text-[#52565E] dark:text-[#D1D5DB]">
            {audit.pctBelowCutIn < 35 ? (
              <>
                This high-wind corridor achieves active generation across{' '}
                <strong className="font-mono-tabular text-[#111315] dark:text-[#F3F4F6]">
                  {(100 - audit.pctBelowCutIn).toFixed(1)}% of the year
                </strong>{' '}
                at mean hub speed{' '}
                <strong className="font-mono-tabular text-[#111315] dark:text-[#F3F4F6]">
                  {audit.avgWindSpeedMs.toFixed(2)} m/s
                </strong>
                , though brochure figures still assume sustained gale-force laboratory airflow.
              </>
            ) : (
              <>
                Micro-turbines require strong winds to reach nameplate output. At typical rooftop speeds of{' '}
                <strong className="font-mono-tabular text-[#111315] dark:text-[#F3F4F6]">
                  {audit.avgWindSpeedMs.toFixed(2)} m/s
                </strong>
                , wind carries dramatically less cubic kinetic energy (P &prop; v&sup3;), leaving the rotor below
                cut-in torque for most of the year.
              </>
            )}
          </p>
        </div>
      </div>

      {/* SECTION 3: Collapsible "Show the Math" Technical Breakdown Drawer */}
      <AnimatePresence initial={false}>
        {showMathDrawer && (
          <motion.div
            key="show-the-math-drawer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="overflow-hidden"
          >
            <div className="mt-5 border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-5 text-[#111315] dark:text-[#F3F4F6]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4D4CE] dark:border-[#22252A] pb-3">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-[#0F62FE] dark:text-sky-400" />
                  <h4 className="font-mono-tabular text-xs font-bold uppercase tracking-widest text-[#0F62FE] dark:text-sky-400">
                    Engineering Verification Ledger — Inputs, Constants &amp; Equations
                  </h4>
                </div>
                <span className="font-mono-tabular text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
                  8,760-Hr Time-Series Integration (Not Cubed Averages)
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {/* Math Card 1 */}
                <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/40 dark:bg-[#101216] p-3.5">
                  <div className="font-mono-tabular text-xs font-bold text-[#0F62FE] dark:text-sky-400">
                    1. Barometric &amp; Thermal Air Density &rho;(z, T)
                  </div>
                  <div className="font-mono-tabular mt-2 border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-2.5 text-[11px]">
                    P(z) = 101325 · (1 - 0.0065·z / 288.15)^5.2559
                    <br />
                    &rho;(t) = P(z) / (287.058 · (T_amb(t) + 273.15))
                  </div>
                  <ul className="font-mono-tabular mt-2.5 space-y-1 text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
                    <li>Site Elevation: {audit.siteElevationM} m + Hub {config.hubHeightM} m</li>
                    <li>Mean Ambient Temp: {audit.avgAmbientTempC.toFixed(1)} °C</li>
                    <li>
                      Computed Mean &rho;:{' '}
                      <strong className="text-[#111315] dark:text-[#F3F4F6]">
                        {audit.avgAirDensityKgM3.toFixed(3)} kg/m³
                      </strong>{' '}
                      ({(audit.airDensityRatioVsStd * 100).toFixed(1)}% of 1.225 ISA)
                    </li>
                  </ul>
                </div>

                {/* Math Card 2 */}
                <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/40 dark:bg-[#101216] p-3.5">
                  <div className="font-mono-tabular text-xs font-bold text-[#0F62FE] dark:text-sky-400">
                    2. Meso-Micro Boundary-Layer Wind Shear
                  </div>
                  <div className="font-mono-tabular mt-2 border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-2.5 text-[11px]">
                    {audit.shearModel === 'logarithmic'
                      ? `v_hub(t) = v_10(t) · [ln(60/0.03)/ln(10/0.03)] · [ln(h/z₀)/ln(60/z₀)] · η_turb`
                      : `v_hub(t) = v_10(t) · (60/10)^0.14 · (h/60)^α · η_turb`}
                  </div>
                  <ul className="font-mono-tabular mt-2.5 space-y-1 text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
                    <li>
                      Terrain: {terrainProfile.label.split(' (')[0]} (&alpha;={audit.alpha.toFixed(2)}, z₀={audit.z0}m,
                      &eta;_turb={audit.turbulenceFactor.toFixed(2)})
                    </li>
                    <li>
                      10m Open API Wind: {audit.avgWindSpeed10mMs.toFixed(2)} m/s &times;{' '}
                      <strong className="text-[#111315] dark:text-[#F3F4F6]">
                        {audit.shearMultiplier.toFixed(3)}x
                      </strong>{' '}
                      ={' '}
                      <strong className="text-[#0F62FE] dark:text-sky-400">
                        {audit.avgWindSpeedMs.toFixed(2)} m/s
                      </strong>
                    </li>
                    <li>
                      Weibull k={audit.weibullShapeK.toFixed(2)}, c={audit.weibullScaleCMs.toFixed(2)} m/s · EPF=
                      {audit.energyPatternFactor.toFixed(2)}x
                    </li>
                  </ul>
                </div>

                {/* Math Card 3 */}
                <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/40 dark:bg-[#101216] p-3.5">
                  <div className="font-mono-tabular text-xs font-bold text-[#0F62FE] dark:text-sky-400">
                    3. Cubic Power Curve &amp; Drivetrain Chain
                  </div>
                  <div className="font-mono-tabular mt-2 border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-2.5 text-[11px]">
                    P(t) = min(P_rated, 0.5 · &rho;(t) · A · v_hub(t)³ · Cp·&eta;)
                    <br />
                    for {audit.cutInSpeedMs.toFixed(1)} &le; v_hub(t) &lt; {audit.cutOutSpeedMs.toFixed(1)} m/s (else 0 W)
                  </div>
                  <ul className="font-mono-tabular mt-2.5 space-y-1 text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
                    <li>
                      Swept Area A = &pi;·({(config.rotorDiameterM / 2).toFixed(2)}m)² ={' '}
                      <strong className="text-[#111315] dark:text-[#F3F4F6]">
                        {audit.sweptAreaM2.toFixed(2)} m²
                      </strong>
                    </li>
                    <li>
                      Efficiency: Cp {(turbineSpec.rotorCp * 100).toFixed(0)}% &times; PMG{' '}
                      {(turbineSpec.generatorEta * 100).toFixed(0)}% &times; Inv{' '}
                      {(turbineSpec.inverterEta * 100).toFixed(0)}% &times; Wire{' '}
                      {(turbineSpec.wiringEta * 100).toFixed(0)}% ={' '}
                      <strong className="text-[#0F62FE] dark:text-sky-400">
                        {(audit.combinedCpEta * 100).toFixed(1)}%
                      </strong>
                    </li>
                    <li>
                      Annual Sum:{' '}
                      <strong className="text-[#111315] dark:text-[#F3F4F6]">
                        {audit.annualWindKwh.toLocaleString('en-IN')} kWh/yr
                      </strong>{' '}
                      ({audit.hoursGenerating.toLocaleString('en-IN')} active hrs)
                    </li>
                  </ul>
                </div>

                {/* Math Card 4 */}
                <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/40 dark:bg-[#101216] p-3.5">
                  <div className="font-mono-tabular text-xs font-bold text-[#059669] dark:text-[#34D399]">
                    4. Solar Plane-of-Array (POA) &amp; Thermal Derate
                  </div>
                  <div className="font-mono-tabular mt-2 border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-2.5 text-[11px]">
                    G_POA(t) = GHI(t) · [(1-f_d)·R_b(&phi;,&delta;,&omega;,&beta;,&gamma;) + f_d·(1+cos&beta;)/2 + 0.2·(1-cos&beta;)/2]
                  </div>
                  <ul className="font-mono-tabular mt-2.5 space-y-1 text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
                    <li>
                      Same-Budget Array: ₹{config.budgetInr.toLocaleString('en-IN')} / ₹60k ={' '}
                      <strong className="text-[#111315] dark:text-[#F3F4F6]">
                        {audit.solarEquivalentKw.toFixed(2)} kWp
                      </strong>
                    </li>
                    <li>
                      Orientation: &beta;={audit.solarTiltDeg}° tilt, &gamma;={audit.solarAzimuthDeg}° (
                      {audit.solarCompassDirection}) &rarr; {audit.avgSolarPoaKwhM2Day.toFixed(2)} kWh/m²/d (
                      {audit.solarTiltGainPct >= 0 ? '+' : ''}
                      {audit.solarTiltGainPct.toFixed(1)}% vs flat)
                    </li>
                    <li>
                      Net PR (BOS 85.8% &times; NOCT -0.38%/°C):{' '}
                      <strong className="text-[#059669] dark:text-[#34D399]">{audit.effectiveSolarPrPct}%</strong>{' '}
                      &rarr;{' '}
                      <strong className="text-[#111315] dark:text-[#F3F4F6]">
                        {audit.annualSolarKwh.toLocaleString('en-IN')} kWh/yr
                      </strong>
                    </li>
                  </ul>
                </div>

                {/* Math Card 5 */}
                <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/40 dark:bg-[#101216] p-3.5 md:col-span-2">
                  <div className="font-mono-tabular text-xs font-bold text-[#059669] dark:text-[#34D399]">
                    5. Rayleigh Wind Distribution (Weibull k=2, 0–25 m/s) &amp; 10-Yr / 20-Yr LCOE Equations
                  </div>
                  <div className="font-mono-tabular mt-2 border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-2.5 text-[11px]">
                    f_Rayleigh(v) = (&pi;/2)·(v / v̄_hub²)·exp[-(&pi;/4)·(v / v̄_hub)²] &nbsp;|&nbsp; E_Rayleigh = 8760 · &Sigma; P(v_i)·[F(v_i+0.5) - F(v_i-0.5)]
                    <br />
                    10-Yr LCOE (₹/kWh) = [CapEx + 10 · O&amp;M_annual] / [10 · E_annual_kWh] &nbsp;|&nbsp; Payback (yrs) = CapEx / (E_annual_kWh · Tariff)
                  </div>
                  <div className="font-mono-tabular mt-2.5 grid grid-cols-1 gap-2 text-[11px] text-[#52565E] dark:text-[#9CA3AF] sm:grid-cols-2">
                    <div>
                      <span className="text-[#0F62FE] dark:text-sky-400 font-bold">
                        Micro-Wind (1.5%/yr O&amp;M = ₹{audit.windAnnualOmInr.toLocaleString('en-IN')}/yr):
                      </span>
                      <br />
                      Rayleigh Yield:{' '}
                      <strong className="text-[#111315] dark:text-[#F3F4F6]">
                        {audit.rayleighAnnualWindKwh.toLocaleString('en-IN')} kWh/yr
                      </strong>{' '}
                      · 8,760h Yield:{' '}
                      <strong className="text-[#111315] dark:text-[#F3F4F6]">
                        {audit.annualWindKwh.toLocaleString('en-IN')} kWh/yr
                      </strong>
                      <br />
                      10-Yr LCOE: <strong className="text-[#111315] dark:text-[#F3F4F6]">{wind10YrLcoeStr}</strong> ·
                      20-Yr LCOE: <strong className="text-[#111315] dark:text-[#F3F4F6]">{windLcoeStr}</strong>
                    </div>
                    <div>
                      <span className="text-[#059669] dark:text-[#34D399] font-bold">
                        Rooftop Solar (0.5%/yr O&amp;M = ₹{audit.solarAnnualOmInr.toLocaleString('en-IN')}/yr):
                      </span>
                      <br />
                      Capacity Factor:{' '}
                      <strong className="text-[#111315] dark:text-[#F3F4F6]">
                        {audit.solarCapacityFactorPct.toFixed(1)}%
                      </strong>{' '}
                      · Annual Yield:{' '}
                      <strong className="text-[#111315] dark:text-[#F3F4F6]">
                        {audit.annualSolarKwh.toLocaleString('en-IN')} kWh/yr
                      </strong>
                      <br />
                      10-Yr LCOE: <strong className="text-[#111315] dark:text-[#F3F4F6]">{solar10YrLcoeStr}</strong> ·
                      20-Yr LCOE: <strong className="text-[#111315] dark:text-[#F3F4F6]">{solarLcoeStr}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
