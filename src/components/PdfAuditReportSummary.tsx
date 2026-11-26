import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  FileDown,
  CheckCircle2,
  X,
  Trophy,
  Zap,
  TrendingUp,
  Clock,
  IndianRupee,
  BarChart3
} from 'lucide-react';
import { AuditConfig, AuditResult, TERRAIN_PROFILES, formatPaybackPeriod } from '../physics';
import { computeWinnerAnalysis } from '../utils/exportAuditPdf';

interface PdfAuditReportSummaryProps {
  siteName: string;
  lat: number;
  lon: number;
  config: AuditConfig;
  audit: AuditResult;
  dataSource: 'live' | 'offline_fallback';
  isModalOpen?: boolean;
  lastDownloadedFileName?: string | null;
  chart1Url?: string | null;
  chart2Url?: string | null;
  onCloseModal?: () => void;
  onRedownloadPdf?: () => void;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const PdfAuditReportSummary: React.FC<PdfAuditReportSummaryProps> = ({
  siteName,
  lat,
  lon,
  config,
  audit,
  dataSource,
  isModalOpen = false,
  lastDownloadedFileName = null,
  chart1Url = null,
  chart2Url = null,
  onCloseModal,
  onRedownloadPdf
}) => {
  const terrainProfile = TERRAIN_PROFILES[config.terrain] || TERRAIN_PROFILES.urban;
  const analysis = computeWinnerAnalysis(audit, config);

  const reportDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const renderReportBody = () => (
    <div className="space-y-5 text-slate-900">
      {/* Executive PDF Report Banner */}
      <div className="flex flex-col justify-between gap-3 border-b-2 border-slate-800 pb-4 sm:flex-row sm:items-start">
        <div>
          <p className="font-mono-tabular text-[10px] font-bold uppercase tracking-widest text-cyan-800">
            AERODYNAMIC &amp; FINANCIAL SITE AUDIT REPORT · 8,760-HOUR SIMULATION
          </p>
          <h1 className="font-display mt-1 text-lg font-extrabold text-slate-950 sm:text-xl">
            Micro-Wind Turbine vs. Same-Budget Rooftop Solar — Complete Site Audit
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-600">
            Audited Location: <strong className="text-slate-900">{siteName}</strong> (
            {lat.toFixed(4)}°N, {lon.toFixed(4)}°E)
          </p>
        </div>
        <div className="font-mono-tabular text-xs sm:text-right">
          <div className="inline-block rounded-md border border-slate-400 bg-slate-100 px-2.5 py-1 font-bold text-slate-900">
            WIND VERDICT: {audit.verdict.status}
          </div>
          <p className="mt-1 text-[11px] text-slate-600">Date: {reportDate}</p>
          <p className="text-[10px] text-slate-500">
            Telemetry: {dataSource === 'live' ? 'Open-Meteo 2025 Hourly (8,760 hrs)' : 'Reference Weather Dataset'}
          </p>
        </div>
      </div>

      {/* SECTION 1: WHAT WILL BE BEST & BY HOW MUCH (WINNER RECOMMENDATION HERO) */}
      <div className="rounded-2xl border-2 border-amber-400 bg-amber-50/90 p-4 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-900">
          <Trophy className="h-4 w-4 text-amber-600" />
          <span>1. Executive Recommendation — What Will Be Best &amp; By How Much</span>
        </div>

        <h2 className="mt-1.5 font-display text-base font-extrabold text-slate-950 sm:text-lg">
          {analysis.headline}
        </h2>

        <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
          {analysis.detailedExplanation}
        </p>

        {/* 4 Quantitative Advantage Cards */}
        <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-amber-300 bg-white p-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-500">
              <span>Energy Advantage</span>
              <Zap className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div className="mt-1 font-mono-tabular text-base font-extrabold text-slate-900">
              {analysis.energyRatioText}
            </div>
            <div className="font-mono-tabular text-[11px] font-semibold text-amber-800">
              +{analysis.extraAnnualKwh.toLocaleString('en-IN')} kWh/year extra
            </div>
          </div>

          <div className="rounded-xl border border-amber-300 bg-white p-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-500">
              <span>Annual Bill Savings Gain</span>
              <IndianRupee className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="mt-1 font-mono-tabular text-base font-extrabold text-emerald-800">
              +₹{analysis.extraAnnualSavingsInr.toLocaleString('en-IN')}/yr
            </div>
            <div className="font-mono-tabular text-[11px] font-semibold text-slate-600">
              @ ₹{config.tariffInr.toFixed(2)}/kWh tariff
            </div>
          </div>

          <div className="rounded-xl border border-amber-300 bg-white p-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-500">
              <span>20-Yr Net Profit Gain</span>
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="mt-1 font-mono-tabular text-base font-extrabold text-emerald-800">
              +₹{analysis.extra20YrProfitInr.toLocaleString('en-IN')}
            </div>
            <div className="font-mono-tabular text-[11px] font-semibold text-slate-600">
              After ₹{config.budgetInr.toLocaleString('en-IN')} CapEx
            </div>
          </div>

          <div className="rounded-xl border border-amber-300 bg-white p-3">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-500">
              <span>Payback Speed Advantage</span>
              <Clock className="h-3.5 w-3.5 text-cyan-600" />
            </div>
            <div className="mt-1 font-mono-tabular text-base font-extrabold text-slate-900">
              {formatPaybackPeriod(audit.solarPaybackYears, 'short')} (Solar)
            </div>
            <div className="font-mono-tabular text-[11px] font-semibold text-rose-700">
              Wind: {formatPaybackPeriod(audit.paybackYears, 'short')}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: EMBEDDED GRAPHS (12-MONTH BAR CHART + 20-YR CASH FLOW & WIND HISTOGRAM) */}
      {(chart1Url || chart2Url) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-700">
            <BarChart3 className="h-4 w-4 text-cyan-600" />
            <span>2. Embedded PDF Graphs — Monthly Generation, 20-Year ROI Trajectory &amp; Wind Histogram</span>
          </div>
          {chart1Url && (
            <div className="overflow-hidden rounded-xl border border-slate-300 bg-white p-2">
              <img
                src={chart1Url}
                alt="12-Month Energy Generation Comparison Bar Chart"
                className="w-full h-auto object-contain"
              />
            </div>
          )}
          {chart2Url && (
            <div className="overflow-hidden rounded-xl border border-slate-300 bg-white p-2">
              <img
                src={chart2Url}
                alt="20-Year Cumulative Cash Flow and Wind Speed Histogram"
                className="w-full h-auto object-contain"
              />
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: SYSTEM CONFIGURATION & BOUNDARY LAYER PARAMETERS */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-300 bg-slate-50 p-3.5 text-xs sm:grid-cols-3">
        <div>
          <span className="block text-[10px] font-bold uppercase text-slate-500">
            Turbine Hardware &amp; Velocities
          </span>
          <span className="font-mono-tabular mt-0.5 block font-bold text-slate-900">
            {config.ratedPowerW} W Rated · Ø {config.rotorDiameterM.toFixed(1)} m Rotor ({audit.sweptAreaM2.toFixed(2)} m²)
          </span>
          <span className="font-mono-tabular block text-[11px] text-slate-600">
            10m Mean: {audit.avgWindSpeed10mMs.toFixed(2)} m/s → Hub: {audit.avgWindSpeedMs.toFixed(2)} m/s
          </span>
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase text-slate-500">
            Hub Height &amp; Shear Model
          </span>
          <span className="font-mono-tabular mt-0.5 block font-bold text-slate-900">
            {config.hubHeightM} m ({(config.hubHeightM * 3.28084).toFixed(0)} ft) ·{' '}
            {audit.shearModel === 'logarithmic'
              ? `Log Law z₀ = ${audit.z0}m`
              : `Power Law α = ${audit.alpha.toFixed(2)}`}{' '}
            (Shear ×{audit.shearMultiplier.toFixed(3)})
          </span>
          <span className="block text-[10px] text-slate-500">
            {terrainProfile.label.split(' (')[0]}
          </span>
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase text-slate-500">
            Financial Baseline &amp; Dead-Zone
          </span>
          <span className="font-mono-tabular mt-0.5 block font-bold text-slate-900">
            CapEx: ₹{config.budgetInr.toLocaleString('en-IN')} · Tariff: ₹{config.tariffInr.toFixed(2)}/kWh
          </span>
          <span className="block text-[10px] text-rose-700 font-semibold">
            &lt;{audit.cutInSpeedMs.toFixed(1)} m/s Cut-In Stall: {audit.pctBelowCutIn.toFixed(1)}% ({audit.hoursBelowCutIn.toLocaleString('en-IN')} hrs/yr @ 0 W)
          </span>
        </div>
      </div>

      {/* SECTION 4: HEAD-TO-HEAD TECHNICAL & FINANCIAL TABLE */}
      <div>
        <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-700">
          3. Complete Head-to-Head Technical &amp; Financial Audit Table
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-slate-300 text-left text-xs">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100 text-[11px] font-bold uppercase text-slate-700">
                <th className="border-r border-slate-300 px-3 py-2">Audit Metric</th>
                <th className="border-r border-slate-300 px-3 py-2 text-right">
                  Micro-Wind Turbine ({config.ratedPowerW}W)
                </th>
                <th className="border-r border-slate-300 px-3 py-2 text-right">
                  Same-Budget Rooftop Solar ({audit.solarEquivalentKw.toFixed(2)} kW)
                </th>
                <th className="px-3 py-2 text-right">Winner &amp; Exact Advantage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono-tabular">
              <tr>
                <td className="border-r border-slate-300 px-3 py-1.5 font-sans font-semibold text-slate-700">
                  Annual Energy Yield (kWh/yr)
                </td>
                <td className="border-r border-slate-300 px-3 py-1.5 text-right font-bold text-cyan-800">
                  {audit.annualWindKwh.toLocaleString('en-IN')} kWh
                </td>
                <td className="border-r border-slate-300 px-3 py-1.5 text-right font-bold text-amber-800">
                  {audit.annualSolarKwh.toLocaleString('en-IN')} kWh
                </td>
                <td className="px-3 py-1.5 text-right font-bold text-slate-900">
                  +{analysis.extraAnnualKwh.toLocaleString('en-IN')} kWh/yr ({analysis.energyRatioText})
                </td>
              </tr>
              <tr>
                <td className="border-r border-slate-300 px-3 py-1.5 font-sans font-semibold text-slate-700">
                  Annual Bill Savings (@ ₹{config.tariffInr.toFixed(2)}/kWh)
                </td>
                <td className="border-r border-slate-300 px-3 py-1.5 text-right font-bold text-slate-900">
                  ₹{audit.annualSavingsInr.toLocaleString('en-IN')}/yr
                </td>
                <td className="border-r border-slate-300 px-3 py-1.5 text-right font-bold text-emerald-800">
                  ₹{audit.solarAnnualSavingsInr.toLocaleString('en-IN')}/yr
                </td>
                <td className="px-3 py-1.5 text-right font-bold text-emerald-800">
                  +₹{analysis.extraAnnualSavingsInr.toLocaleString('en-IN')}/yr
                </td>
              </tr>
              <tr>
                <td className="border-r border-slate-300 px-3 py-1.5 font-sans font-semibold text-slate-700">
                  Simple Annual ROI (%)
                </td>
                <td className="border-r border-slate-300 px-3 py-1.5 text-right font-bold text-slate-900">
                  {analysis.windAnnualRoiPct.toFixed(1)}%/yr
                </td>
                <td className="border-r border-slate-300 px-3 py-1.5 text-right font-bold text-slate-900">
                  {analysis.solarAnnualRoiPct.toFixed(1)}%/yr
                </td>
                <td className="px-3 py-1.5 text-right font-bold text-slate-900">
                  +{Math.abs(analysis.solarAnnualRoiPct - analysis.windAnnualRoiPct).toFixed(1)}% annual return
                </td>
              </tr>
              <tr>
                <td className="border-r border-slate-300 px-3 py-1.5 font-sans font-semibold text-slate-700">
                  Simple Payback Period (Years)
                </td>
                <td className="border-r border-slate-300 px-3 py-1.5 text-right font-bold text-rose-700">
                  {formatPaybackPeriod(audit.paybackYears, 'long')}
                </td>
                <td className="border-r border-slate-300 px-3 py-1.5 text-right font-bold text-emerald-800">
                  {formatPaybackPeriod(audit.solarPaybackYears, 'long')}
                </td>
                <td className="px-3 py-1.5 text-right font-bold text-slate-900">
                  {analysis.paybackAdvantageText}
                </td>
              </tr>
              <tr>
                <td className="border-r border-slate-300 px-3 py-1.5 font-sans font-semibold text-slate-700">
                  20-Year Cumulative Net Profit (after CapEx)
                </td>
                <td className="border-r border-slate-300 px-3 py-1.5 text-right font-bold text-slate-900">
                  {analysis.wind20YrNetInr >= 0 ? '+₹' : '-₹'}
                  {Math.abs(analysis.wind20YrNetInr).toLocaleString('en-IN')}
                </td>
                <td className="border-r border-slate-300 px-3 py-1.5 text-right font-bold text-emerald-800">
                  {analysis.solar20YrNetInr >= 0 ? '+₹' : '-₹'}
                  {Math.abs(analysis.solar20YrNetInr).toLocaleString('en-IN')}
                </td>
                <td className="px-3 py-1.5 text-right font-bold text-emerald-800">
                  +₹{analysis.extra20YrProfitInr.toLocaleString('en-IN')} net gain
                </td>
              </tr>
              <tr>
                <td className="border-r border-slate-300 px-3 py-1.5 font-sans font-semibold text-slate-700">
                  20-Year Levelized Cost of Energy (LCOE)
                </td>
                <td className="border-r border-slate-300 px-3 py-1.5 text-right font-bold text-slate-900">
                  {analysis.windLcoeText}
                </td>
                <td className="border-r border-slate-300 px-3 py-1.5 text-right font-bold text-slate-900">
                  {analysis.solarLcoeText}
                </td>
                <td className="px-3 py-1.5 text-right font-bold text-slate-900">
                  Grid Tariff: ₹{config.tariffInr.toFixed(2)}/kWh
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 5: 12-MONTH BREAKDOWN TABLE */}
      <div>
        <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-700">
          4. 12-Month Generation Breakdown (Jan – Dec)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-slate-300 text-center text-[11px] font-mono-tabular">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-700">
                <th className="border border-slate-300 px-2 py-1.5 text-left">System</th>
                {MONTH_LABELS.map((m) => (
                  <th key={m} className="border border-slate-300 px-1.5 py-1.5">
                    {m}
                  </th>
                ))}
                <th className="border border-slate-300 px-2 py-1.5">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-300 px-2 py-1.5 text-left font-sans font-bold text-cyan-800">
                  Wind (kWh)
                </td>
                {audit.monthlyWindKwh.map((v, i) => (
                  <td key={i} className="border border-slate-300 px-1.5 py-1.5 text-cyan-900">
                    {v}
                  </td>
                ))}
                <td className="border border-slate-300 px-2 py-1.5 font-bold text-cyan-950">
                  {audit.annualWindKwh.toLocaleString('en-IN')}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-2 py-1.5 text-left font-sans font-bold text-amber-800">
                  Solar (kWh)
                </td>
                {audit.monthlySolarKwh.map((v, i) => (
                  <td key={i} className="border border-slate-300 px-1.5 py-1.5 text-amber-900">
                    {v}
                  </td>
                ))}
                <td className="border border-slate-300 px-2 py-1.5 font-bold text-amber-950">
                  {audit.annualSolarKwh.toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Print-Only Sheet */}
      <div className="print-only hidden mb-6 rounded-2xl border-2 border-slate-800 bg-white p-6 text-slate-900">
        {renderReportBody()}
      </div>

      {/* Interactive PDF Audit Report Preview & Direct Download Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            key="pdf-report-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-xs sm:p-6"
            onClick={onCloseModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Sticky Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-5 py-3.5 text-white">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-xs font-extrabold tracking-wide text-white">
                      2-Page Executive PDF Report Generated &amp; Downloaded
                    </div>
                    {lastDownloadedFileName && (
                      <div className="font-mono-tabular text-[11px] text-cyan-300">
                        File: {lastDownloadedFileName}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onRedownloadPdf && (
                    <button
                      type="button"
                      onClick={onRedownloadPdf}
                      className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-cyan-500"
                    >
                      <FileDown className="h-4 w-4" />
                      <span>Download PDF Again (.pdf)</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onCloseModal}
                    className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                    aria-label="Close PDF preview"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Report Preview Content */}
              <div className="overflow-y-auto p-5 sm:p-7">
                {renderReportBody()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
