import React from 'react';
import { motion } from 'motion/react';
import {
  GitCompare,
  ArrowLeftRight,
  BookmarkCheck,
  X,
  Wind,
  Zap,
  Clock,
  Sun,
  Compass
} from 'lucide-react';
import { AuditConfig, AuditResult, formatPaybackPeriod } from '../physics';
import { PRESET_LIST, SitePreset } from '../api';

export interface SavedSiteInfo {
  siteName: string;
  lat: number;
  lon: number;
  savedAt: string;
}

interface LocationComparisonPanelProps {
  activeSiteName: string;
  activeLat: number;
  activeLon: number;
  activeAudit: AuditResult;
  savedSite: SavedSiteInfo;
  comparisonAudit: AuditResult;
  config: AuditConfig;
  onSaveCurrentAsBaseline: () => void;
  onSwapLocations: () => void;
  onQuickLoadComparisonPreset: (preset: SitePreset) => void;
  onCloseComparison: () => void;
}

export const LocationComparisonPanel: React.FC<LocationComparisonPanelProps> = ({
  activeSiteName,
  activeLat,
  activeLon,
  activeAudit,
  savedSite,
  comparisonAudit,
  config,
  onSaveCurrentAsBaseline,
  onSwapLocations,
  onQuickLoadComparisonPreset,
  onCloseComparison
}) => {
  const windSpeedDelta = activeAudit.avgWindSpeedMs - comparisonAudit.avgWindSpeedMs;
  const windKwhDelta = activeAudit.annualWindKwh - comparisonAudit.annualWindKwh;
  const cfDelta = activeAudit.capacityFactorPct - comparisonAudit.capacityFactorPct;
  const deadZoneDelta = activeAudit.pctBelowCutIn - comparisonAudit.pctBelowCutIn;
  const solarKwhDelta = activeAudit.annualSolarKwh - comparisonAudit.annualSolarKwh;

  const activeRoiPct =
    config.budgetInr > 0 ? (activeAudit.annualSavingsInr / config.budgetInr) * 100 : 0;
  const compRoiPct =
    config.budgetInr > 0 ? (comparisonAudit.annualSavingsInr / config.budgetInr) * 100 : 0;
  const roiDelta = activeRoiPct - compRoiPct;

  // Max scaling values for overlaid dual progress bars
  const maxWindSpeed = Math.max(8, activeAudit.avgWindSpeedMs, comparisonAudit.avgWindSpeedMs);
  const maxWindKwh = Math.max(
    1000,
    activeAudit.annualWindKwh,
    comparisonAudit.annualWindKwh
  );
  const maxSolarKwh = Math.max(
    2500,
    activeAudit.annualSolarKwh,
    comparisonAudit.annualSolarKwh
  );

  const verdictBadgeClass = (status: 'GO' | 'MARGINAL' | 'NO-GO') => {
    if (status === 'GO') return 'bg-emerald-600 text-white';
    if (status === 'MARGINAL') return 'bg-amber-600 text-white';
    return 'bg-rose-600 text-white';
  };

  const presetList: SitePreset[] = PRESET_LIST;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      className="bento-card print-break-avoid relative overflow-hidden border-[#0F62FE]/50 dark:border-sky-400/40 p-5 sm:p-6"
    >
      {/* Top Header Bar */}
      <div className="flex flex-col gap-3 border-b border-[#D4D4CE] dark:border-[#22252A] pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#0F62FE]/30 dark:border-sky-400/30 bg-[#0F62FE]/10 dark:bg-sky-500/10 text-[#0F62FE] dark:text-sky-400">
            <GitCompare className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono-tabular text-[10px] font-extrabold uppercase tracking-widest text-[#0F62FE] dark:text-sky-400">
                SIDE-BY-SIDE DUAL-SITE TELEMETRY OVERLAY
              </span>
              <span className="font-mono-tabular border border-[#0F62FE]/30 dark:border-sky-400/30 bg-[#0F62FE]/10 dark:bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-[#0F62FE] dark:text-sky-300">
                SAME HARDWARE ({config.ratedPowerW}W @ {config.hubHeightM}m)
              </span>
            </div>
            <h3 className="font-display mt-0.5 text-base font-extrabold text-[#111214] dark:text-[#F3F4F6] sm:text-lg">
              {activeSiteName} <span className="font-normal text-[#52565E] dark:text-[#9CA3AF]">vs.</span>{' '}
              {savedSite.siteName}
            </h3>
          </div>
        </div>

        {/* Comparison Actions: Quick-Pick Baseline, Swap, Save Current, Close */}
        <div className="no-print flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/70 dark:bg-[#0A0B0D] p-1 text-[11px]">
            <span className="px-2 font-mono-tabular text-[10px] font-bold uppercase text-[#52565E] dark:text-[#9CA3AF]">Baseline B:</span>
            {presetList.map((preset) => {
              const isSelected = savedSite.siteName === preset.name;
              const chipLabel =
                preset.key === 'varanasi'
                  ? 'Varanasi'
                  : preset.key === 'suburban'
                  ? 'Pune'
                  : preset.key === 'mumbai'
                  ? 'Mumbai'
                  : 'Kutch';
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => onQuickLoadComparisonPreset(preset)}
                  className={`flex items-center gap-1 px-2 py-1 font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-[#0F62FE] dark:bg-sky-500 text-white dark:text-slate-950 font-bold'
                      : 'text-[#52565E] dark:text-[#9CA3AF] hover:bg-white dark:hover:bg-[#161A20] hover:text-[#111214] dark:hover:text-[#F3F4F6]'
                  }`}
                  title={`Compare active site against ${preset.name}`}
                >
                  <Compass className="h-3 w-3" />
                  <span>{chipLabel}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onSwapLocations}
            className="flex items-center gap-1.5 border border-[#D4D4CE] dark:border-[#22252A] bg-white/80 dark:bg-[#161A20] px-3 py-1.5 text-xs font-semibold text-[#111214] dark:text-[#F3F4F6] transition-colors hover:border-[#0F62FE] dark:hover:border-sky-400 whitespace-nowrap cursor-pointer"
            title="Swap Active Location A and Saved Baseline Location B"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 text-[#0F62FE] dark:text-sky-400" />
            <span>Swap A / B</span>
          </button>

          <button
            type="button"
            onClick={onSaveCurrentAsBaseline}
            className="flex items-center gap-1.5 border border-[#D4D4CE] dark:border-[#22252A] bg-white/80 dark:bg-[#161A20] px-3 py-1.5 text-xs font-semibold text-[#111214] dark:text-[#F3F4F6] transition-colors hover:border-[#0F62FE] dark:hover:border-sky-400 whitespace-nowrap cursor-pointer"
            title="Overwrite Saved Baseline B with the current Active Site"
          >
            <BookmarkCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Overwrite Baseline</span>
          </button>

          <button
            type="button"
            onClick={onCloseComparison}
            className="flex items-center gap-1 border border-[#D4D4CE] dark:border-[#22252A] bg-[#111214] dark:bg-[#1C2026] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-rose-600 hover:border-rose-600 whitespace-nowrap cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
            <span>Close Overlay</span>
          </button>
        </div>
      </div>

      {/* Location A vs Location B Identity Cards */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Site A: Active Audited Location */}
        <div className="flex items-center justify-between gap-3 border border-[#0F62FE]/40 dark:border-sky-400/40 bg-sky-500/5 dark:bg-sky-500/10 p-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 bg-[#0F62FE] dark:bg-sky-400" />
              <span className="font-mono-tabular text-[10px] font-extrabold uppercase tracking-wider text-[#0F62FE] dark:text-sky-400">
                LOCATION A (ACTIVE PIN)
              </span>
            </div>
            <div className="font-display mt-0.5 truncate text-sm font-extrabold text-[#111214] dark:text-[#F3F4F6]">
              {activeSiteName}
            </div>
            <div className="font-mono-tabular text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
              {activeLat.toFixed(4)}°N, {activeLon.toFixed(4)}°E ·{' '}
              {activeAudit.shearModel === 'logarithmic'
                ? `z₀=${activeAudit.z0}m`
                : `α=${activeAudit.alpha.toFixed(2)}`}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span
              className={`font-mono-tabular inline-block px-2.5 py-0.5 text-[11px] font-bold ${verdictBadgeClass(
                activeAudit.verdict.status
              )}`}
            >
              {activeAudit.verdict.status}
            </span>
            <div className="font-mono-tabular mt-1 text-xs font-extrabold text-[#0F62FE] dark:text-sky-400 whitespace-nowrap">
              {activeAudit.annualWindKwh.toLocaleString('en-IN')} kWh/yr
            </div>
          </div>
        </div>

        {/* Site B: Saved Baseline Location */}
        <div className="flex items-center justify-between gap-3 border border-indigo-500/40 bg-indigo-500/5 dark:bg-indigo-500/10 p-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 bg-indigo-500" />
              <span className="font-mono-tabular text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                LOCATION B (SAVED BASELINE)
              </span>
            </div>
            <div className="font-display mt-0.5 truncate text-sm font-extrabold text-[#111214] dark:text-[#F3F4F6]">
              {savedSite.siteName}
            </div>
            <div className="font-mono-tabular text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
              {savedSite.lat.toFixed(4)}°N, {savedSite.lon.toFixed(4)}°E · Saved {savedSite.savedAt}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span
              className={`font-mono-tabular inline-block px-2.5 py-0.5 text-[11px] font-bold ${verdictBadgeClass(
                comparisonAudit.verdict.status
              )}`}
            >
              {comparisonAudit.verdict.status}
            </span>
            <div className="font-mono-tabular mt-1 text-xs font-extrabold text-indigo-700 dark:text-indigo-400 whitespace-nowrap">
              {comparisonAudit.annualWindKwh.toLocaleString('en-IN')} kWh/yr
            </div>
          </div>
        </div>
      </div>

      {/* 4-Column Overlaid Performance Metric Comparison Grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* 1. Hub Wind Speed & Dead-Zone Overlay */}
        <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-white/80 dark:bg-[#0A0B0D] p-4">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#111214] dark:text-[#F3F4F6]">
            <span className="flex items-center gap-1.5">
              <Wind className="h-3.5 w-3.5 text-[#0F62FE] dark:text-sky-400 shrink-0" />
              <span>Mean Hub Wind ({config.hubHeightM}m)</span>
            </span>
            <span
              className={`font-mono-tabular px-1.5 py-0.5 text-[10px] font-extrabold whitespace-nowrap shrink-0 ${
                windSpeedDelta >= 0
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
              }`}
            >
              {windSpeedDelta >= 0 ? '+' : ''}
              {windSpeedDelta.toFixed(2)} m/s
            </span>
          </div>

          <div className="mt-3 space-y-2.5">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate font-semibold text-[#0F62FE] dark:text-sky-400">A: {activeSiteName.split(',')[0]}</span>
                <span className="font-mono-tabular font-extrabold text-[#0F62FE] dark:text-sky-400 whitespace-nowrap shrink-0">
                  {activeAudit.avgWindSpeedMs.toFixed(2)} m/s
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden bg-[#ECECE6] dark:bg-[#161A20]">
                <div
                  className="h-full bg-[#0F62FE] dark:bg-sky-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, (activeAudit.avgWindSpeedMs / maxWindSpeed) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate font-semibold text-indigo-700 dark:text-indigo-400">B: {savedSite.siteName.split(',')[0]}</span>
                <span className="font-mono-tabular font-extrabold text-indigo-700 dark:text-indigo-400 whitespace-nowrap shrink-0">
                  {comparisonAudit.avgWindSpeedMs.toFixed(2)} m/s
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden bg-[#ECECE6] dark:bg-[#161A20]">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, (comparisonAudit.avgWindSpeedMs / maxWindSpeed) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#D4D4CE] dark:border-[#22252A] pt-2 text-[11px]">
            <span className="text-[#52565E] dark:text-[#9CA3AF]">&lt;{activeAudit.cutInSpeedMs.toFixed(1)}m/s Dead Zone:</span>
            <span
              className={`font-mono-tabular font-bold whitespace-nowrap shrink-0 ${
                deadZoneDelta <= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {deadZoneDelta > 0 ? '+' : ''}
              {deadZoneDelta.toFixed(1)}% idle
            </span>
          </div>
        </div>

        {/* 2. Annual Wind Output & Capacity Factor Overlay */}
        <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-white/80 dark:bg-[#0A0B0D] p-4">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#111214] dark:text-[#F3F4F6]">
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-[#0F62FE] dark:text-sky-400 shrink-0" />
              <span>Annual Wind Yield</span>
            </span>
            <span
              className={`font-mono-tabular px-1.5 py-0.5 text-[10px] font-extrabold whitespace-nowrap shrink-0 ${
                windKwhDelta >= 0
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
              }`}
            >
              {windKwhDelta >= 0 ? '+' : ''}
              {windKwhDelta.toLocaleString('en-IN')} kWh
            </span>
          </div>

          <div className="mt-3 space-y-2.5">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate font-semibold text-[#0F62FE] dark:text-sky-400">
                  A ({activeAudit.capacityFactorPct.toFixed(1)}% CF)
                </span>
                <span className="font-mono-tabular font-extrabold text-[#0F62FE] dark:text-sky-400 whitespace-nowrap shrink-0">
                  {activeAudit.annualWindKwh.toLocaleString('en-IN')} kWh
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden bg-[#ECECE6] dark:bg-[#161A20]">
                <div
                  className="h-full bg-[#0F62FE] dark:bg-sky-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, (activeAudit.annualWindKwh / maxWindKwh) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate font-semibold text-indigo-700 dark:text-indigo-400">
                  B ({comparisonAudit.capacityFactorPct.toFixed(1)}% CF)
                </span>
                <span className="font-mono-tabular font-extrabold text-indigo-700 dark:text-indigo-400 whitespace-nowrap shrink-0">
                  {comparisonAudit.annualWindKwh.toLocaleString('en-IN')} kWh
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden bg-[#ECECE6] dark:bg-[#161A20]">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, (comparisonAudit.annualWindKwh / maxWindKwh) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#D4D4CE] dark:border-[#22252A] pt-2 text-[11px]">
            <span className="text-[#52565E] dark:text-[#9CA3AF]">Capacity Factor Delta:</span>
            <span
              className={`font-mono-tabular font-bold whitespace-nowrap shrink-0 ${
                cfDelta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {cfDelta >= 0 ? '+' : ''}
              {cfDelta.toFixed(1)}% CF
            </span>
          </div>
        </div>

        {/* 3. Financial ROI & Payback Period Overlay */}
        <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-white/80 dark:bg-[#0A0B0D] p-4">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#111214] dark:text-[#F3F4F6]">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#0F62FE] dark:text-sky-400 shrink-0" />
              <span>Wind ROI &amp; Payback</span>
            </span>
            <span
              className={`font-mono-tabular px-1.5 py-0.5 text-[10px] font-extrabold whitespace-nowrap shrink-0 ${
                roiDelta >= 0
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
              }`}
            >
              {roiDelta >= 0 ? '+' : ''}
              {roiDelta.toFixed(1)}% ROI/yr
            </span>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2 bg-sky-500/10 px-2.5 py-1.5">
              <span className="font-semibold text-[#0F62FE] dark:text-sky-300 whitespace-nowrap">Site A Payback:</span>
              <span className="font-mono-tabular font-extrabold text-[#0F62FE] dark:text-sky-400 whitespace-nowrap">
                {activeAudit.paybackYears !== null && activeAudit.paybackYears <= 50
                  ? `${activeAudit.paybackYears.toFixed(1)} yrs (${activeRoiPct.toFixed(1)}%/yr)`
                  : formatPaybackPeriod(activeAudit.paybackYears, 'short')}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 bg-indigo-500/10 px-2.5 py-1.5">
              <span className="font-semibold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">Site B Payback:</span>
              <span className="font-mono-tabular font-extrabold text-indigo-700 dark:text-indigo-400 whitespace-nowrap">
                {comparisonAudit.paybackYears !== null && comparisonAudit.paybackYears <= 50
                  ? `${comparisonAudit.paybackYears.toFixed(1)} yrs (${compRoiPct.toFixed(1)}%/yr)`
                  : formatPaybackPeriod(comparisonAudit.paybackYears, 'short')}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#D4D4CE] dark:border-[#22252A] pt-2 text-[11px]">
            <span className="text-[#52565E] dark:text-[#9CA3AF]">Annual Savings Delta:</span>
            <span
              className={`font-mono-tabular font-bold whitespace-nowrap shrink-0 ${
                activeAudit.annualSavingsInr - comparisonAudit.annualSavingsInr >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {activeAudit.annualSavingsInr - comparisonAudit.annualSavingsInr >= 0 ? '+₹' : '-₹'}
              {Math.abs(
                activeAudit.annualSavingsInr - comparisonAudit.annualSavingsInr
              ).toLocaleString('en-IN')}
              /yr
            </span>
          </div>
        </div>

        {/* 4. Same-Budget Rooftop Solar Yield Overlay */}
        <div className="border border-emerald-500/35 bg-emerald-500/5 dark:bg-emerald-500/10 p-4">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <span className="flex items-center gap-1.5">
              <Sun className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Solar ({activeAudit.solarEquivalentKw.toFixed(1)}kW)</span>
            </span>
            <span className="font-mono-tabular bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300 whitespace-nowrap shrink-0">
              {solarKwhDelta >= 0 ? '+' : ''}
              {solarKwhDelta.toLocaleString('en-IN')} kWh
            </span>
          </div>

          <div className="mt-3 space-y-2.5">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate font-semibold text-emerald-800 dark:text-emerald-300">
                  A Solar ({formatPaybackPeriod(activeAudit.solarPaybackYears, 'short')})
                </span>
                <span className="font-mono-tabular font-extrabold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                  {activeAudit.annualSolarKwh.toLocaleString('en-IN')} kWh
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden bg-emerald-500/20">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (activeAudit.annualSolarKwh / maxSolarKwh) * 100)}%`
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate font-semibold text-emerald-800/80 dark:text-emerald-300/80">
                  B Solar ({formatPaybackPeriod(comparisonAudit.solarPaybackYears, 'short')})
                </span>
                <span className="font-mono-tabular font-extrabold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                  {comparisonAudit.annualSolarKwh.toLocaleString('en-IN')} kWh
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden bg-emerald-500/20">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      (comparisonAudit.annualSolarKwh / maxSolarKwh) * 100
                    )}%`
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-emerald-500/20 pt-2 text-[11px]">
            <span className="text-emerald-800/75 dark:text-emerald-200/75 whitespace-nowrap">Solar Advantage:</span>
            <span className="font-mono-tabular font-extrabold text-emerald-800 dark:text-emerald-300 whitespace-nowrap shrink-0">
              A {activeAudit.solarToWindRatio >= 100 ? '100+×' : `${activeAudit.solarToWindRatio.toFixed(1)}×`} · B{' '}
              {comparisonAudit.solarToWindRatio >= 100 ? '100+×' : `${comparisonAudit.solarToWindRatio.toFixed(1)}×`}
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  );
};
