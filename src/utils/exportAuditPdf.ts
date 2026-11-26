import { jsPDF } from 'jspdf';
import { AuditConfig, AuditResult, TERRAIN_PROFILES, formatPaybackPeriod } from '../physics';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface WinnerAnalysis {
  winner: 'SOLAR' | 'WIND';
  winnerTitle: string;
  loserTitle: string;
  headline: string;
  energyRatioText: string;
  extraAnnualKwh: number;
  extraAnnualSavingsInr: number;
  extra20YrProfitInr: number;
  paybackAdvantageText: string;
  windAnnualRoiPct: number;
  solarAnnualRoiPct: number;
  wind20YrNetInr: number;
  solar20YrNetInr: number;
  windLcoeText: string;
  solarLcoeText: string;
  detailedExplanation: string;
}

/**
 * Computes a complete "What is Best and By How Much" engineering & financial comparison summary
 */
export function computeWinnerAnalysis(audit: AuditResult, config: AuditConfig): WinnerAnalysis {
  const windAnnualRoiPct =
    config.budgetInr > 0 ? (audit.annualSavingsInr / config.budgetInr) * 100 : 0;
  const solarAnnualRoiPct =
    config.budgetInr > 0 ? (audit.solarAnnualSavingsInr / config.budgetInr) * 100 : 0;

  const wind20YrNetInr = audit.annualSavingsInr * 20 - config.budgetInr;
  const solar20YrNetInr = audit.solarAnnualSavingsInr * 20 - config.budgetInr;

  const windLcoeText =
    audit.annualWindKwh > 0
      ? `Rs. ${(config.budgetInr / (audit.annualWindKwh * 20)).toFixed(2)}/kWh`
      : 'N/A (0 kWh)';
  const solarLcoeText =
    audit.annualSolarKwh > 0
      ? `Rs. ${(config.budgetInr / (audit.annualSolarKwh * 20)).toFixed(2)}/kWh`
      : 'N/A (0 kWh)';

  const solarPaybackFmt = formatPaybackPeriod(audit.solarPaybackYears, 'short');
  const windPaybackFmt = formatPaybackPeriod(audit.paybackYears, 'short');

  const solarWins = audit.annualSolarKwh >= audit.annualWindKwh;

  if (solarWins) {
    const ratioText =
      audit.solarToWindRatio >= 100
        ? '100+x'
        : `${audit.solarToWindRatio.toFixed(1)}x`;
    const extraAnnualKwh = Math.max(0, audit.annualSolarKwh - audit.annualWindKwh);
    const extraAnnualSavingsInr = Math.max(
      0,
      audit.solarAnnualSavingsInr - audit.annualSavingsInr
    );
    const extra20YrProfitInr = Math.max(0, solar20YrNetInr - wind20YrNetInr);

    let paybackAdvantageText: string;
    if (audit.solarPaybackYears === null || audit.solarPaybackYears > 50) {
      paybackAdvantageText = `Solar: ${solarPaybackFmt} vs Wind: ${windPaybackFmt}`;
    } else if (audit.paybackYears === null || audit.paybackYears > 50) {
      paybackAdvantageText = `Solar pays back in ${audit.solarPaybackYears.toFixed(1)} yrs (Wind never pays back in 50 yrs)`;
    } else {
      const fasterYrs = Math.max(0, audit.paybackYears - audit.solarPaybackYears);
      paybackAdvantageText = `Solar pays back ${fasterYrs.toFixed(1)} years faster (${audit.solarPaybackYears.toFixed(1)} yrs vs ${audit.paybackYears.toFixed(1)} yrs)`;
    }

    return {
      winner: 'SOLAR',
      winnerTitle: `Same-Budget Rooftop Solar PV (${audit.solarEquivalentKw.toFixed(2)} kWp)`,
      loserTitle: `Micro-Wind Turbine (${config.ratedPowerW} W @ ${config.hubHeightM}m)`,
      headline: `BEST OPTION: SAME-BUDGET ROOFTOP SOLAR PV (${audit.solarEquivalentKw.toFixed(2)} kWp) — Outperforms Micro-Wind by ${ratioText}`,
      energyRatioText: `${ratioText} More Electricity`,
      extraAnnualKwh,
      extraAnnualSavingsInr,
      extra20YrProfitInr,
      paybackAdvantageText,
      windAnnualRoiPct,
      solarAnnualRoiPct,
      wind20YrNetInr,
      solar20YrNetInr,
      windLcoeText,
      solarLcoeText,
      detailedExplanation: `For the exact same capital budget of Rs. ${config.budgetInr.toLocaleString('en-IN')}, installing ${audit.solarEquivalentKw.toFixed(2)} kWp of rooftop solar PV generates ${audit.annualSolarKwh.toLocaleString('en-IN')} kWh/year compared to only ${audit.annualWindKwh.toLocaleString('en-IN')} kWh/year from the ${config.ratedPowerW}W micro-wind turbine (+${extraAnnualKwh.toLocaleString('en-IN')} kWh/yr advantage). Because hub wind speed averages ${audit.avgWindSpeedMs.toFixed(2)} m/s and remains trapped below the ${audit.cutInSpeedMs.toFixed(1)} m/s cut-in stall threshold for ${audit.pctBelowCutIn.toFixed(1)}% of the year (${audit.hoursBelowCutIn.toLocaleString('en-IN')} hrs), solar delivers +Rs. ${extraAnnualSavingsInr.toLocaleString('en-IN')}/yr higher bill savings and +Rs. ${extra20YrProfitInr.toLocaleString('en-IN')} greater 20-year net profit.`
    };
  } else {
    const windToSolarRatio =
      audit.annualSolarKwh > 0
        ? (audit.annualWindKwh / audit.annualSolarKwh).toFixed(1)
        : '1.0';
    const extraAnnualKwh = Math.max(0, audit.annualWindKwh - audit.annualSolarKwh);
    const extraAnnualSavingsInr = Math.max(
      0,
      audit.annualSavingsInr - audit.solarAnnualSavingsInr
    );
    const extra20YrProfitInr = Math.max(0, wind20YrNetInr - solar20YrNetInr);

    return {
      winner: 'WIND',
      winnerTitle: `Micro-Wind Turbine (${config.ratedPowerW} W @ ${config.hubHeightM}m)`,
      loserTitle: `Same-Budget Rooftop Solar PV (${audit.solarEquivalentKw.toFixed(2)} kWp)`,
      headline: `BEST OPTION: MICRO-WIND TURBINE (${config.ratedPowerW} W) — Outperforms Same-Budget Solar by ${windToSolarRatio}x`,
      energyRatioText: `${windToSolarRatio}x More Electricity`,
      extraAnnualKwh,
      extraAnnualSavingsInr,
      extra20YrProfitInr,
      paybackAdvantageText: `Wind pays back in ${windPaybackFmt} vs ${solarPaybackFmt} for Solar`,
      windAnnualRoiPct,
      solarAnnualRoiPct,
      wind20YrNetInr,
      solar20YrNetInr,
      windLcoeText,
      solarLcoeText,
      detailedExplanation: `At this high-wind corridor (${audit.avgWindSpeedMs.toFixed(2)} m/s mean hub wind speed at ${config.hubHeightM}m), the ${config.ratedPowerW}W micro-wind turbine generates ${audit.annualWindKwh.toLocaleString('en-IN')} kWh/year compared to ${audit.annualSolarKwh.toLocaleString('en-IN')} kWh/year from same-budget solar (+${extraAnnualKwh.toLocaleString('en-IN')} kWh/yr advantage), yielding +Rs. ${extraAnnualSavingsInr.toLocaleString('en-IN')}/yr extra savings and +Rs. ${extra20YrProfitInr.toLocaleString('en-IN')} higher 20-year profit.`
    };
  }
}

/**
 * Renders Graph 1: High-DPI Monthly Generation Bar Chart (Micro-Wind vs. Same-Budget Rooftop Solar)
 */
export function renderMonthlyComparisonChartDataUrl(
  audit: AuditResult,
  config: AuditConfig
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1100;
  canvas.height = 420;
  const ctx = canvas.getContext('2d')!;

  // White background with subtle border
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

  // Header Title
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(
    `GRAPH 1: 12-Month Energy Generation Comparison — Micro-Wind (${config.ratedPowerW}W) vs. Same-Budget Solar (${audit.solarEquivalentKw.toFixed(2)} kWp)`,
    28,
    36
  );

  // Legend
  ctx.fillStyle = '#0891B2';
  ctx.fillRect(28, 50, 18, 12);
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`Micro-Wind Turbine (${audit.annualWindKwh.toLocaleString('en-IN')} kWh/yr)`, 54, 61);

  ctx.fillStyle = '#D97706';
  ctx.fillRect(360, 50, 18, 12);
  ctx.fillStyle = '#334155';
  ctx.fillText(
    `Same-Budget Rooftop Solar (${audit.annualSolarKwh.toLocaleString('en-IN')} kWh/yr)`,
    386,
    61
  );

  const chartLeft = 78;
  const chartRight = canvas.width - 36;
  const chartTop = 86;
  const chartBottom = canvas.height - 52;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;

  const maxVal = Math.max(10, ...audit.monthlyWindKwh, ...audit.monthlySolarKwh) * 1.15;

  // Horizontal grid lines
  const gridSteps = 5;
  ctx.font = '12px monospace';
  for (let i = 0; i <= gridSteps; i++) {
    const val = Math.round((maxVal / gridSteps) * i);
    const y = chartBottom - (i / gridSteps) * chartHeight;

    ctx.strokeStyle = i === 0 ? '#64748B' : '#E2E8F0';
    ctx.lineWidth = i === 0 ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartRight, y);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.textAlign = 'right';
    ctx.fillText(`${val} kWh`, chartLeft - 10, y + 4);
  }

  // Draw 12 monthly bar pairs
  const groupWidth = chartWidth / 12;
  const barWidth = Math.min(26, groupWidth * 0.34);

  for (let m = 0; m < 12; m++) {
    const groupCenter = chartLeft + m * groupWidth + groupWidth / 2;
    const windVal = audit.monthlyWindKwh[m] ?? 0;
    const solarVal = audit.monthlySolarKwh[m] ?? 0;

    const windH = (windVal / maxVal) * chartHeight;
    const solarH = (solarVal / maxVal) * chartHeight;

    // Wind Bar (Cyan)
    const windX = groupCenter - barWidth - 3;
    const windY = chartBottom - windH;
    ctx.fillStyle = '#0891B2';
    ctx.fillRect(windX, windY, barWidth, Math.max(2, windH));

    // Solar Bar (Amber)
    const solarX = groupCenter + 3;
    const solarY = chartBottom - solarH;
    ctx.fillStyle = '#D97706';
    ctx.fillRect(solarX, solarY, barWidth, Math.max(2, solarH));

    // Value labels above bars
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0E7490';
    ctx.fillText(`${windVal}`, windX + barWidth / 2, Math.max(chartTop + 10, windY - 5));

    ctx.fillStyle = '#B45309';
    ctx.fillText(`${solarVal}`, solarX + barWidth / 2, Math.max(chartTop + 10, solarY - 5));

    // Month label
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#1E293B';
    ctx.fillText(MONTH_NAMES[m], groupCenter, chartBottom + 22);
  }

  // Bottom caption
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748B';
  ctx.font = '11px sans-serif';
  ctx.fillText(
    `Peak Wind Month: ${MONTH_NAMES[audit.peakSeasonSummary.peakMonthIdx]} (${audit.peakSeasonSummary.peakMonthKwh} kWh) | Southwest Monsoon Share (May-Sep): ${audit.peakSeasonSummary.monsoonWindSharePct}% of annual wind output`,
    chartLeft,
    canvas.height - 10
  );

  return canvas.toDataURL('image/png', 1.0);
}

/**
 * Renders Graph 2: 20-Year Cumulative Net Cash-Flow & Payback Breakeven Trajectory + Wind Histogram
 */
export function renderCashFlowAndHistogramDataUrl(
  audit: AuditResult,
  config: AuditConfig
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1100;
  canvas.height = 410;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

  // LEFT HALF: 20-Year Cumulative Cash Flow Curve (Year 0 to Year 20)
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('GRAPH 2A: 20-Year Cumulative Net Profit & Payback Trajectory', 24, 32);

  const leftBoxX = 76;
  const leftBoxW = 445;
  const leftBoxTop = 64;
  const leftBoxBottom = canvas.height - 48;
  const leftBoxH = leftBoxBottom - leftBoxTop;

  const years = Array.from({ length: 21 }, (_, yr) => yr);
  const windNetSeries = years.map((yr) => yr * audit.annualSavingsInr - config.budgetInr);
  const solarNetSeries = years.map((yr) => yr * audit.solarAnnualSavingsInr - config.budgetInr);

  const minNet = -config.budgetInr * 1.1;
  const maxNet = Math.max(config.budgetInr * 0.5, ...solarNetSeries, ...windNetSeries) * 1.12;
  const netRange = Math.max(1, maxNet - minNet);

  const mapY = (val: number) => leftBoxBottom - ((val - minNet) / netRange) * leftBoxH;
  const mapX = (yr: number) => leftBoxX + (yr / 20) * leftBoxW;

  // Grid lines for cash flow
  ctx.font = '10px monospace';
  for (let s = 0; s <= 4; s++) {
    const v = minNet + (netRange / 4) * s;
    const y = mapY(v);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftBoxX, y);
    ctx.lineTo(leftBoxX + leftBoxW, y);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'right';
    const kVal = Math.round(v / 1000);
    ctx.fillText(`${kVal >= 0 ? '+' : ''}Rs.${kVal}k`, leftBoxX - 6, y + 3);
  }

  // Zero Breakeven Horizontal Line
  const zeroY = mapY(0);
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(leftBoxX, zeroY);
  ctx.lineTo(leftBoxX + leftBoxW, zeroY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#0F172A';
  ctx.textAlign = 'left';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('Rs. 0 Breakeven Line', leftBoxX + 6, zeroY - 5);

  // Plot Solar Net Curve (Amber)
  ctx.strokeStyle = '#D97706';
  ctx.lineWidth = 3;
  ctx.beginPath();
  solarNetSeries.forEach((val, yr) => {
    const x = mapX(yr);
    const y = mapY(val);
    if (yr === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Plot Wind Net Curve (Cyan)
  ctx.strokeStyle = '#0891B2';
  ctx.lineWidth = 3;
  ctx.beginPath();
  windNetSeries.forEach((val, yr) => {
    const x = mapX(yr);
    const y = mapY(val);
    if (yr === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // X-axis year ticks
  ctx.fillStyle = '#334155';
  ctx.textAlign = 'center';
  ctx.font = 'bold 11px sans-serif';
  [0, 5, 10, 15, 20].forEach((yr) => {
    const x = mapX(yr);
    ctx.fillText(`Yr ${yr}`, x, leftBoxBottom + 20);
  });

  // Legend for 2A
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = '#D97706';
  ctx.fillText(
    `Solar Yr-20 Net: ${solarNetSeries[20] >= 0 ? '+' : ''}Rs.${solarNetSeries[20].toLocaleString('en-IN')}`,
    leftBoxX,
    50
  );
  ctx.fillStyle = '#0891B2';
  ctx.fillText(
    `Wind Yr-20 Net: ${windNetSeries[20] >= 0 ? '+' : ''}Rs.${windNetSeries[20].toLocaleString('en-IN')}`,
    leftBoxX + 225,
    50
  );

  // Divider between Left & Right Charts
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(552, 16);
  ctx.lineTo(552, canvas.height - 16);
  ctx.stroke();

  // RIGHT HALF: Graph 2B — 8,760-Hour Wind Speed Distribution Histogram (<3 m/s Dead Zone vs Active v³)
  const rightBoxX = 610;
  const rightBoxW = 456;
  const rightBoxTop = 64;
  const rightBoxBottom = canvas.height - 48;
  const rightBoxH = rightBoxBottom - rightBoxTop;

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    `GRAPH 2B: 8,760-Hr Wind Speed Histogram @ ${config.hubHeightM}m Hub`,
    574,
    32
  );

  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = '#E11D48';
  ctx.fillText(
    `Red = <${audit.cutInSpeedMs.toFixed(1)} m/s Dead Zone (${audit.pctBelowCutIn.toFixed(1)}% / ${audit.hoursBelowCutIn} hrs @ 0 W)`,
    574,
    50
  );
  ctx.fillStyle = '#0891B2';
  ctx.fillText(`Cyan = Active v³ Generation (${audit.hoursGenerating} hrs)`, 895, 50);

  const bins = audit.histogramBins;
  const maxBinHours = Math.max(100, ...bins.map((b) => b.hours)) * 1.15;

  // Grid lines
  ctx.font = '10px monospace';
  for (let s = 0; s <= 4; s++) {
    const hVal = Math.round((maxBinHours / 4) * s);
    const y = rightBoxBottom - (s / 4) * rightBoxH;
    ctx.strokeStyle = s === 0 ? '#64748B' : '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rightBoxX, y);
    ctx.lineTo(rightBoxX + rightBoxW, y);
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'right';
    ctx.fillText(`${hVal}h`, rightBoxX - 5, y + 3);
  }

  const binSlotW = rightBoxW / bins.length;
  const binBarW = binSlotW * 0.72;

  bins.forEach((bin, idx) => {
    const x = rightBoxX + idx * binSlotW + (binSlotW - binBarW) / 2;
    const h = (bin.hours / maxBinHours) * rightBoxH;
    const y = rightBoxBottom - h;

    ctx.fillStyle = bin.isBelowCutIn ? '#F43F5E' : '#0891B2';
    ctx.fillRect(x, y, binBarW, Math.max(2, h));

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    const shortBinLabel = idx === 12 ? '12+' : `${idx}-${idx + 1}`;
    ctx.fillText(shortBinLabel, x + binBarW / 2, rightBoxBottom + 16);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748B';
  ctx.font = '11px sans-serif';
  ctx.fillText(
    `Hub Wind Velocity Bins (m/s) — Cut-In Gate at ${audit.cutInSpeedMs.toFixed(1)} m/s`,
    rightBoxX + rightBoxW / 2,
    canvas.height - 12
  );

  return canvas.toDataURL('image/png', 1.0);
}

/**
 * Generates and downloads a comprehensive 2-Page Executive PDF Site Audit Report
 * showing What Is Best, By How Much, All Site/Physics/Financial Telemetry, and Embedded Graphs.
 */
export function generateAndDownloadAuditPdf(params: {
  siteName: string;
  lat: number;
  lon: number;
  config: AuditConfig;
  audit: AuditResult;
  dataSource: 'live' | 'offline_fallback';
}): { fileName: string; chart1Url: string; chart2Url: string; analysis: WinnerAnalysis } {
  const { siteName, lat, lon, config, audit, dataSource } = params;
  const analysis = computeWinnerAnalysis(audit, config);
  const terrainProfile = TERRAIN_PROFILES[config.terrain] || TERRAIN_PROFILES.urban;
  const chart1Url = renderMonthlyComparisonChartDataUrl(audit, config);
  const chart2Url = renderCashFlowAndHistogramDataUrl(audit, config);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageW = 210;
  const margin = 12;
  const contentW = pageW - margin * 2;
  const reportDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // =========================================================================
  // PAGE 1: EXECUTIVE VERDICT, WHAT IS BEST & BY HOW MUCH, TELEMETRY & GRAPH 1
  // =========================================================================

  // Top Header Banner
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, pageW, 28, 'F');

  doc.setTextColor(6, 182, 212); // Cyan-500
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(
    'MICRO-WIND TURBINE VS. SAME-BUDGET ROOFTOP SOLAR — 8,760-HOUR PHYSICS & ROI SITE AUDIT REPORT',
    margin,
    8
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(`Site Audit Report: ${siteName}`, margin, 16);

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Coordinates: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E  |  Date: ${reportDate}  |  Weather Dataset: ${
      dataSource === 'live' ? 'Open-Meteo 8,760-Hr Hourly' : 'Reference Hourly Dataset'
    }`,
    margin,
    23
  );

  // Verdict Badge in Top Right
  const verdictColor: [number, number, number] =
    audit.verdict.status === 'GO'
      ? [16, 185, 129]
      : audit.verdict.status === 'MARGINAL'
      ? [245, 158, 11]
      : [244, 63, 94];
  doc.setFillColor(...verdictColor);
  doc.roundedRect(pageW - margin - 42, 7, 42, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`WIND: ${audit.verdict.status}`, pageW - margin - 21, 15.5, { align: 'center' });

  let y = 34;

  // SECTION 1: WHAT WILL BE BEST & BY HOW MUCH (RECOMMENDATION HERO BOX)
  doc.setFillColor(254, 243, 199); // Amber-50/100 highlight
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, contentW, 44, 3, 3, 'FD');

  doc.setTextColor(146, 64, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('1. EXECUTIVE DECISION — WHAT WILL BE BEST & BY HOW MUCH', margin + 4, y + 6);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11.5);
  doc.text(analysis.headline, margin + 4, y + 13);

  // 4 Quantitative Advantage Boxes inside Winner Banner
  const boxW = (contentW - 12) / 4;
  const boxY = y + 16.5;
  const advMetrics = [
    {
      label: 'ENERGY ADVANTAGE',
      val: analysis.energyRatioText,
      sub: `+${analysis.extraAnnualKwh.toLocaleString('en-IN')} kWh/year`
    },
    {
      label: 'ANNUAL SAVINGS GAIN',
      val: `+Rs. ${analysis.extraAnnualSavingsInr.toLocaleString('en-IN')}/yr`,
      sub: `@ Rs. ${config.tariffInr.toFixed(2)}/kWh tariff`
    },
    {
      label: '20-YR NET PROFIT GAIN',
      val: `+Rs. ${analysis.extra20YrProfitInr.toLocaleString('en-IN')}`,
      sub: `After Rs. ${config.budgetInr.toLocaleString('en-IN')} CapEx`
    },
    {
      label: 'PAYBACK ADVANTAGE',
      val:
        analysis.winner === 'SOLAR'
          ? `${formatPaybackPeriod(audit.solarPaybackYears, 'short')} Payback`
          : `${formatPaybackPeriod(audit.paybackYears, 'short')} Payback`,
      sub: `Wind: ${formatPaybackPeriod(audit.paybackYears, 'short')}`
    }
  ];

  advMetrics.forEach((m, idx) => {
    const bx = margin + 3 + idx * (boxW + 2);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(251, 191, 36);
    doc.roundedRect(bx, boxY, boxW, 14.5, 1.5, 1.5, 'FD');

    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(m.label, bx + 2.5, boxY + 4);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.text(m.val, bx + 2.5, boxY + 9.2);

    doc.setTextColor(180, 83, 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.text(m.sub, bx + 2.5, boxY + 13);
  });

  // Detailed Winner Explanation Text
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  const splitExplanation = doc.splitTextToSize(analysis.detailedExplanation, contentW - 8);
  doc.text(splitExplanation.slice(0, 3), margin + 4, y + 35.5);

  y += 49;

  // SECTION 2: COMPLETE HEAD-TO-HEAD AUDIT COMPARISON TABLE
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(
    '2. HEAD-TO-HEAD TECHNICAL & FINANCIAL AUDIT COMPARISON (ALL METRICS)',
    margin,
    y
  );
  y += 3;

  const col1W = 58;
  const col2W = 41;
  const col3W = 43;
  const col4W = contentW - col1W - col2W - col3W;

  // Table Header
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentW, 7, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Audit Parameter / Metric', margin + 2.5, y + 4.8);
  doc.text(`Micro-Wind (${config.ratedPowerW}W)`, margin + col1W + 2, y + 4.8);
  doc.text(
    `Same-Budget Solar (${audit.solarEquivalentKw.toFixed(2)} kW)`,
    margin + col1W + col2W + 2,
    y + 4.8
  );
  doc.text('Winner & Exact Advantage', margin + col1W + col2W + col3W + 2, y + 4.8);
  y += 7;

  const tableRows: Array<[string, string, string, string]> = [
    [
      'Upfront Capital Budget (CapEx)',
      `Rs. ${config.budgetInr.toLocaleString('en-IN')}`,
      `Rs. ${config.budgetInr.toLocaleString('en-IN')}`,
      'Identical CapEx Baseline'
    ],
    [
      'Annual Energy Generation (kWh/yr)',
      `${audit.annualWindKwh.toLocaleString('en-IN')} kWh/yr`,
      `${audit.annualSolarKwh.toLocaleString('en-IN')} kWh/yr`,
      `${analysis.winner === 'SOLAR' ? 'Solar' : 'Wind'}: +${analysis.extraAnnualKwh.toLocaleString('en-IN')} kWh/yr (${analysis.energyRatioText})`
    ],
    [
      `Annual Bill Savings (@ Rs. ${config.tariffInr.toFixed(2)}/kWh)`,
      `Rs. ${audit.annualSavingsInr.toLocaleString('en-IN')}/yr`,
      `Rs. ${audit.solarAnnualSavingsInr.toLocaleString('en-IN')}/yr`,
      `${analysis.winner === 'SOLAR' ? 'Solar' : 'Wind'}: +Rs. ${analysis.extraAnnualSavingsInr.toLocaleString('en-IN')}/yr`
    ],
    [
      'Simple Annual Return on Investment',
      `${analysis.windAnnualRoiPct.toFixed(1)}% / yr`,
      `${analysis.solarAnnualRoiPct.toFixed(1)}% / yr`,
      `${analysis.winner === 'SOLAR' ? 'Solar' : 'Wind'}: +${Math.abs(analysis.solarAnnualRoiPct - analysis.windAnnualRoiPct).toFixed(1)}% annual ROI`
    ],
    [
      'Simple Capital Payback Period',
      formatPaybackPeriod(audit.paybackYears, 'long'),
      formatPaybackPeriod(audit.solarPaybackYears, 'long'),
      analysis.paybackAdvantageText
    ],
    [
      '20-Year Cumulative Net Profit',
      `${analysis.wind20YrNetInr >= 0 ? '+' : '-'}Rs. ${Math.abs(
        analysis.wind20YrNetInr
      ).toLocaleString('en-IN')}`,
      `${analysis.solar20YrNetInr >= 0 ? '+' : '-'}Rs. ${Math.abs(
        analysis.solar20YrNetInr
      ).toLocaleString('en-IN')}`,
      `${analysis.winner === 'SOLAR' ? 'Solar' : 'Wind'}: +Rs. ${analysis.extra20YrProfitInr.toLocaleString('en-IN')} net gain`
    ],
    [
      '20-Year Levelized Cost (LCOE)',
      analysis.windLcoeText,
      analysis.solarLcoeText,
      `Grid Tariff: Rs. ${config.tariffInr.toFixed(2)}/kWh`
    ],
    [
      'Capacity Factor / Idle Dead-Zone',
      `${audit.capacityFactorPct.toFixed(1)}% CF (${audit.pctBelowCutIn.toFixed(1)}% idle <${audit.cutInSpeedMs.toFixed(1)}m/s)`,
      `${audit.avgSolarInsolationKwhM2Day.toFixed(2)} kWh/m²/d (PR=${audit.effectiveSolarPrPct}%)`,
      `${audit.hoursBelowCutIn.toLocaleString('en-IN')} hrs/yr @ 0 W wind stall`
    ]
  ];

  tableRows.forEach((row, idx) => {
    const rowH = 6.2;
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentW, rowH, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentW, rowH, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(51, 65, 85);
    doc.text(row[0], margin + 2.5, y + 4.3);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(14, 116, 144);
    doc.text(row[1], margin + col1W + 2, y + 4.3);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text(row[2], margin + col1W + col2W + 2, y + 4.3);

    doc.setTextColor(15, 23, 42);
    doc.text(row[3], margin + col1W + col2W + col3W + 2, y + 4.3);

    y += rowH;
  });

  y += 5;

  // SECTION 3: AERODYNAMIC & BOUNDARY-LAYER TELEMETRY SUMMARY STRIP
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentW, 18, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('3. SITE AERODYNAMIC & HARDWARE CONFIGURATION PARAMETERS', margin + 3, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(51, 65, 85);
  const shearDesc =
    audit.shearModel === 'logarithmic'
      ? `Logarithmic Law (z0 = ${audit.z0}m)`
      : `Power Law (Hellmann alpha = ${audit.alpha.toFixed(2)})`;
  doc.text(
    `• Turbine Specs: ${config.ratedPowerW}W Rated | Rotor Diameter: ${config.rotorDiameterM.toFixed(
      1
    )}m (Swept Area A = ${audit.sweptAreaM2.toFixed(2)} m²) | Hub Height: ${config.hubHeightM}m (${(config.hubHeightM * 3.28084).toFixed(0)} ft)`,
    margin + 3,
    y + 10
  );
  doc.text(
    `• Wind Shear & Velocities: ${terrainProfile.label.split(' (')[0]} | ${shearDesc} | Net Shear: x${audit.shearMultiplier.toFixed(
      3
    )} | 10m Mean: ${audit.avgWindSpeed10mMs.toFixed(2)} m/s -> Hub Mean: ${audit.avgWindSpeedMs.toFixed(2)} m/s`,
    margin + 3,
    y + 14.8
  );

  y += 22;

  // SECTION 4: EMBEDDED GRAPH 1 (12-MONTH GENERATION COMPARISON BAR CHART)
  const graph1H = 70;
  doc.addImage(chart1Url, 'PNG', margin, y, contentW, graph1H);
  y += graph1H + 4;

  // Footer on Page 1
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.text(
    `Page 1 of 2  |  Micro-Wind vs. Same-Budget Rooftop Solar Site Auditor  |  Formula: P = 0.5 * rho (${audit.avgAirDensityKgM3.toFixed(3)}) * A * v^3 * Cp_eta (${(audit.combinedCpEta * 100).toFixed(1)}%)`,
    pageW / 2,
    291,
    { align: 'center' }
  );

  // =========================================================================
  // PAGE 2: 20-YEAR CASH FLOW GRAPH, WIND HISTOGRAM & 12-MONTH DATA TABLE
  // =========================================================================
  doc.addPage();
  let y2 = 14;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(
    `Site Audit Report (Page 2): 20-Year ROI Cash-Flow Graph, Wind Histogram & Monthly Breakdown — ${siteName}`,
    margin,
    10.5
  );

  y2 = 22;

  // Embedded Graph 2A & 2B (20-Year Cumulative Cash Flow + Wind Speed Frequency Histogram)
  const graph2H = 72;
  doc.addImage(chart2Url, 'PNG', margin, y2, contentW, graph2H);
  y2 += graph2H + 8;

  // SECTION 5: 12-MONTH GRANULAR GENERATION & SAVINGS TABLE (JAN - DEC)
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(
    '4. MONTHLY GENERATION & FINANCIAL YIELD BREAKDOWN (JANUARY – DECEMBER)',
    margin,
    y2
  );
  y2 += 3;

  const mCols = [22, 32, 34, 34, 34, contentW - 156];
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y2, contentW, 6.8, 'FD');

  doc.setFontSize(7.2);
  doc.setTextColor(30, 41, 59);
  const mHeaders = [
    'Month',
    'Micro-Wind (kWh)',
    'Solar PV (kWh)',
    'Wind Savings (Rs.)',
    'Solar Savings (Rs.)',
    'Monthly Solar Advantage'
  ];
  let curX = margin;
  mHeaders.forEach((h, i) => {
    doc.text(h, curX + 2, y2 + 4.6);
    curX += mCols[i];
  });
  y2 += 6.8;

  for (let m = 0; m < 12; m++) {
    const rowH = 5.8;
    if (m % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y2, contentW, rowH, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y2, contentW, rowH, 'S');

    const wKwh = audit.monthlyWindKwh[m] ?? 0;
    const sKwh = audit.monthlySolarKwh[m] ?? 0;
    const wSav = Math.round(wKwh * config.tariffInr);
    const sSav = Math.round(sKwh * config.tariffInr);
    const diffKwh = sKwh - wKwh;

    let cx = margin;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(MONTH_NAMES[m], cx + 2, y2 + 4);
    cx += mCols[0];

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(14, 116, 144);
    doc.text(`${wKwh.toLocaleString('en-IN')} kWh`, cx + 2, y2 + 4);
    cx += mCols[1];

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text(`${sKwh.toLocaleString('en-IN')} kWh`, cx + 2, y2 + 4);
    cx += mCols[2];

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`Rs. ${wSav.toLocaleString('en-IN')}`, cx + 2, y2 + 4);
    cx += mCols[3];

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 128, 61);
    doc.text(`Rs. ${sSav.toLocaleString('en-IN')}`, cx + 2, y2 + 4);
    cx += mCols[4];

    doc.setTextColor(15, 23, 42);
    doc.text(
      `${diffKwh >= 0 ? '+' : ''}${diffKwh.toLocaleString('en-IN')} kWh (${
        diffKwh >= 0 ? 'Solar' : 'Wind'
      })`,
      cx + 2,
      y2 + 4
    );

    y2 += rowH;
  }

  // Annual Total Row
  doc.setFillColor(226, 232, 240);
  doc.rect(margin, y2, contentW, 6.8, 'FD');
  let tx = margin;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('ANNUAL TOTAL', tx + 2, y2 + 4.6);
  tx += mCols[0];
  doc.text(`${audit.annualWindKwh.toLocaleString('en-IN')} kWh`, tx + 2, y2 + 4.6);
  tx += mCols[1];
  doc.text(`${audit.annualSolarKwh.toLocaleString('en-IN')} kWh`, tx + 2, y2 + 4.6);
  tx += mCols[2];
  doc.text(`Rs. ${audit.annualSavingsInr.toLocaleString('en-IN')}`, tx + 2, y2 + 4.6);
  tx += mCols[3];
  doc.text(`Rs. ${audit.solarAnnualSavingsInr.toLocaleString('en-IN')}`, tx + 2, y2 + 4.6);
  tx += mCols[4];
  doc.text(
    `+${analysis.extraAnnualKwh.toLocaleString('en-IN')} kWh (${analysis.energyRatioText})`,
    tx + 2,
    y2 + 4.6
  );

  y2 += 12;

  // SECTION 6: PHYSICS METHODOLOGY & FINAL ENGINEERING CONCLUSION
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y2, contentW, 34, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('5. PHYSICS AUDIT VERDICT & ENGINEERING METHODOLOGY NOTES', margin + 3, y2 + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(51, 65, 85);
  const verdictNotes = [
    `• Verdict Headline: ${audit.verdict.headline}`,
    `• Why This Happens: ${audit.verdict.reason}`,
    `• Cubic Wind Scaling Law: P_wind = 0.5 * rho (${audit.avgAirDensityKgM3.toFixed(3)} kg/m³) * A (${audit.sweptAreaM2.toFixed(
      2
    )} m²) * v³ * Cp_eta (${(audit.combinedCpEta * 100).toFixed(1)}%), gated by v_cut_in = ${audit.cutInSpeedMs.toFixed(1)} m/s, v_rated = ${audit.ratedWindSpeedMs.toFixed(1)} m/s, v_cut_out = ${audit.cutOutSpeedMs.toFixed(0)} m/s.`,
    `• Solar Benchmark Formula: E_solar = (GHI / 1000) * ${audit.solarEquivalentKw.toFixed(
      2
    )} kWp * PR (${audit.effectiveSolarPrPct}%), based on Rs. 60,000/kW installed Indian rooftop solar cost.`
  ];
  let vy = y2 + 11.5;
  verdictNotes.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, contentW - 6);
    doc.text(wrapped, margin + 3, vy);
    vy += wrapped.length * 3.8 + 1;
  });

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.text(
    'Page 2 of 2  |  Generated by Micro-Wind Turbine vs. Rooftop Solar Site Auditor',
    pageW / 2,
    291,
    { align: 'center' }
  );

  const sanitizedSite = siteName
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `Micro-Wind-vs-Solar-Audit-${sanitizedSite || 'Site'}-${dateStamp}.pdf`;

  doc.save(fileName);

  return {
    fileName,
    chart1Url,
    chart2Url,
    analysis
  };
}
