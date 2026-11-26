import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Clock,
  IndianRupee,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  FileDown,
  Scale,
  Calculator
} from 'lucide-react';
import { AuditConfig, AuditResult, formatPaybackPeriod } from '../physics';

interface RoiPaybackPanelProps {
  audit: AuditResult;
  config: AuditConfig;
  siteName: string;
  onExportPdf: () => void;
}

const LIFESPAN_YEARS = 20;

export const RoiPaybackPanel: React.FC<RoiPaybackPanelProps> = ({
  audit,
  config,
  siteName,
  onExportPdf
}) => {
  const [includeEscalation, setIncludeEscalation] = useState<boolean>(false);

  const financials = useMemo(() => {
    const budget = Math.max(1, config.budgetInr);
    const baseTariff = Math.max(0.5, config.tariffInr);

    // Simple Annual ROI (%) = (Year-1 Annual Savings / Capital Budget) * 100
    const windAnnualRoiPct = (audit.annualSavingsInr / budget) * 100;
    const solarAnnualRoiPct = (audit.solarAnnualSavingsInr / budget) * 100;

    // 20-Year Cumulative Cash Flow Simulation
    // If includeEscalation is enabled: +4% annual electricity tariff inflation, 1.5% wind O&M, 0.5% solar O&M + 0.5%/yr PV degradation
    const tariffEscalationRate = includeEscalation ? 0.04 : 0;
    const windOmAnnualInr = includeEscalation ? budget * 0.015 : 0;
    const solarOmAnnualInr = includeEscalation ? budget * 0.005 : 0;
    const solarDegradationRate = includeEscalation ? 0.005 : 0;

    let windCumulativeSavings = 0;
    let solarCumulativeSavings = 0;
    let windDynamicPaybackYear: number | null = null;
    let solarDynamicPaybackYear: number | null = null;

    const milestoneYears: Array<{
      year: number;
      windNetInr: number;
      solarNetInr: number;
    }> = [];

    for (let yr = 1; yr <= LIFESPAN_YEARS; yr++) {
      const effectiveTariff = baseTariff * Math.pow(1 + tariffEscalationRate, yr - 1);
      // Do NOT clamp windYearNet to Math.max(0, ...): if annual O&M exceeds wind savings, net cash flow is negative
      const windYearNet = audit.annualWindKwh * effectiveTariff - windOmAnnualInr;
      const solarYearKwh = audit.annualSolarKwh * Math.pow(1 - solarDegradationRate, yr - 1);
      const solarYearNet = solarYearKwh * effectiveTariff - solarOmAnnualInr;

      const prevWindCum = windCumulativeSavings;
      const prevSolarCum = solarCumulativeSavings;

      windCumulativeSavings += windYearNet;
      solarCumulativeSavings += solarYearNet;

      if (
        windDynamicPaybackYear === null &&
        windCumulativeSavings >= budget &&
        windYearNet > 0
      ) {
        const remaining = Math.max(0, budget - prevWindCum);
        const candidate = Number((yr - 1 + remaining / windYearNet).toFixed(1));
        if (Number.isFinite(candidate) && candidate > 0 && candidate <= 50) {
          windDynamicPaybackYear = candidate;
        }
      }

      if (
        solarDynamicPaybackYear === null &&
        solarCumulativeSavings >= budget &&
        solarYearNet > 0
      ) {
        const remaining = Math.max(0, budget - prevSolarCum);
        const candidate = Number((yr - 1 + remaining / solarYearNet).toFixed(1));
        if (Number.isFinite(candidate) && candidate > 0 && candidate <= 50) {
          solarDynamicPaybackYear = candidate;
        }
      }

      if (yr === 5 || yr === 10 || yr === 15 || yr === 20) {
        milestoneYears.push({
          year: yr,
          windNetInr: Math.round(windCumulativeSavings - budget),
          solarNetInr: Math.round(solarCumulativeSavings - budget)
        });
      }
    }

    const wind20YrNetProfitInr = Math.round(windCumulativeSavings - budget);
    const solar20YrNetProfitInr = Math.round(solarCumulativeSavings - budget);

    const wind20YrTotalRoiPct = ((windCumulativeSavings - budget) / budget) * 100;
    const solar20YrTotalRoiPct = ((solarCumulativeSavings - budget) / budget) * 100;

    // 20-Year Levelized Cost of Energy (LCOE in ₹/kWh)
    const wind20YrTotalKwh = audit.annualWindKwh * LIFESPAN_YEARS;
    const solar20YrTotalKwh = audit.annualSolarKwh * LIFESPAN_YEARS;
    const windLcoeInr =
      wind20YrTotalKwh > 0
        ? (budget + windOmAnnualInr * LIFESPAN_YEARS) / wind20YrTotalKwh
        : null;
    const solarLcoeInr =
      solar20YrTotalKwh > 0
        ? (budget + solarOmAnnualInr * LIFESPAN_YEARS) / solar20YrTotalKwh
        : null;

    const effectiveWindPayback = includeEscalation
      ? windDynamicPaybackYear
      : audit.paybackYears;
    const effectiveSolarPayback = includeEscalation
      ? solarDynamicPaybackYear ?? audit.solarPaybackYears
      : audit.solarPaybackYears;

    const opportunityCost20YrInr = Math.max(0, solar20YrNetProfitInr - wind20YrNetProfitInr);

    return {
      windAnnualRoiPct,
      solarAnnualRoiPct,
      effectiveWindPayback,
      effectiveSolarPayback,
      wind20YrCumulativeInr: Math.round(windCumulativeSavings),
      solar20YrCumulativeInr: Math.round(solarCumulativeSavings),
      wind20YrNetProfitInr,
      solar20YrNetProfitInr,
      wind20YrTotalRoiPct,
      solar20YrTotalRoiPct,
      windLcoeInr,
      solarLcoeInr,
      opportunityCost20YrInr,
      milestoneYears
    };
  }, [audit, config.budgetInr, config.tariffInr, includeEscalation]);

  // Payback bar fill percentages capped to 20-year hardware lifespan
  const windPaybackBarPct =
    financials.effectiveWindPayback !== null &&
    Number.isFinite(financials.effectiveWindPayback) &&
    financials.effectiveWindPayback > 0
      ? Math.min(100, (financials.effectiveWindPayback / LIFESPAN_YEARS) * 100)
      : 100;

  const solarPaybackBarPct =
    financials.effectiveSolarPayback !== null &&
    Number.isFinite(financials.effectiveSolarPayback) &&
    financials.effectiveSolarPayback > 0
      ? Math.min(
          100,
          Math.max(4, (financials.effectiveSolarPayback / LIFESPAN_YEARS) * 100)
        )
      : 100;

  const windBreaksEvenInLifespan =
    financials.effectiveWindPayback !== null &&
    financials.effectiveWindPayback > 0 &&
    financials.effectiveWindPayback <= LIFESPAN_YEARS;

  return (
    <section className="bento-card print-break-avoid p-5 sm:p-6">
      {/* Top Header Strip */}
      <div className="flex flex-col gap-3 border-b border-[#D4D4CE] dark:border-[#22252A] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center border border-[#0F62FE]/30 dark:border-sky-400/30 bg-[#0F62FE]/10 dark:bg-sky-500/10 text-[#0F62FE] dark:text-sky-400">
              <Calculator className="h-4 w-4" />
            </span>
            <span className="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-[#0F62FE] dark:text-sky-400">
              CAPEX ROI &amp; PAYBACK TELEMETRY
            </span>
          </div>
          <h3 className="font-display mt-1 text-base font-extrabold text-[#111214] dark:text-[#F3F4F6] sm:text-lg">
            Return on Investment (ROI) &amp; 20-Year Payback Horizon
          </h3>
          <p className="text-xs text-[#52565E] dark:text-[#9CA3AF]">
            Auditing{' '}
            <span className="font-mono-tabular font-bold text-[#111214] dark:text-[#F3F4F6]">
              ₹{config.budgetInr.toLocaleString('en-IN')}
            </span>{' '}
            capital budget at{' '}
            <span className="font-mono-tabular font-bold text-[#111214] dark:text-[#F3F4F6]">
              ₹{config.tariffInr.toFixed(2)}/kWh
            </span>{' '}
            tariff for <span className="font-semibold text-[#111214] dark:text-[#D1D5DB]">{siteName}</span>
          </p>
        </div>

        {/* Controls: Escalation Model Toggle + Quick PDF Report Export */}
        <div className="no-print flex flex-wrap items-center gap-2">
          <div className="flex items-center border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/70 dark:bg-[#0A0B0D] p-1 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setIncludeEscalation(false)}
              className={`px-2.5 py-1 transition-all ${
                !includeEscalation
                  ? 'bg-white dark:bg-[#1C2026] text-[#111214] dark:text-[#F3F4F6] shadow-sm'
                  : 'text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111214] dark:hover:text-[#F3F4F6]'
              }`}
            >
              Flat Tariff
            </button>
            <button
              type="button"
              onClick={() => setIncludeEscalation(true)}
              className={`px-2.5 py-1 transition-all ${
                includeEscalation
                  ? 'bg-white dark:bg-[#1C2026] text-[#0F62FE] dark:text-sky-400 shadow-sm'
                  : 'text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111214] dark:hover:text-[#F3F4F6]'
              }`}
              title="Includes +4%/yr electricity tariff escalation and realistic annual O&M costs"
            >
              +4%/yr Tariff &amp; O&amp;M
            </button>
          </div>

          <button
            type="button"
            onClick={onExportPdf}
            className="flex items-center gap-1.5 bg-[#0F62FE] hover:bg-[#0050E6] dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 px-3 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>Export PDF Report</span>
          </button>
        </div>
      </div>

      {/* Primary 4-Column Financial ROI Bento Sub-Grid */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Metric 1: Micro-Wind Annual ROI & 20-Yr Net Return */}
        <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-white/75 dark:bg-[#0A0B0D]/80 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[#52565E] dark:text-[#9CA3AF]">
            <span>Micro-Wind Annual ROI</span>
            <TrendingUp
              className={`h-4 w-4 ${
                financials.windAnnualRoiPct >= 8
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : financials.windAnnualRoiPct >= 4
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className={`font-mono-tabular text-2xl font-extrabold tracking-tight ${
                financials.windAnnualRoiPct >= 8
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : financials.windAnnualRoiPct >= 4
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {financials.windAnnualRoiPct.toFixed(1)}%
            </span>
            <span className="text-[11px] font-semibold text-[#52565E] dark:text-[#9CA3AF]">per year</span>
          </div>
          <div className="mt-3 space-y-1 border-t border-[#D4D4CE] dark:border-[#22252A] pt-2.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-[#52565E] dark:text-[#9CA3AF]">20-Yr Total ROI:</span>
              <span
                className={`font-mono-tabular font-bold ${
                  financials.wind20YrTotalRoiPct >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {financials.wind20YrTotalRoiPct >= 0 ? '+' : ''}
                {financials.wind20YrTotalRoiPct.toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#52565E] dark:text-[#9CA3AF]">20-Yr Net P&amp;L:</span>
              <span
                className={`font-mono-tabular font-bold ${
                  financials.wind20YrNetProfitInr >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {financials.wind20YrNetProfitInr >= 0 ? '+₹' : '-₹'}
                {Math.abs(financials.wind20YrNetProfitInr).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Metric 2: Micro-Wind Payback Period & LCOE */}
        <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-white/75 dark:bg-[#0A0B0D]/80 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[#52565E] dark:text-[#9CA3AF]">
            <span>Wind Payback Period</span>
            <Clock className="h-4 w-4 text-[#0F62FE] dark:text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className={`font-mono-tabular text-2xl font-extrabold tracking-tight ${
                windBreaksEvenInLifespan ? 'text-[#111214] dark:text-[#F3F4F6]' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatPaybackPeriod(financials.effectiveWindPayback, 'short')}
            </span>
          </div>
          <div className="mt-3 space-y-1 border-t border-[#D4D4CE] dark:border-[#22252A] pt-2.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-[#52565E] dark:text-[#9CA3AF]">Break-Even Status:</span>
              <span
                className={`font-semibold ${
                  windBreaksEvenInLifespan ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {windBreaksEvenInLifespan ? 'Within 20-Yr Life' : 'Exceeds Hardware Life'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#52565E] dark:text-[#9CA3AF]">Wind 20-Yr LCOE:</span>
              <span className="font-mono-tabular font-bold text-[#111214] dark:text-[#F3F4F6]">
                {financials.windLcoeInr !== null &&
                Number.isFinite(financials.windLcoeInr) &&
                financials.windLcoeInr < 999
                  ? `₹${financials.windLcoeInr.toFixed(2)}/kWh`
                  : 'N/A (No Output)'}
              </span>
            </div>
          </div>
        </div>

        {/* Metric 3: Same-Budget Solar Annual ROI & Payback */}
        <div className="border border-emerald-500/35 bg-emerald-500/5 dark:bg-emerald-500/10 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <span>Same-Budget Solar ROI</span>
            <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono-tabular text-2xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400">
              {financials.solarAnnualRoiPct.toFixed(1)}%
            </span>
            <span className="font-mono-tabular bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
              {formatPaybackPeriod(financials.effectiveSolarPayback, 'short')} payback
            </span>
          </div>
          <div className="mt-3 space-y-1 border-t border-emerald-500/20 pt-2.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-emerald-900/75 dark:text-emerald-200/75">20-Yr Net Profit:</span>
              <span className="font-mono-tabular font-extrabold text-emerald-700 dark:text-emerald-400">
                {financials.solar20YrNetProfitInr >= 0 ? '+₹' : '-₹'}
                {Math.abs(financials.solar20YrNetProfitInr).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-emerald-900/75 dark:text-emerald-200/75">Solar 20-Yr LCOE:</span>
              <span className="font-mono-tabular font-bold text-emerald-800 dark:text-emerald-300">
                {financials.solarLcoeInr !== null && Number.isFinite(financials.solarLcoeInr)
                  ? `₹${financials.solarLcoeInr.toFixed(2)}/kWh`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Metric 4: 20-Year Opportunity Cost (Solar Advantage) */}
        <div className="border border-[#0F62FE]/35 dark:border-sky-400/35 bg-sky-500/5 dark:bg-sky-500/10 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[#111214] dark:text-[#D1D5DB]">
            <span>20-Yr Solar Wealth Delta</span>
            <Scale className="h-4 w-4 text-[#0F62FE] dark:text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-mono-tabular text-2xl font-extrabold tracking-tight text-[#111214] dark:text-[#F3F4F6]">
              +₹{financials.opportunityCost20YrInr.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="mt-3 space-y-1 border-t border-[#D4D4CE] dark:border-[#22252A] pt-2.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-[#52565E] dark:text-[#9CA3AF]">Solar Annual Savings:</span>
              <span className="font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400">
                ₹{audit.solarAnnualSavingsInr.toLocaleString('en-IN')}/yr
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#52565E] dark:text-[#9CA3AF]">Wind Annual Savings:</span>
              <span className="font-mono-tabular font-bold text-[#0F62FE] dark:text-sky-400">
                ₹{audit.annualSavingsInr.toLocaleString('en-IN')}/yr
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Break-Even Timeline & 5/10/15/20 Year Cash-Flow Table */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left 6 cols: Visual 20-Year Break-Even Timeline Bars */}
        <div className="flex flex-col justify-between border border-[#D4D4CE] dark:border-[#22252A] bg-white/80 dark:bg-[#0A0B0D] p-4 lg:col-span-6">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#111214] dark:text-[#F3F4F6]">
                20-Year Capital Recovery &amp; Break-Even Timeline
              </span>
              <span className="font-mono-tabular text-[11px] font-semibold text-[#52565E] dark:text-[#9CA3AF]">
                Design Life: 20 Yrs
              </span>
            </div>

            {/* Micro-Wind Payback Timeline Bar */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-[#111214] dark:text-[#D1D5DB]">
                  Micro-Wind ({config.ratedPowerW}W @ {config.hubHeightM}m)
                </span>
                <span
                  className={`font-mono-tabular font-bold ${
                    windBreaksEvenInLifespan ? 'text-[#0F62FE] dark:text-sky-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {financials.effectiveWindPayback !== null &&
                  financials.effectiveWindPayback > 0 &&
                  financials.effectiveWindPayback <= 50
                    ? `Breaks even in Year ${financials.effectiveWindPayback.toFixed(1)}`
                    : 'Never pays back (>50 years)'}
                </span>
              </div>
              <div className="relative h-3 w-full overflow-hidden bg-[#ECECE6] dark:bg-[#161A20] border border-[#D4D4CE] dark:border-[#22252A]">
                <div
                  className={`h-full transition-all duration-300 ${
                    windBreaksEvenInLifespan
                      ? 'bg-[#0F62FE] dark:bg-sky-400'
                      : 'bg-rose-500/80'
                  }`}
                  style={{ width: `${windPaybackBarPct}%` }}
                />
              </div>
            </div>

            {/* Same-Budget Solar Payback Timeline Bar */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-[#111214] dark:text-[#D1D5DB]">
                  Same-Budget Rooftop Solar ({audit.solarEquivalentKw.toFixed(2)} kW)
                </span>
                <span className="font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400">
                  {financials.effectiveSolarPayback !== null &&
                  financials.effectiveSolarPayback > 0 &&
                  financials.effectiveSolarPayback <= 50
                    ? `Breaks even in Year ${financials.effectiveSolarPayback.toFixed(1)} (${Math.max(
                        0,
                        LIFESPAN_YEARS - financials.effectiveSolarPayback
                      ).toFixed(1)} yrs pure profit)`
                    : 'Never pays back (>50 years)'}
                </span>
              </div>
              <div className="relative h-3 w-full overflow-hidden bg-[#ECECE6] dark:bg-[#161A20] border border-[#D4D4CE] dark:border-[#22252A]">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${solarPaybackBarPct}%` }}
                />
              </div>
              <div className="font-mono-tabular mt-1.5 flex justify-between text-[10px] text-[#52565E] dark:text-[#9CA3AF]">
                <span>Yr 0 (CapEx ₹{config.budgetInr.toLocaleString('en-IN')})</span>
                <span>Yr 5</span>
                <span>Yr 10</span>
                <span>Yr 15</span>
                <span>Yr 20 (End of Life)</span>
              </div>
            </div>
          </div>

          {/* Bottom Callout Strip */}
          <div
            className={`mt-4 flex items-start gap-2.5 border p-3 text-xs ${
              windBreaksEvenInLifespan
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
                : 'border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-200'
            }`}
          >
            {windBreaksEvenInLifespan ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <p className="leading-relaxed">
              {windBreaksEvenInLifespan ? (
                <>
                  <strong>Viable Wind Recovery:</strong> At ₹{config.tariffInr.toFixed(2)}/kWh, this wind turbine recovers its ₹
                  {config.budgetInr.toLocaleString('en-IN')} CapEx in{' '}
                  <strong className="font-mono-tabular">
                    {formatPaybackPeriod(financials.effectiveWindPayback, 'long')}
                  </strong>
                  {financials.effectiveSolarPayback !== null &&
                    financials.effectiveWindPayback !== null &&
                    financials.effectiveWindPayback > financials.effectiveSolarPayback && (
                      <>
                        . However, same-budget solar still pays back{' '}
                        <strong className="font-mono-tabular">
                          {(
                            financials.effectiveWindPayback /
                            Math.max(0.1, financials.effectiveSolarPayback)
                          ).toFixed(1)}
                          x faster
                        </strong>
                      </>
                    )}
                  .
                </>
              ) : (
                <>
                  <strong>Capital Loss Warning:</strong> At ₹{config.tariffInr.toFixed(2)}/kWh, annual wind savings of{' '}
                  <strong className="font-mono-tabular">
                    ₹{audit.annualSavingsInr.toLocaleString('en-IN')}/yr
                  </strong>{' '}
                  cannot pay back the ₹{config.budgetInr.toLocaleString('en-IN')} investment before the 20-year turbine replacement cycle.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Right 6 cols: Cumulative Net Cash Flow Milestones (Yr 5, 10, 15, 20) */}
        <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-white/80 dark:bg-[#0A0B0D] p-4 lg:col-span-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#111214] dark:text-[#F3F4F6]">
              Cumulative Net Profit Milestones (Savings minus ₹{config.budgetInr.toLocaleString('en-IN')} CapEx)
            </span>
            <IndianRupee className="h-3.5 w-3.5 text-[#52565E] dark:text-[#9CA3AF]" />
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#D4D4CE] dark:border-[#22252A] text-[11px] font-bold uppercase tracking-wider text-[#52565E] dark:text-[#9CA3AF]">
                  <th className="pb-2">Horizon</th>
                  <th className="pb-2 text-right text-[#0F62FE] dark:text-sky-400">Micro-Wind Net</th>
                  <th className="pb-2 text-right text-emerald-700 dark:text-emerald-400">Same-Budget Solar Net</th>
                  <th className="pb-2 text-right text-[#111214] dark:text-[#F3F4F6]">Solar Advantage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4D4CE]/60 dark:divide-[#22252A] font-mono-tabular">
                {financials.milestoneYears.map((row) => {
                  const delta = row.solarNetInr - row.windNetInr;
                  return (
                    <tr key={row.year} className="hover:bg-[#ECECE6]/40 dark:hover:bg-[#161A20]/60">
                      <td className="py-2.5 font-sans font-bold text-[#111214] dark:text-[#D1D5DB]">
                        Year {row.year}
                      </td>
                      <td
                        className={`py-2.5 text-right font-bold whitespace-nowrap ${
                          row.windNetInr >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {row.windNetInr >= 0 ? '+₹' : '-₹'}
                        {Math.abs(row.windNetInr).toLocaleString('en-IN')}
                      </td>
                      <td
                        className={`py-2.5 text-right font-bold whitespace-nowrap ${
                          row.solarNetInr >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {row.solarNetInr >= 0 ? '+₹' : '-₹'}
                        {Math.abs(row.solarNetInr).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 text-right font-extrabold text-[#111214] dark:text-[#F3F4F6] whitespace-nowrap">
                        +₹{Math.max(0, delta).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-2.5 text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
            * Net values represent cumulative electricity bill savings minus initial ₹
            {config.budgetInr.toLocaleString('en-IN')} outlay{' '}
            {includeEscalation
              ? '(modeled with +4%/yr tariff escalation and annual O&M).'
              : '(modeled at constant current tariff).'}
          </p>
        </div>
      </div>
    </section>
  );
};
