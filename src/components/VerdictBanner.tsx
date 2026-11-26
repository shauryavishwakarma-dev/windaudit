import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  MapPin,
  GitCompare,
  Copy,
  Check,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Wind,
  Sun,
  Info
} from 'lucide-react';
import {
  AuditConfig,
  AuditResult,
  AuditVerdict,
  buildShareableAuditSummary,
  formatPaybackPeriod
} from '../physics';
import { SitePreset } from '../api';
import { useLanguage } from '../i18n';

interface VerdictBannerProps {
  verdict: AuditVerdict;
  audit: AuditResult;
  config: AuditConfig;
  siteName: string;
  lat: number;
  lon: number;
  activePresetKey?: string | null;
  onSelectPreset?: (preset: SitePreset) => void;
  dataSource: 'live' | 'offline_fallback';
  apiWarning?: string | null;
  isOceanCoordinate?: boolean;
  isLoadingWeather?: boolean;
  onRetryWeather?: () => void;
  isComparing?: boolean;
  savedBaselineName?: string | null;
  onSaveForComparison?: () => void;
  onToggleComparison?: () => void;
  showMathDrawer?: boolean;
  onToggleMathDrawer?: () => void;
}

export const VerdictBanner: React.FC<VerdictBannerProps> = ({
  verdict,
  audit,
  config,
  siteName,
  lat,
  lon,
  dataSource,
  isLoadingWeather = false,
  isComparing = false,
  onToggleComparison
}) => {
  const { t } = useLanguage();
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const statusStyles = {
    GO: {
      bandBg:
        'border-[#059669] bg-[#059669]/10 dark:border-emerald-400 dark:bg-emerald-500/10',
      badgeBg:
        'border-[#059669]/40 bg-[#059669]/15 text-[#059669] dark:border-emerald-400/50 dark:bg-emerald-500/15 dark:text-emerald-400',
      badgeLabel:
        verdict.recommendedSystem === 'WIND'
          ? t('verdict_badge_wind')
          : t('verdict_badge_hybrid'),
      icon: CheckCircle2,
      dotColor: 'bg-[#059669] dark:bg-emerald-400',
      heroAccent: 'text-[#059669] dark:text-emerald-400'
    },
    MARGINAL: {
      bandBg:
        'border-[#2563EB] bg-[#2563EB]/10 dark:border-[#F59E0B] dark:bg-[#F59E0B]/10',
      badgeBg:
        'border-[#2563EB]/40 bg-[#2563EB]/12 text-[#2563EB] dark:border-[#F59E0B]/50 dark:bg-[#F59E0B]/15 dark:text-[#FBBF24]',
      badgeLabel: t('verdict_badge_marginal'),
      icon: AlertTriangle,
      dotColor: 'bg-[#2563EB] dark:bg-[#FBBF24]',
      heroAccent: 'text-[#2563EB] dark:text-[#FBBF24]'
    },
    'NO-GO': {
      bandBg:
        'border-[#DC2626] bg-[#DC2626]/10 dark:border-[#EF4444] dark:bg-[#EF4444]/12',
      badgeBg:
        'border-[#DC2626]/40 bg-[#DC2626]/12 text-[#DC2626] dark:border-[#EF4444]/50 dark:bg-[#EF4444]/15 dark:text-[#FCA5A5]',
      badgeLabel: t('verdict_badge_nogo'),
      icon: ShieldAlert,
      dotColor: 'bg-[#DC2626] dark:bg-[#EF4444]',
      heroAccent: 'text-[#DC2626] dark:text-[#FCA5A5]'
    }
  }[verdict.status];

  const handleCopySummary = async () => {
    const text = buildShareableAuditSummary(siteName, lat, lon, config, audit);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    }
  };

  const windBeatsSolar = audit.annualWindKwh > audit.annualSolarKwh && audit.annualSolarKwh > 0;
  const advantageFactor = windBeatsSolar
    ? audit.annualWindKwh / Math.max(1, audit.annualSolarKwh)
    : audit.solarToWindRatio;
  const ratioText = advantageFactor >= 100 ? '100+×' : `${advantageFactor.toFixed(1)}×`;
  const windPaybackShort = formatPaybackPeriod(audit.paybackYears, 'short');
  const solarPaybackShort = formatPaybackPeriod(audit.solarPaybackYears, 'short');
  const turbineSpec = config.turbineType === 'vawt' ? 'Helical VAWT' : '3-Blade HAWT';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`border ${statusStyles.bandBg} p-6 sm:p-7`}
    >
      {/* 1. Top Telemetry & Location Header */}
      <div className="flex flex-col gap-3 border-b border-[#D4D4CE]/70 dark:border-[#22252A] pb-3.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] text-[#0F62FE] dark:text-sky-400">
              <MapPin className="h-3.5 w-3.5" />
            </div>
            <span className="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-[#111315] dark:text-[#F3F4F6] truncate">
              {t('verdict_heading_prefix')} · {siteName}
            </span>
            {isLoadingWeather && (
              <span className="border border-[#0F62FE]/40 dark:border-sky-400/40 bg-[#0F62FE]/10 dark:bg-sky-500/10 px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-[#0F62FE] dark:text-sky-400 animate-pulse shrink-0">
                Updating ERA5...
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-8 font-mono-tabular text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
            <span>
              {lat.toFixed(2)}°N, {lon.toFixed(2)}°E · {audit.siteElevationM}m ASL ·{' '}
              {dataSource === 'live' ? 'ERA5 LIVE' : 'CLIMATOLOGY'}
            </span>
            <span className="opacity-40">·</span>
            <span>
              {turbineSpec} · CF {audit.capacityFactorPct.toFixed(1)}% · Solar {ratioText}
            </span>
          </div>
        </div>

        <div className="no-print flex shrink-0 items-center gap-2">
          {onToggleComparison && (
            <button
              type="button"
              onClick={onToggleComparison}
              className={`flex items-center gap-1.5 border px-3 py-1.5 font-mono-tabular text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isComparing
                  ? 'border-[#0F62FE] bg-[#0F62FE] text-white dark:border-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950'
                  : 'border-[#D4D4CE] dark:border-[#2E333C] bg-[#F4F4F0] dark:bg-[#101216] text-[#111315] dark:text-[#F3F4F6] hover:border-[#0F62FE] dark:hover:border-sky-400'
              }`}
            >
              <GitCompare className="h-3.5 w-3.5" />
              <span>{isComparing ? t('verdict_comparing') : t('verdict_compare_baseline')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 border border-[#D4D4CE] dark:border-[#2E333C] bg-[#F4F4F0] dark:bg-[#101216] px-3 py-1.5 font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-[#111315] dark:text-[#F3F4F6] hover:border-[#0F62FE] dark:hover:border-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedSummary ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#059669] dark:text-emerald-400" />
                <span className="text-[#059669] dark:text-emerald-400">{t('verdict_copied')}</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 opacity-60" />
                <span>{t('verdict_copy')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Main Editorial Verdict Headline */}
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2 flex-1">
          <div
            className={`inline-flex items-center gap-2 border px-2.5 py-0.5 font-mono-tabular text-[10px] font-bold tracking-widest ${statusStyles.badgeBg}`}
          >
            <span className={`h-1.5 w-1.5 ${statusStyles.dotColor} animate-pulse`} />
            <span>{statusStyles.badgeLabel}</span>
          </div>

          <h2 className="font-editorial text-2xl sm:text-4xl font-normal uppercase tracking-wide text-[#111315] dark:text-[#F3F4F6] leading-[1.06]">
            {verdict.headline}
          </h2>

          <p className="text-xs sm:text-sm text-[#52565E] dark:text-[#D1D5DB] max-w-3xl leading-relaxed">
            {verdict.plainSummary ||
              `Rooftop solar produces ${ratioText} more electricity for the same investment.`}
          </p>
        </div>

        {/* Hero Ratio Readout */}
        <div className="flex shrink-0 items-center justify-between sm:flex-col sm:items-end border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/90 dark:bg-[#0A0B0D]/90 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-[#059669] dark:text-emerald-400" />
            <span className="font-mono-tabular text-2xl sm:text-3xl font-bold text-[#111315] dark:text-[#F3F4F6]">
              {ratioText}
            </span>
          </div>
          <span className="font-mono-tabular text-[10px] font-semibold uppercase tracking-widest text-[#52565E] dark:text-[#9CA3AF]">
            {windBeatsSolar ? t('verdict_wind_adv') : t('verdict_solar_adv')}
          </span>
        </div>
      </div>

      {/* 3. Side-by-Side System Benchmark Strip */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/80 dark:bg-[#0A0B0D]/75 p-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6] dark:bg-[#101216] text-[#0F62FE] dark:text-sky-400">
              <Wind className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#111315] dark:text-[#F3F4F6]">
                ₹{config.budgetInr.toLocaleString('en-IN')} Wind Turbine ({turbineSpec})
              </div>
              <div className="font-mono-tabular text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
                {audit.pctBelowCutIn > 70
                  ? `Idle ${audit.pctBelowCutIn.toFixed(0)}% of year (below cut-in)`
                  : `${(100 - audit.pctBelowCutIn).toFixed(0)}% active generation`}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono-tabular text-sm font-bold text-[#111315] dark:text-[#F3F4F6] whitespace-nowrap">
              {Math.round(audit.annualWindKwh).toLocaleString('en-IN')} kWh/yr
            </div>
            <div className="font-mono-tabular text-[10px] text-[#52565E] dark:text-[#9CA3AF] whitespace-nowrap">
              Payback: {windPaybackShort}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border border-[#059669]/40 dark:border-[#10B981]/40 bg-[#059669]/5 dark:bg-[#10B981]/8 p-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#059669]/40 dark:border-[#10B981]/40 bg-[#059669]/10 dark:bg-[#10B981]/15 text-[#059669] dark:text-[#34D399]">
              <Sun className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#111315] dark:text-[#F3F4F6]">
                ₹{config.budgetInr.toLocaleString('en-IN')} Rooftop Solar ({audit.solarEquivalentKw.toFixed(2)} kWp)
              </div>
              <div className="font-mono-tabular text-[11px] font-semibold text-[#059669] dark:text-[#34D399]">
                {windBeatsSolar
                  ? `Steady 365-day backup (${audit.effectiveSolarPrPct}% PR)`
                  : `Generates ${ratioText} more power`}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono-tabular text-sm font-bold text-[#059669] dark:text-[#34D399] whitespace-nowrap">
              {Math.round(audit.annualSolarKwh).toLocaleString('en-IN')} kWh/yr
            </div>
            <div className="font-mono-tabular text-[10px] text-[#52565E] dark:text-[#9CA3AF] whitespace-nowrap">
              Payback: {solarPaybackShort}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Collapsible Physical Parameters Drawer */}
      <div className="no-print mt-3.5 pt-3 border-t border-[#D4D4CE]/70 dark:border-[#22252A]">
        <button
          type="button"
          onClick={() => setShowTechnicalDetails((prev) => !prev)}
          className="flex items-center gap-1.5 font-mono-tabular text-[11px] font-semibold uppercase tracking-wider text-[#52565E] dark:text-[#9CA3AF] hover:text-[#0F62FE] dark:hover:text-sky-400 transition-colors cursor-pointer"
        >
          <Info className="h-3.5 w-3.5 text-[#0F62FE] dark:text-sky-400" />
          <span>
            {showTechnicalDetails
              ? 'Hide Technical & Physics Details'
              : 'Show Technical & Physics Details (Wind shear, Air density, Formulas)'}
          </span>
          {showTechnicalDetails ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

        <AnimatePresence>
          {showTechnicalDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2.5 border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-3 text-xs text-[#52565E] dark:text-[#D1D5DB] leading-relaxed font-mono-tabular"
            >
              <div className="mb-1.5 font-bold text-[#111315] dark:text-[#F3F4F6] uppercase text-[10px] tracking-widest">
                Physical Simulation Parameters
              </div>
              <p className="text-[11px]">{verdict.reason}</p>
              <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#D4D4CE] dark:border-[#22252A] text-[10px]">
                <div>
                  <span className="opacity-65">Hub Height:</span>{' '}
                  <strong className="text-[#111315] dark:text-[#F3F4F6]">{config.hubHeightM}m</strong>
                </div>
                <div>
                  <span className="opacity-65">Cut-in Gate:</span>{' '}
                  <strong className="text-[#111315] dark:text-[#F3F4F6]">{audit.cutInSpeedMs.toFixed(1)} m/s</strong>
                </div>
                <div>
                  <span className="opacity-65">Air Density (ρ):</span>{' '}
                  <strong className="text-[#111315] dark:text-[#F3F4F6]">{audit.avgAirDensityKgM3.toFixed(3)} kg/m³</strong>
                </div>
                <div>
                  <span className="opacity-65">Solar Optimal Tilt:</span>{' '}
                  <strong className="text-[#111315] dark:text-[#F3F4F6]">{audit.solarOptimalTiltDeg}° South</strong>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
