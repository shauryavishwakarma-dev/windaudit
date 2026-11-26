import React from 'react';
import { Wind, Zap, Sun, Sparkles } from 'lucide-react';
import { AuditConfig, AuditResult, formatPaybackPeriod } from '../physics';
import { useLanguage } from '../i18n';
import { AnimatedNumber } from './AnimatedNumber';

interface KpiGridProps {
  audit: AuditResult;
  config: AuditConfig;
  isComparing?: boolean;
  comparisonAudit?: AuditResult | null;
  comparisonSiteName?: string | null;
}

export const KpiGrid: React.FC<KpiGridProps> = ({
  audit,
  config,
  isComparing = false,
  comparisonAudit = null,
  comparisonSiteName = null
}) => {
  const { t } = useLanguage();
  const paybackDisplay = formatPaybackPeriod(audit.paybackYears, 'short');
  const solarPaybackDisplay = formatPaybackPeriod(audit.solarPaybackYears, 'short');

  const windBeatsSolar = audit.annualWindKwh > audit.annualSolarKwh && audit.annualSolarKwh > 0;
  const advantageFactor = windBeatsSolar
    ? audit.annualWindKwh / Math.max(1, audit.annualSolarKwh)
    : audit.solarToWindRatio;
  const ratioDisplay =
    advantageFactor >= 100
      ? '100+×'
      : advantageFactor < 1.2
      ? `${advantageFactor.toFixed(2)}×`
      : `${advantageFactor.toFixed(1)}×`;

  const shortCompName = comparisonSiteName
    ? comparisonSiteName.split(' (')[0].split(',')[0]
    : 'Baseline';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 border border-[#D4D4CE] dark:border-[#22252A] divide-y sm:divide-y-0 sm:divide-x divide-[#D4D4CE] dark:divide-[#22252A] bg-[#ECECE6]/45 dark:bg-[#101216]">
      {/* Cell 1: Avg Hub Wind Speed */}
      <div className="p-5 sm:p-6 flex flex-col justify-between transition-colors hover:bg-[#ECECE6]/70 dark:hover:bg-[#14171D]">
        <div>
          <div className="flex items-center justify-between">
            <span className="font-mono-tabular text-[10px] font-semibold uppercase tracking-widest text-[#52565E] dark:text-[#9CA3AF]">
              {t('kpi_hub_wind')}
            </span>
            <Wind className="h-3.5 w-3.5 text-[#0F62FE] dark:text-sky-400" />
          </div>
          <div className="my-2.5 flex items-baseline gap-1.5">
            <AnimatedNumber
              value={audit.avgWindSpeedMs}
              decimals={2}
              className="font-mono-tabular text-3xl font-bold tracking-tight text-[#111315] dark:text-[#F3F4F6]"
            />
            <span className="font-mono-tabular text-xs font-semibold text-[#52565E] dark:text-[#9CA3AF]">
              m/s
            </span>
          </div>
        </div>

        <div className="border-t border-[#D4D4CE]/70 dark:border-[#22252A] pt-2.5 space-y-1 font-mono-tabular">
          <div className="text-[11px]">
            <span
              className={
                audit.pctBelowCutIn > 50
                  ? 'font-semibold text-[#DC2626] dark:text-[#F87171]'
                  : 'font-semibold text-[#059669] dark:text-[#34D399]'
              }
            >
              {audit.pctBelowCutIn.toFixed(1)}% of hours below {audit.cutInSpeedMs.toFixed(1)} m/s cut-in
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] text-[#52565E] dark:text-[#9CA3AF]">
            <span className="whitespace-nowrap">Hub {config.hubHeightM}m</span>
            <span className="whitespace-nowrap">{(audit.avgWindSpeedMs * 3.6).toFixed(1)} km/h</span>
          </div>
        </div>
      </div>

      {/* Cell 2: Annual Wind Output */}
      <div className="p-5 sm:p-6 flex flex-col justify-between transition-colors hover:bg-[#ECECE6]/70 dark:hover:bg-[#14171D]">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono-tabular text-[10px] font-semibold uppercase tracking-widest text-[#52565E] dark:text-[#9CA3AF]">
              {t('kpi_wind_output')}
            </span>
            <Zap className="h-3.5 w-3.5 shrink-0 text-[#0F62FE] dark:text-sky-400" />
          </div>
          <div className="my-2.5 flex items-baseline gap-1.5">
            <AnimatedNumber
              value={Math.round(audit.annualWindKwh)}
              decimals={0}
              className="font-mono-tabular text-3xl font-bold tracking-tight text-[#0F62FE] dark:text-sky-400"
            />
            <span className="font-mono-tabular text-xs font-semibold text-[#52565E] dark:text-[#9CA3AF] whitespace-nowrap">
              kWh/yr
            </span>
          </div>
        </div>

        <div className="border-t border-[#D4D4CE]/70 dark:border-[#22252A] pt-2.5 space-y-1 font-mono-tabular">
          <div className="flex items-center justify-between gap-2 text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
            <span className="whitespace-nowrap">{t('kpi_cap_factor')}</span>
            <span className="font-bold text-[#111315] dark:text-[#F3F4F6] whitespace-nowrap">
              {audit.capacityFactorPct.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] text-[#52565E] dark:text-[#9CA3AF]">
            <span className="truncate whitespace-nowrap">
              {isComparing && comparisonAudit
                ? `vs ${shortCompName}`
                : `@ ₹${config.tariffInr}/kWh`}
            </span>
            <span className="font-bold text-[#111315] dark:text-[#F3F4F6] whitespace-nowrap shrink-0">
              ₹{Math.round(audit.annualSavingsInr).toLocaleString('en-IN')}/yr
            </span>
          </div>
        </div>
      </div>

      {/* Cell 3: Same-Budget Solar Output */}
      <div className="p-5 sm:p-6 flex flex-col justify-between transition-colors hover:bg-[#ECECE6]/70 dark:hover:bg-[#14171D]">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono-tabular text-[10px] font-semibold uppercase tracking-widest text-[#52565E] dark:text-[#9CA3AF]">
              {t('kpi_solar_output')}
            </span>
            <Sun className="h-3.5 w-3.5 shrink-0 text-[#059669] dark:text-[#10B981]" />
          </div>
          <div className="my-2.5 flex items-baseline gap-1.5">
            <AnimatedNumber
              value={Math.round(audit.annualSolarKwh)}
              decimals={0}
              className="font-mono-tabular text-3xl font-bold tracking-tight text-[#059669] dark:text-[#10B981]"
            />
            <span className="font-mono-tabular text-xs font-semibold text-[#52565E] dark:text-[#9CA3AF] whitespace-nowrap">
              kWh/yr
            </span>
          </div>
        </div>

        <div className="border-t border-[#D4D4CE]/70 dark:border-[#22252A] pt-2.5 space-y-1 font-mono-tabular">
          <div className="flex items-center justify-between gap-2 text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
            <span className="whitespace-nowrap">{t('kpi_pv_size')}</span>
            <span className="font-bold text-[#111315] dark:text-[#F3F4F6] whitespace-nowrap shrink-0">
              {audit.solarEquivalentKw.toFixed(2)} kWp
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] text-[#52565E] dark:text-[#9CA3AF]">
            <span>{t('kpi_savings')}</span>
            <span className="font-bold text-[#059669] dark:text-[#34D399] whitespace-nowrap shrink-0">
              ₹{Math.round(audit.solarAnnualSavingsInr).toLocaleString('en-IN')}/yr
            </span>
          </div>
        </div>
      </div>

      {/* Cell 4: Solar Advantage */}
      <div className="p-5 sm:p-6 flex flex-col justify-between transition-colors hover:bg-[#ECECE6]/70 dark:hover:bg-[#14171D]">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono-tabular text-[10px] font-semibold uppercase tracking-widest text-[#52565E] dark:text-[#9CA3AF]">
              {windBeatsSolar ? t('kpi_wind_adv') : t('kpi_solar_adv')}
            </span>
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#0F62FE] dark:text-sky-400" />
          </div>
          <div className="my-2.5 flex items-baseline gap-2">
            {advantageFactor >= 100 ? (
              <span className="font-mono-tabular text-3xl font-bold tracking-tight text-[#111315] dark:text-[#F3F4F6] whitespace-nowrap">
                {ratioDisplay}
              </span>
            ) : (
              <AnimatedNumber
                value={advantageFactor}
                decimals={advantageFactor < 1.2 ? 2 : 1}
                suffix="×"
                className="font-mono-tabular text-3xl font-bold tracking-tight text-[#111315] dark:text-[#F3F4F6] whitespace-nowrap"
              />
            )}
            <span className="font-mono-tabular text-xs font-semibold text-[#52565E] dark:text-[#9CA3AF] whitespace-nowrap">
              {windBeatsSolar ? 'Wind Yield' : 'Solar Yield'}
            </span>
          </div>
        </div>

        <div className="border-t border-[#D4D4CE]/70 dark:border-[#22252A] pt-2.5 space-y-1 font-mono-tabular">
          <div className="flex items-center justify-between gap-2 text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
            <span className="whitespace-nowrap">{t('kpi_solar_payback')}</span>
            <span className="font-bold text-[#059669] dark:text-[#34D399] whitespace-nowrap shrink-0">
              {solarPaybackDisplay}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] text-[#52565E] dark:text-[#9CA3AF]">
            <span className="whitespace-nowrap">{t('kpi_wind_payback')}</span>
            <span
              className={`font-bold whitespace-nowrap shrink-0 ${
                audit.paybackYears && audit.paybackYears <= 15
                  ? 'text-[#059669] dark:text-[#34D399]'
                  : 'text-[#DC2626] dark:text-[#F87171]'
              }`}
            >
              {paybackDisplay.replace(' yrs', 'y')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
