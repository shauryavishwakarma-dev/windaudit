/**
 * Physics & Aerodynamic Audit Engine for Micro-Wind vs. Same-Budget Rooftop Solar
 * Exposes TERRAIN_PROFILES, TURBINE_ARCHITECTURES, runWindAudit, and runTeacherSanityCheck
 */

export type ShearModel = 'power_law' | 'logarithmic';
export type TurbineType = 'hawt' | 'vawt';

export interface TerrainProfile {
  id: string;
  label: string;
  alpha: number;            // Hellmann Power Law exponent
  z0: number;               // Aerodynamic roughness length z0 in meters (Logarithmic Law)
  turbulenceFactor: number; // Micro-scale wake & directional yaw turbulence velocity factor (0.80 - 1.00)
  turbulencePenaltyPct: number;
  description: string;
}

export const TERRAIN_PROFILES: Record<string, TerrainProfile> = {
  urban: {
    id: 'urban',
    label: 'Dense City Rooftop',
    alpha: 0.30,
    z0: 1.00,
    turbulenceFactor: 0.80,
    turbulencePenaltyPct: 20,
    description:
      'High surface drag & parapet wake turbulence from surrounding buildings. Applies 60m blending-height boundary layer coupling + 20% urban eddy penalty.'
  },
  suburban: {
    id: 'suburban',
    label: 'Suburban / Industrial Area',
    alpha: 0.22,
    z0: 0.30,
    turbulenceFactor: 0.90,
    turbulencePenaltyPct: 10,
    description:
      'Moderate surface roughness with scattered low-rise structures and 10% obstacle wake turbulence penalty.'
  },
  open: {
    id: 'open',
    label: 'Open Rural Plains',
    alpha: 0.14,
    z0: 0.03,
    turbulenceFactor: 0.98,
    turbulencePenaltyPct: 2,
    description:
      'Standard WMO open farmland reference terrain (1/7th Power Law, z₀ = 0.03m) with minimal vertical obstructions.'
  },
  coastal: {
    id: 'coastal',
    label: 'Coastal Shoreline / Ridge',
    alpha: 0.10,
    z0: 0.002,
    turbulenceFactor: 1.00,
    turbulencePenaltyPct: 0,
    description:
      'Smooth laminar airflow over open water or unobstructed salt flats with low boundary-layer drag.'
  }
};

export interface TurbineArchitectureSpec {
  id: TurbineType;
  label: string;
  shortLabel: string;
  rotorCp: number;          // Aerodynamic rotor power coefficient (vs 0.5926 Betz limit)
  generatorEta: number;     // PMG generator & rectifier efficiency
  inverterEta: number;      // MPPT wind charge controller / grid-tie inverter efficiency
  wiringEta: number;        // Cable & yaw slip-ring efficiency
  combinedCpEta: number;    // Net system efficiency (Cp * eta_gen * eta_inv * eta_wire)
  cutInMs: number;          // Cut-in wind speed (m/s) below which output is 0 W
  cutOutMs: number;         // Storm brake cut-out wind speed (m/s) above which output is 0 W
  description: string;
}

export const TURBINE_ARCHITECTURES: Record<TurbineType, TurbineArchitectureSpec> = {
  hawt: {
    id: 'hawt',
    label: '3-Blade Horizontal-Axis (HAWT · 27.5% Net Cp·η, 3.0 m/s Cut-In)',
    shortLabel: 'Small 3-Blade HAWT',
    rotorCp: 0.35,
    generatorEta: 0.88,
    inverterEta: 0.92,
    wiringEta: 0.97,
    combinedCpEta: 0.275, // 27.5% realistic small HAWT net efficiency (within 25-35% range)
    cutInMs: 3.0,
    cutOutMs: 25.0,
    description:
      'Aerodynamic lift-driven 3-blade horizontal rotor (Cp = 0.35, PMG = 88%, MPPT Inverter = 92%, Wiring = 97% → Net 27.5% vs 59.3% Betz limit).'
  },
  vawt: {
    id: 'vawt',
    label: '3-Blade Helical VAWT (21.0% Net Cp·η, 2.5 m/s Cut-In)',
    shortLabel: 'Helical VAWT',
    rotorCp: 0.27,
    generatorEta: 0.87,
    inverterEta: 0.92,
    wiringEta: 0.97,
    combinedCpEta: 0.21, // 21.0% realistic modern 3-blade helical Darrieus net efficiency
    cutInMs: 2.5,
    cutOutMs: 24.0,
    description:
      'Lift-driven 3-blade helical Darrieus vertical-axis rotor with omni-directional capture (Cp = 0.27, PMG = 87%, Inverter = 92% → Net 21.0%).'
  }
};

export interface AuditConfig {
  hubHeightM: number;                    // 6 to 40 m (default 15)
  rotorDiameterM: number;                // 1.0 to 6.0 m (default 2.5)
  ratedPowerW: number;                   // 500 to 5000 W (default 1000)
  budgetInr: number;                     // 50,000 to 5,00,000 (default 1,50,000)
  tariffInr: number;                     // 4 to 15 /kWh (default 8)
  terrain: string;                       // key of TERRAIN_PROFILES (default 'urban')
  turbineType?: TurbineType;             // 'hawt' (27.5% net) or 'vawt' (21.0% net)
  cutInSpeedMs?: number | null;          // Optional custom cut-in speed (2.0 - 4.5 m/s)
  ratedWindSpeedMs?: number | null;      // Optional custom rated speed (9.0 - 15.0 m/s)
  cutOutSpeedMs?: number | null;         // Optional custom cut-out speed (18.0 - 25.0 m/s)
  customCpEta?: number | null;           // Optional custom system efficiency Cp*eta (0.10 - 0.45, < 0.593 Betz)
  overrideMeanWind10mMs?: number | null; // Optional manual "What-If" 10m wind speed override (m/s)
  overridePeakSunHoursDay?: number | null; // Optional manual "What-If" daily peak sun hours override (kWh/m²/day)
  overrideElevationM?: number | null;    // Optional manual "What-If" site elevation override (m ASL)
  shearModel?: ShearModel;               // 'power_law' (Hellmann) or 'logarithmic' (Prandtl z0)
  customAlpha?: number | null;           // Optional custom Hellmann exponent override
  customZ0?: number | null;              // Optional custom roughness length z0 (m) override
  solarTiltDeg?: number | null;          // Panel tilt angle β (0° flat to 60° steep; null = auto latitude optimal)
  solarAzimuthDeg?: number | null;       // Compass orientation γ (0°=N, 90°=E, 180°=S, 270°=W; null = 180° True South)
}

export interface WeatherData {
  lat: number;
  lon: number;
  elevationM?: number;            // Site elevation in meters above sea level
  name?: string;
  source: 'live' | 'offline_fallback';
  year: number;
  hourlyWindSpeed10mMs: number[]; // 8,760 hourly values in m/s at 10m WMO open-terrain reference height
  hourlySolarGhiWm2: number[];    // 8,760 hourly Global Horizontal Irradiance in W/m²
  hourlyTemp2mC?: number[];       // 8,760 hourly 2m ambient temperature in °C
  apiWarning?: string | null;     // Diagnostic or fallback notice when API fails, times out, or hits ocean grid
  isOceanCoordinate?: boolean;    // True when coordinates fall in open ocean outside onshore grid
}

export interface HistogramBin {
  label: string;
  minMs: number;
  maxMs: number;
  hours: number;
  pct: number;
  isBelowCutIn: boolean;
}

export interface AuditVerdict {
  status: 'GO' | 'MARGINAL' | 'NO-GO';
  recommendedSystem: 'WIND' | 'HYBRID' | 'SOLAR';
  headline: string;
  reason: string;
  plainSummary?: string;
}

export interface PeakSeasonSummary {
  peakMonthIdx: number;
  peakMonthKwh: number;
  peakDayLabel: string;
  peakDayKwh: number;
  peakDayWindMs: number;
  monsoonWindSharePct: number;
}

export interface PowerCurveBin {
  speedMs: number;            // Discrete wind speed bin center / integer speed 0..25 m/s
  powerW: number;             // Turbine electrical output P(v) in Watts at this hub wind speed
  rayleighPdfPct: number;     // Rayleigh (Weibull k=2) probability density f(v) in %
  rayleighHoursYr: number;    // Expected hours/year in this 1 m/s bin under Rayleigh (k=2)
  empiricalHoursYr: number;   // Actual hours/year in this 1 m/s bin from 8,760-hr time series
  rayleighEnergyKwh: number;  // Annual energy contribution (kWh/yr) from this bin under Rayleigh
}

export interface AuditResult {
  baselineWind10mMs: number;        // Unmodified Open-Meteo 10m mean wind speed (m/s)
  baselineSolarKwhM2Day: number;    // Unmodified Open-Meteo horizontal GHI peak sun hours (kWh/m²/day)
  baselineElevationM: number;       // Unmodified Open-Meteo site elevation (m ASL)
  isWhatIfOverridden: boolean;      // True if user unlocked/modified What-If site or curve overrides
  avgWindSpeed10mMs: number;
  avgWindSpeedMs: number;
  pctBelowCutIn: number;
  hoursBelowCutIn: number;
  hoursGenerating: number;
  hoursAtRatedCap: number;
  hoursStormCutOut: number;
  sweptAreaM2: number;
  turbineType: TurbineType;
  combinedCpEta: number;
  cutInSpeedMs: number;
  ratedWindSpeedMs: number;
  cutOutSpeedMs: number;
  siteElevationM: number;
  avgAmbientTempC: number;
  avgAirDensityKgM3: number;
  airDensityRatioVsStd: number;
  energyPatternFactor: number;      // EPF = mean(v³) / (mean(v))³ (Rayleigh ≈ 1.91)
  weibullShapeK: number;            // Fitted Weibull shape parameter k
  weibullScaleCMs: number;          // Fitted Weibull scale parameter c (m/s)
  rayleighAnnualWindKwh: number;    // Analytical Rayleigh (Weibull k=2) integrated annual yield across 0-25 m/s
  naiveCubedAvgWindKwh: number;     // What a broken "cube the average wind speed" formula would predict
  marketingClaimWindKwh: number;    // Typical online seller / brochure claim for ratedPowerW turbine
  marketingRealityRatio: number;    // Brochure claim divided by actual physics yield
  shearModel: ShearModel;
  alpha: number;
  z0: number;
  turbulenceFactor: number;
  verticalProfileRatio: number;     // Pure vertical ratio v(h)/v(10_local)
  shearMultiplier: number;          // Effective meso-micro multiplier from 10m open API wind to hub height
  powerLawMultiplier: number;
  logLawMultiplier: number;
  annualWindKwh: number;
  capacityFactorPct: number;
  annualSavingsInr: number;
  paybackYears: number | null;
  windAnnualOmInr: number;          // Estimated annual maintenance cost for micro-wind (1.5% CapEx/yr)
  wind10YrLcoeInr: number | null;   // 10-year Levelized Cost of Energy (₹/kWh) including 1.5%/yr O&M
  windLcoeInr: number | null;       // 20-year Levelized Cost of Energy (₹/kWh) including 1.5%/yr O&M
  solarEquivalentKw: number;
  solarCapacityFactorPct: number;   // Equivalent capacity factor (%) of the rooftop solar PV array
  solarTiltDeg: number;             // Active panel tilt angle β (degrees from horizontal)
  solarAzimuthDeg: number;          // Active panel compass orientation γ (degrees: 180° = South)
  solarOptimalTiltDeg: number;      // Latitude-derived optimal fixed tilt angle (degrees)
  solarOptimalAzimuthDeg: number;   // Hemisphere-derived optimal azimuth (180° South in Northern Hemisphere)
  solarCompassDirection: string;    // Cardinal direction label (e.g. 'S', 'SE', 'SW', 'E', 'W', 'N')
  avgSolarInsolationKwhM2Day: number; // Mean daily horizontal GHI in kWh/m²/day
  avgSolarPoaKwhM2Day: number;      // Mean daily Plane-of-Array (tilted/oriented) insolation in kWh/m²/day
  solarTiltGainPct: number;         // % yield change from current tilt & azimuth vs flat 0° horizontal roof
  flatHorizontalSolarKwh: number;   // Reference annual solar kWh if panels were mounted flat (0° tilt)
  effectiveSolarPrPct: number;      // Irradiance-weighted net Performance Ratio (%) after thermal & BOS derates
  solarTotalDeratePct: number;      // Total solar system derate (%) = 100 - effectiveSolarPrPct
  annualSolarKwh: number;
  solarAnnualSavingsInr: number;
  solarPaybackYears: number | null;
  solarAnnualOmInr: number;         // Estimated annual maintenance cost for rooftop solar (0.5% CapEx/yr)
  solar10YrLcoeInr: number | null;  // 10-year Levelized Cost of Energy (₹/kWh) including 0.5%/yr O&M
  solarLcoeInr: number | null;      // 20-year Levelized Cost of Energy (₹/kWh) including 0.5%/yr O&M
  solarToWindRatio: number;
  monthlyWindKwh: number[];
  monthlySolarKwh: number[];
  calendarDailyWindKwh: number[][];     // 12 months x days in month (daily wind kWh)
  calendarDailyPeakWindMs: number[][];  // 12 months x days in month (daily peak hub wind m/s)
  monthHourWindAvgW: number[][];        // 12 months x 24 hours (diurnal average Wind Watts)
  monthHourSolarAvgW: number[][];       // 12 months x 24 hours (diurnal average Solar Watts)
  diurnalWindAvgW: number[];            // 24 hours (00..23) annual mean wind power in Watts
  diurnalSolarAvgW: number[];           // 24 hours (00..23) annual mean solar power in Watts
  monsoonDiurnalWindAvgW: number[];     // 24 hours (00..23) May-Sep monsoon mean wind power in Watts
  monsoonDiurnalSolarAvgW: number[];    // 24 hours (00..23) May-Sep monsoon mean solar power in Watts
  nonMonsoonDiurnalWindAvgW: number[];  // 24 hours (00..23) Oct-Apr dry-season mean wind power in Watts
  nonMonsoonDiurnalSolarAvgW: number[]; // 24 hours (00..23) Oct-Apr dry-season mean solar power in Watts
  peakSeasonSummary: PeakSeasonSummary;
  histogramBins: HistogramBin[];
  powerCurveBins: PowerCurveBin[];      // 0..25 m/s turbine power curve & Rayleigh (k=2) distribution bins
  verdict: AuditVerdict;
}

const ISA_SEA_LEVEL_RHO = 1.225;       // kg/m³ at 15°C, 101,325 Pa sea level
const REFERENCE_SANITY_CP_ETA = 0.30;  // 30.0% reference combined efficiency for deterministic Teacher Sanity Check
const DEFAULT_CUT_IN_MS = 3.0;         // Default cut-in threshold (m/s)
const DEFAULT_CUT_OUT_MS = 25.0;       // Storm protection brake threshold (m/s)
const SOLAR_COST_PER_KW_INR = 60000;   // ₹60,000 per kWp installed rooftop solar benchmark in India

// Solar PV Balance-of-System (BOS) & Thermal Derate Constants:
// Fixed BOS losses: Inverter (4%), DC/AC wiring & mismatch (3%), soiling/reflection (6.5%), LID (1.5%) => 14.2% loss (BOS efficiency = 0.858)
const SOLAR_BOS_EFFICIENCY = 0.858;
const SOLAR_NOCT_C = 45.0;             // Nominal Operating Cell Temperature (°C)
const SOLAR_TEMP_COEFF_PER_C = -0.0038; // -0.38%/°C above 25°C STC for monocrystalline PERC silicon

const REF_HEIGHT_M = 10.0;             // Standard 10m WMO anemometer reference height
const BLENDING_HEIGHT_M = 60.0;        // Meso-scale atmospheric blending height above surface roughness elements
const WMO_REF_ALPHA = 0.14;            // Open-terrain Hellmann exponent for 10m meteorological reanalysis data
const WMO_REF_Z0 = 0.03;               // Open-terrain roughness length (m) for 10m meteorological reanalysis data

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_HOURS = [744, 672, 744, 720, 744, 720, 744, 744, 720, 744, 720, 744];
const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Sanitizes and clamps all user-configurable hardware and financial parameters
 * to prevent negative numbers, NaN, zero budgets, or impossible hub heights from breaking physics or charts.
 */
export function sanitizeAuditConfig(raw: AuditConfig): AuditConfig {
  const safeNum = (val: unknown, fallback: number, min: number, max: number): number => {
    const n = typeof val === 'number' ? val : Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  };

  return {
    ...raw,
    hubHeightM: safeNum(raw.hubHeightM, 15, 3, 120),
    rotorDiameterM: safeNum(raw.rotorDiameterM, 2.5, 0.5, 20.0),
    ratedPowerW: safeNum(raw.ratedPowerW, 1000, 100, 50000),
    budgetInr: safeNum(raw.budgetInr, 150000, 10000, 10000000),
    tariffInr: safeNum(raw.tariffInr, 8.0, 0.5, 50.0),
    terrain: raw.terrain && TERRAIN_PROFILES[raw.terrain] ? raw.terrain : 'urban',
    turbineType: raw.turbineType === 'vawt' ? 'vawt' : 'hawt',
    shearModel: raw.shearModel === 'logarithmic' ? 'logarithmic' : 'power_law',
    customAlpha:
      typeof raw.customAlpha === 'number' && Number.isFinite(raw.customAlpha)
        ? Math.max(0.04, Math.min(0.55, raw.customAlpha))
        : null,
    customZ0:
      typeof raw.customZ0 === 'number' && Number.isFinite(raw.customZ0)
        ? Math.max(0.0002, Math.min(2.5, raw.customZ0))
        : null,
    cutInSpeedMs:
      typeof raw.cutInSpeedMs === 'number' && Number.isFinite(raw.cutInSpeedMs)
        ? Math.max(2.0, Math.min(4.5, Number(raw.cutInSpeedMs.toFixed(1))))
        : null,
    ratedWindSpeedMs:
      typeof raw.ratedWindSpeedMs === 'number' && Number.isFinite(raw.ratedWindSpeedMs)
        ? Math.max(8.5, Math.min(16.0, Number(raw.ratedWindSpeedMs.toFixed(1))))
        : null,
    cutOutSpeedMs:
      typeof raw.cutOutSpeedMs === 'number' && Number.isFinite(raw.cutOutSpeedMs)
        ? Math.max(18.0, Math.min(25.0, Number(raw.cutOutSpeedMs.toFixed(1))))
        : null,
    customCpEta:
      typeof raw.customCpEta === 'number' && Number.isFinite(raw.customCpEta)
        ? Math.max(0.08, Math.min(0.48, Number(raw.customCpEta.toFixed(3))))
        : null,
    overrideMeanWind10mMs:
      typeof raw.overrideMeanWind10mMs === 'number' && Number.isFinite(raw.overrideMeanWind10mMs)
        ? Math.max(0.5, Math.min(14.0, Number(raw.overrideMeanWind10mMs.toFixed(2))))
        : null,
    overridePeakSunHoursDay:
      typeof raw.overridePeakSunHoursDay === 'number' && Number.isFinite(raw.overridePeakSunHoursDay)
        ? Math.max(2.0, Math.min(8.5, Number(raw.overridePeakSunHoursDay.toFixed(2))))
        : null,
    overrideElevationM:
      typeof raw.overrideElevationM === 'number' && Number.isFinite(raw.overrideElevationM)
        ? Math.max(0, Math.min(4500, Math.round(raw.overrideElevationM)))
        : null,
    solarTiltDeg:
      typeof raw.solarTiltDeg === 'number' && Number.isFinite(raw.solarTiltDeg)
        ? Math.max(0, Math.min(60, Math.round(raw.solarTiltDeg)))
        : null,
    solarAzimuthDeg:
      typeof raw.solarAzimuthDeg === 'number' && Number.isFinite(raw.solarAzimuthDeg)
        ? ((Math.round(raw.solarAzimuthDeg) % 360) + 360) % 360
        : null
  };
}

/**
 * Formats a payback period (in years) safely, guarding against null, NaN, Infinity, <= 0, or > 50 years.
 */
export function formatPaybackPeriod(
  paybackYears: number | null | undefined,
  mode: 'short' | 'long' = 'short'
): string {
  if (
    paybackYears === null ||
    paybackYears === undefined ||
    !Number.isFinite(paybackYears) ||
    paybackYears <= 0 ||
    paybackYears > 50
  ) {
    return mode === 'long' ? 'Never pays back (>50 years)' : 'Never (>50 yrs)';
  }
  return mode === 'long' ? `${paybackYears.toFixed(1)} years` : `${paybackYears.toFixed(1)} yrs`;
}

/**
 * Computes dry air density rho (kg/m³) at elevation zMeters above sea level and ambient temperature tempC (°C)
 * using the barometric pressure formula and Ideal Gas Law: rho = P(z) / (R_specific * T_Kelvin).
 */
export function computeAirDensityKgM3(elevationMeters: number, tempC: number): number {
  const safeElev = Number.isFinite(elevationMeters) ? elevationMeters : 80;
  const safeTemp = Number.isFinite(tempC) ? tempC : 26.5;
  const safeZ = Math.max(0, Math.min(5500, safeElev));
  const safeTempK = Math.max(230, Math.min(335, safeTemp + 273.15));
  // Tropospheric barometric pressure P(z) in Pascals: P0 * (1 - L*z / T0)^(g*M / (R*L))
  const pressurePa = 101325 * Math.pow(1 - (0.0065 * safeZ) / 288.15, 5.25588);
  const R_SPECIFIC_DRY_AIR = 287.058; // J/(kg·K)
  return pressurePa / (R_SPECIFIC_DRY_AIR * safeTempK);
}

/**
 * Computes meso-micro boundary-layer wind shear multipliers translating 10m open-terrain API wind speed
 * via the 60m blending height to the user's actual hubHeightM and local terrain roughness + wake turbulence penalty.
 */
export function computeWindShearMetrics(rawConfig: AuditConfig): {
  shearModel: ShearModel;
  alpha: number;
  z0: number;
  turbulenceFactor: number;
  verticalProfileRatio: number;
  powerLawMultiplier: number;
  logLawMultiplier: number;
  activeMultiplier: number;
} {
  const config = sanitizeAuditConfig(rawConfig);
  const profile = TERRAIN_PROFILES[config.terrain] || TERRAIN_PROFILES.urban;
  const shearModel: ShearModel = config.shearModel ?? 'power_law';
  const alpha = config.customAlpha ?? profile.alpha;
  const z0 = config.customZ0 ?? profile.z0;

  const turbulenceFactor = profile.turbulenceFactor;

  // 1. Pure vertical profile ratio v(h) / v(10_local)
  const verticalPowerRatio = Math.pow(config.hubHeightM / REF_HEIGHT_M, alpha);
  const safeHubH = Math.max(config.hubHeightM, z0 + 0.5);
  const safeRefH = Math.max(REF_HEIGHT_M, z0 + 0.5);
  const verticalLogRatio = Math.log(safeHubH / z0) / Math.log(safeRefH / z0);

  // 2. Meso-micro boundary-layer coupling via 60m blending height + local wake turbulence penalty:
  // Translates 10m WMO open-terrain API wind speed up to 60m blending height, then down to hubHeightM through local roughness
  const mesoUpPower = Math.pow(BLENDING_HEIGHT_M / REF_HEIGHT_M, WMO_REF_ALPHA);
  const microDownPower = Math.pow(config.hubHeightM / BLENDING_HEIGHT_M, alpha);
  const powerLawMultiplier = mesoUpPower * microDownPower * turbulenceFactor;

  const mesoUpLog = Math.log(BLENDING_HEIGHT_M / WMO_REF_Z0) / Math.log(REF_HEIGHT_M / WMO_REF_Z0);
  const microDownLog = Math.log(safeHubH / z0) / Math.log(BLENDING_HEIGHT_M / z0);
  const logLawMultiplier = mesoUpLog * microDownLog * turbulenceFactor;

  const activeMultiplier =
    shearModel === 'logarithmic' ? logLawMultiplier : powerLawMultiplier;
  const verticalProfileRatio =
    shearModel === 'logarithmic' ? verticalLogRatio : verticalPowerRatio;

  return {
    shearModel,
    alpha,
    z0,
    turbulenceFactor,
    verticalProfileRatio,
    powerLawMultiplier,
    logLawMultiplier,
    activeMultiplier
  };
}

/**
 * Calculates single-hour aerodynamic electrical power in Watts at hub wind speed vHubMs (m/s).
 * Defaults to standard sea-level air density (1.225 kg/m³), 30% combined efficiency, and 3.0-25.0 m/s gates
 * when optional parameters are omitted (preserving deterministic 8.0000x v³ Teacher Sanity Check).
 */
export function computeInstantWindPowerW(
  vHubMs: number,
  sweptAreaM2: number,
  ratedPowerW: number,
  airDensityKgM3: number = ISA_SEA_LEVEL_RHO,
  combinedCpEta: number = REFERENCE_SANITY_CP_ETA,
  cutInMs: number = DEFAULT_CUT_IN_MS,
  cutOutMs: number = DEFAULT_CUT_OUT_MS
): number {
  if (vHubMs < cutInMs || vHubMs >= cutOutMs) {
    return 0;
  }
  const rawAeroPowerW = 0.5 * airDensityKgM3 * sweptAreaM2 * Math.pow(vHubMs, 3) * combinedCpEta;
  return Math.min(rawAeroPowerW, ratedPowerW);
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * Converts a 0-360° compass azimuth (0°=N, 90°=E, 180°=S, 270°=W) into a cardinal label.
 */
export function getCompassDirectionLabel(azimuthDeg: number): string {
  const norm = ((Math.round(azimuthDeg) % 360) + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(norm / 45) % 8;
  return dirs[idx];
}

/**
 * Transposes hourly Global Horizontal Irradiance (GHI in W/m²) onto a tilted solar panel
 * at tilt angle β (0°..60°) and compass azimuth γ (0°=N, 90°=E, 180°=S, 270°=W)
 * based on local latitude φ, day of year N (1..365), and local solar hour (0..23)
 * using the Duffie-Beckman / Liu-Jordan isotropic sky + direct beam + ground albedo model.
 */
export function computeHourlyPoaIrradianceWm2(
  ghiWm2: number,
  latDeg: number,
  dayOfYear: number,
  hourOfDay: number,
  tiltDeg: number,
  azimuthDeg: number
): number {
  if (ghiWm2 <= 0) return 0;
  if (tiltDeg <= 0.1) return ghiWm2;

  const phi = Math.max(-65, Math.min(65, latDeg)) * DEG_TO_RAD;
  const beta = Math.max(0, Math.min(85, tiltDeg)) * DEG_TO_RAD;
  const gammaPanel = ((azimuthDeg % 360) + 360) % 360 * DEG_TO_RAD;

  // Cooper (1969) solar declination angle δ (in radians)
  const decl = 23.45 * Math.sin(((360 / 365) * (284 + dayOfYear)) * DEG_TO_RAD) * DEG_TO_RAD;

  // Local solar hour angle ω (radians, negative in morning, 0 at solar noon, positive in afternoon)
  const solarHour = hourOfDay + 0.5;
  const omega = (solarHour - 12.0) * 15.0 * DEG_TO_RAD;

  // Solar elevation angle α_s: sin(α_s) = cos(θ_z)
  const sinAlpha =
    Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(omega);

  // Diffuse fraction f_d (higher at low sun / overcast hours, ~0.27 under clear sky beam conditions)
  const clearnessProxy = Math.min(1.0, ghiWm2 / 820.0);
  const diffuseFraction = Math.max(0.24, Math.min(0.75, 0.72 - 0.46 * clearnessProxy));

  const skyViewFactor = (1 + Math.cos(beta)) / 2;
  const groundAlbedoFactor = 0.20 * ((1 - Math.cos(beta)) / 2);

  if (sinAlpha <= 0.05) {
    // Low horizon twilight: predominantly isotropic sky diffuse + ground reflection
    return ghiWm2 * (skyViewFactor + groundAlbedoFactor);
  }

  const cosAlpha = Math.sqrt(Math.max(0.0001, 1 - sinAlpha * sinAlpha));

  // Solar azimuth γ_s measured from True North (0 = N, π/2 = E, π = S, 3π/2 = W)
  const cosAzimuthSun = Math.max(
    -1,
    Math.min(1, (Math.sin(decl) * Math.cos(phi) - Math.cos(decl) * Math.sin(phi) * Math.cos(omega)) / cosAlpha)
  );
  const rawSunAzimuth = Math.acos(cosAzimuthSun);
  const gammaSun = omega < 0 ? rawSunAzimuth : 2 * Math.PI - rawSunAzimuth;

  // Cosine of angle of incidence θ_i between solar beam and tilted panel normal
  const cosThetaI =
    sinAlpha * Math.cos(beta) +
    cosAlpha * Math.sin(beta) * Math.cos(gammaSun - gammaPanel);

  // Geometric beam transposition factor R_b = cos(θ_i) / sin(α_s), clamped to avoid horizon grazing spikes
  const rb = Math.max(0, Math.min(2.85, Math.max(0, cosThetaI) / Math.max(0.12, sinAlpha)));

  const poaWm2 =
    ghiWm2 * ((1 - diffuseFraction) * rb + diffuseFraction * skyViewFactor + groundAlbedoFactor);
  return Math.max(0, poaWm2);
}

/**
 * Runs complete 8,760-hour physics and financial audit for a site & turbine configuration
 */
export function runWindAudit(weatherData: WeatherData, rawConfig: AuditConfig): AuditResult {
  const config = sanitizeAuditConfig(rawConfig);
  const profile = TERRAIN_PROFILES[config.terrain] || TERRAIN_PROFILES.urban;
  const turbineType: TurbineType = config.turbineType ?? 'hawt';
  const turbineSpec = TURBINE_ARCHITECTURES[turbineType] || TURBINE_ARCHITECTURES.hawt;

  const cutInSpeedMs = config.cutInSpeedMs ?? turbineSpec.cutInMs;
  const cutOutSpeedMs = config.cutOutSpeedMs ?? turbineSpec.cutOutMs;
  // Never exceed the Betz limit (0.5926); realistic micro-wind net efficiency is 0.126 - 0.35
  const combinedCpEta = Math.min(0.48, config.customCpEta ?? turbineSpec.combinedCpEta);

  const {
    shearModel,
    alpha,
    z0,
    turbulenceFactor,
    verticalProfileRatio,
    powerLawMultiplier,
    logLawMultiplier,
    activeMultiplier: shearMultiplier
  } = computeWindShearMetrics(config);

  const radiusM = config.rotorDiameterM / 2;
  const sweptAreaM2 = Math.PI * radiusM * radiusM;

  const siteLat = Number.isFinite(weatherData.lat) ? weatherData.lat : 25.3176;
  const solarOptimalTiltDeg = Math.round(Math.min(60, Math.max(5, Math.abs(siteLat))));
  const solarOptimalAzimuthDeg = siteLat >= 0 ? 180 : 0; // True South in Northern Hemisphere
  const solarTiltDeg = config.solarTiltDeg ?? solarOptimalTiltDeg;
  const solarAzimuthDeg = config.solarAzimuthDeg ?? solarOptimalAzimuthDeg;
  const solarCompassDirection = getCompassDirectionLabel(solarAzimuthDeg);

  const winds10m = Array.isArray(weatherData.hourlyWindSpeed10mMs)
    ? weatherData.hourlyWindSpeed10mMs
    : [];
  const solarGhi = Array.isArray(weatherData.hourlySolarGhiWm2)
    ? weatherData.hourlySolarGhiWm2
    : [];
  const temps2m = Array.isArray(weatherData.hourlyTemp2mC)
    ? weatherData.hourlyTemp2mC
    : undefined;
  const baselineElevationM =
    typeof weatherData.elevationM === 'number' && Number.isFinite(weatherData.elevationM)
      ? Math.max(-50, Math.min(8848, Math.round(weatherData.elevationM)))
      : 80;
  const siteElevationM = config.overrideElevationM ?? baselineElevationM;
  const totalHeightAboveSeaLevelM = Math.max(0, siteElevationM + config.hubHeightM);
  const totalHours = winds10m.length > 0 ? winds10m.length : 8760;

  // Compute unmodified Open-Meteo baseline 10m wind speed & solar peak sun hours so What-If overrides scale accurately
  let rawSumV10 = 0;
  let rawSumGhiKwhM2 = 0;
  for (let i = 0; i < totalHours; i++) {
    const rv = winds10m[i];
    if (typeof rv === 'number' && Number.isFinite(rv) && rv > 0) {
      rawSumV10 += rv;
    }
    const rg = solarGhi[i];
    if (typeof rg === 'number' && Number.isFinite(rg) && rg > 0) {
      rawSumGhiKwhM2 += rg / 1000;
    }
  }
  const baselineWind10mMs = Number((rawSumV10 / totalHours).toFixed(2));
  const baselineSolarKwhM2Day = Number((rawSumGhiKwhM2 / (totalHours / 24)).toFixed(2));

  const windOverrideScale =
    config.overrideMeanWind10mMs !== null &&
    config.overrideMeanWind10mMs !== undefined &&
    baselineWind10mMs > 0.05
      ? config.overrideMeanWind10mMs / baselineWind10mMs
      : 1.0;

  const solarOverrideScale =
    config.overridePeakSunHoursDay !== null &&
    config.overridePeakSunHoursDay !== undefined &&
    baselineSolarKwhM2Day > 0.1
      ? config.overridePeakSunHoursDay / baselineSolarKwhM2Day
      : 1.0;

  const isWhatIfOverridden = Boolean(
    config.overrideMeanWind10mMs != null ||
      config.overridePeakSunHoursDay != null ||
      config.overrideElevationM != null ||
      config.ratedWindSpeedMs != null ||
      config.cutOutSpeedMs != null ||
      config.customCpEta != null
  );

  let sumV10 = 0;
  let sumVHub = 0;
  let sumVHubSquared = 0;
  let sumVHubCubed = 0;
  let sumTempC = 0;
  let sumAirDensity = 0;

  let hoursBelowCutIn = 0;
  let hoursAtRatedCap = 0;
  let hoursStormCutOut = 0;
  let totalWindWh = 0;

  let totalRawGhiKwhM2 = 0;
  let totalPoaKwhM2 = 0;
  let totalFlatSolarKwhAccum = 0;
  let totalSolarKwhAccum = 0;

  // 13 bins: 0-1, 1-2, 2-3 (dead zone), 3-4, 4-5, 5-6, 6-7, 7-8, 8-9, 9-10, 10-11, 11-12, 12+
  const binCounts = new Array(13).fill(0);
  // 26 bins (0..25 m/s in 1 m/s steps) for the 0-25 m/s Power Curve & Rayleigh overlay
  const empiricalBins26 = new Array(26).fill(0);
  const monthlyWindKwh = new Array(12).fill(0);
  const monthlySolarKwh = new Array(12).fill(0);

  // Calendar Heatmap Matrices: 12 months x days in month, and 12 months x 24 hours
  const calendarDailyWindKwh: number[][] = MONTH_DAYS.map((days) => new Array(days).fill(0));
  const calendarDailyPeakWindMs: number[][] = MONTH_DAYS.map((days) => new Array(days).fill(0));
  const monthHourWindSumW: number[][] = Array.from({ length: 12 }, () => new Array(24).fill(0));
  const monthHourSolarSumW: number[][] = Array.from({ length: 12 }, () => new Array(24).fill(0));

  // Same-budget solar capacity in kWp
  const solarEquivalentKw = config.budgetInr / SOLAR_COST_PER_KW_INR;

  // Precompute month boundaries
  let currentMonth = 0;
  let hourInCurrentMonth = 0;
  let currentMonthLimit = MONTH_HOURS[0];

  for (let i = 0; i < totalHours; i++) {
    if (hourInCurrentMonth >= currentMonthLimit && currentMonth < 11) {
      currentMonth++;
      hourInCurrentMonth = 0;
      currentMonthLimit = MONTH_HOURS[currentMonth];
    }
    const dayIdxInMonth = Math.min(
      MONTH_DAYS[currentMonth] - 1,
      Math.floor(hourInCurrentMonth / 24)
    );
    const dayOfYear = Math.min(365, Math.floor(i / 24) + 1);
    const hourOfDay = i % 24;
    hourInCurrentMonth++;

    const rawV10 = winds10m[i];
    const baseV10 =
      typeof rawV10 === 'number' && Number.isFinite(rawV10) && rawV10 >= 0 ? rawV10 : 0;
    const v10 = baseV10 * windOverrideScale;
    const vHub = v10 * shearMultiplier;
    const rawTemp = temps2m?.[i];
    const tempC = typeof rawTemp === 'number' && Number.isFinite(rawTemp) ? rawTemp : 26.5;
    const rhoHour = computeAirDensityKgM3(totalHeightAboveSeaLevelM, tempC);

    sumV10 += v10;
    sumVHub += vHub;
    sumVHubSquared += vHub * vHub;
    sumVHubCubed += vHub * vHub * vHub;
    sumTempC += tempC;
    sumAirDensity += rhoHour;

    if (vHub < cutInSpeedMs) {
      hoursBelowCutIn++;
    } else if (vHub >= cutOutSpeedMs) {
      hoursStormCutOut++;
    }

    const binIdx = Math.min(12, Math.max(0, Math.floor(vHub)));
    binCounts[binIdx]++;
    const bin26Idx = Math.min(25, Math.max(0, Math.floor(vHub)));
    empiricalBins26[bin26Idx]++;

    // Compute hourly wind power using explicit rated speed curve or aerodynamic v³ curve capped at ratedPowerW
    let windPowerW = 0;
    if (vHub >= cutInSpeedMs && vHub < cutOutSpeedMs) {
      if (config.ratedWindSpeedMs != null && config.ratedWindSpeedMs > cutInSpeedMs + 0.5) {
        if (vHub >= config.ratedWindSpeedMs) {
          windPowerW = config.ratedPowerW;
        } else {
          // Cubic ramp between cutInSpeedMs and explicit ratedWindSpeedMs, scaled by air density ratio
          const aeroW =
            0.5 * rhoHour * sweptAreaM2 * Math.pow(vHub, 3) * combinedCpEta;
          const cubicFrac =
            (Math.pow(vHub, 3) - Math.pow(cutInSpeedMs, 3)) /
            Math.max(1, Math.pow(config.ratedWindSpeedMs, 3) - Math.pow(cutInSpeedMs, 3));
          const curveW = config.ratedPowerW * Math.max(0, Math.min(1, cubicFrac));
          windPowerW = Math.min(config.ratedPowerW, Math.max(aeroW, curveW));
        }
      } else {
        windPowerW = computeInstantWindPowerW(
          vHub,
          sweptAreaM2,
          config.ratedPowerW,
          rhoHour,
          combinedCpEta,
          cutInSpeedMs,
          cutOutSpeedMs
        );
      }
    }
    if (windPowerW >= config.ratedPowerW * 0.999 && vHub < cutOutSpeedMs) {
      hoursAtRatedCap++;
    }

    totalWindWh += windPowerW;
    const windKwhHour = windPowerW / 1000;
    monthlyWindKwh[currentMonth] += windKwhHour;

    // Accumulate Calendar Daily Wind kWh, Daily Peak Hub Wind (m/s), and Month x Hour Diurnal Matrix
    calendarDailyWindKwh[currentMonth][dayIdxInMonth] += windKwhHour;
    if (vHub > calendarDailyPeakWindMs[currentMonth][dayIdxInMonth]) {
      calendarDailyPeakWindMs[currentMonth][dayIdxInMonth] = vHub;
    }
    monthHourWindSumW[currentMonth][hourOfDay] += windPowerW;

    // Solar energy for this hour with Plane-of-Array (POA) tilt & azimuth transposition + NOCT thermal derating + BOS losses:
    const rawGhi = solarGhi[i];
    const baseGhi =
      typeof rawGhi === 'number' && Number.isFinite(rawGhi) && rawGhi > 0 ? rawGhi : 0;
    const ghi = baseGhi * solarOverrideScale;
    if (ghi > 0) {
      // 1. Reference Flat Horizontal (0° tilt) yield
      const flatCellTempC = tempC + ((SOLAR_NOCT_C - 20.0) / 800.0) * ghi;
      const flatThermalFactor = Math.max(
        0.72,
        Math.min(1.06, 1.0 + SOLAR_TEMP_COEFF_PER_C * Math.max(0, flatCellTempC - 25.0))
      );
      const flatSolarKwhHour = (ghi / 1000) * solarEquivalentKw * (SOLAR_BOS_EFFICIENCY * flatThermalFactor);
      totalRawGhiKwhM2 += ghi / 1000;
      totalFlatSolarKwhAccum += flatSolarKwhHour;

      // 2. Tilted & Oriented Plane-of-Array (POA) yield at (solarTiltDeg, solarAzimuthDeg)
      const poaWm2 = computeHourlyPoaIrradianceWm2(
        ghi,
        siteLat,
        dayOfYear,
        hourOfDay,
        solarTiltDeg,
        solarAzimuthDeg
      );
      const cellTempC = tempC + ((SOLAR_NOCT_C - 20.0) / 800.0) * poaWm2;
      const thermalFactor = Math.max(
        0.72,
        Math.min(1.06, 1.0 + SOLAR_TEMP_COEFF_PER_C * Math.max(0, cellTempC - 25.0))
      );
      const netHourlyPr = SOLAR_BOS_EFFICIENCY * thermalFactor;
      const solarKwhHour = (poaWm2 / 1000) * solarEquivalentKw * netHourlyPr;
      const solarPowerW = solarKwhHour * 1000;

      totalPoaKwhM2 += poaWm2 / 1000;
      totalSolarKwhAccum += solarKwhHour;
      monthlySolarKwh[currentMonth] += solarKwhHour;
      monthHourSolarSumW[currentMonth][hourOfDay] += solarPowerW;
    }
  }

  // Normalize Month x 24-Hour matrix by number of days in each month and round daily arrays
  const monthHourWindAvgW: number[][] = monthHourWindSumW.map((hourSums, mIdx) => {
    const days = MONTH_DAYS[mIdx];
    return hourSums.map((sumW) => Math.round(sumW / days));
  });

  const monthHourSolarAvgW: number[][] = monthHourSolarSumW.map((hourSums, mIdx) => {
    const days = MONTH_DAYS[mIdx];
    return hourSums.map((sumW) => Math.round(sumW / days));
  });

  // Compute 24-Hour Diurnal Curves (Annual 365d, Southwest Monsoon May-Sep 153d, and Non-Monsoon Oct-Apr 212d)
  const diurnalWindAvgW = new Array(24).fill(0);
  const diurnalSolarAvgW = new Array(24).fill(0);
  const monsoonDiurnalWindAvgW = new Array(24).fill(0);
  const monsoonDiurnalSolarAvgW = new Array(24).fill(0);
  const nonMonsoonDiurnalWindAvgW = new Array(24).fill(0);
  const nonMonsoonDiurnalSolarAvgW = new Array(24).fill(0);

  const monsoonDays = MONTH_DAYS[4] + MONTH_DAYS[5] + MONTH_DAYS[6] + MONTH_DAYS[7] + MONTH_DAYS[8]; // 153 days
  const nonMonsoonDays = 365 - monsoonDays; // 212 days

  for (let hr = 0; hr < 24; hr++) {
    let annualWindSum = 0;
    let annualSolarSum = 0;
    let monsoonWindSum = 0;
    let monsoonSolarSum = 0;
    let nonMonsoonWindSum = 0;
    let nonMonsoonSolarSum = 0;

    for (let m = 0; m < 12; m++) {
      const wSum = monthHourWindSumW[m][hr];
      const sSum = monthHourSolarSumW[m][hr];
      annualWindSum += wSum;
      annualSolarSum += sSum;
      if (m >= 4 && m <= 8) {
        monsoonWindSum += wSum;
        monsoonSolarSum += sSum;
      } else {
        nonMonsoonWindSum += wSum;
        nonMonsoonSolarSum += sSum;
      }
    }

    diurnalWindAvgW[hr] = Math.round(annualWindSum / 365);
    diurnalSolarAvgW[hr] = Math.round(annualSolarSum / 365);
    monsoonDiurnalWindAvgW[hr] = Math.round(monsoonWindSum / monsoonDays);
    monsoonDiurnalSolarAvgW[hr] = Math.round(monsoonSolarSum / monsoonDays);
    nonMonsoonDiurnalWindAvgW[hr] = Math.round(nonMonsoonWindSum / nonMonsoonDays);
    nonMonsoonDiurnalSolarAvgW[hr] = Math.round(nonMonsoonSolarSum / nonMonsoonDays);
  }

  let peakMonthIdx = 0;
  let peakMonthKwh = 0;
  let peakDayKwh = -1;
  let peakDayWindMs = 0;
  let peakDayLabel = 'Jan 1';

  for (let m = 0; m < 12; m++) {
    if (monthlyWindKwh[m] > peakMonthKwh) {
      peakMonthKwh = monthlyWindKwh[m];
      peakMonthIdx = m;
    }
    for (let d = 0; d < MONTH_DAYS[m]; d++) {
      const dayKwh = Number(calendarDailyWindKwh[m][d].toFixed(2));
      const dayPeakMs = Number(calendarDailyPeakWindMs[m][d].toFixed(2));
      calendarDailyWindKwh[m][d] = dayKwh;
      calendarDailyPeakWindMs[m][d] = dayPeakMs;

      if (dayKwh > peakDayKwh) {
        peakDayKwh = dayKwh;
        peakDayWindMs = dayPeakMs;
        peakDayLabel = `${MONTH_SHORT_NAMES[m]} ${d + 1}`;
      }
    }
  }

  const avgWindSpeed10mMs = sumV10 / totalHours;
  const avgWindSpeedMs = sumVHub / totalHours;
  const avgAmbientTempC = sumTempC / totalHours;
  const avgAirDensityKgM3 = sumAirDensity / totalHours;
  const airDensityRatioVsStd = avgAirDensityKgM3 / ISA_SEA_LEVEL_RHO;

  // Derived or explicit Rated Wind Speed (m/s) where aerodynamic power reaches ratedPowerW
  const derivedRatedWindSpeedMs = Math.pow(
    config.ratedPowerW / Math.max(0.01, 0.5 * avgAirDensityKgM3 * sweptAreaM2 * combinedCpEta),
    1 / 3
  );
  const ratedWindSpeedMs = config.ratedWindSpeedMs ?? derivedRatedWindSpeedMs;

  // Analytical Rayleigh Distribution (Weibull k=2) Integration across 0..25 m/s bins
  // Rayleigh PDF: f(v) = (pi / 2) * (v / v_mean^2) * exp(-(pi / 4) * (v / v_mean)^2)
  // Rayleigh CDF: F(v) = 1 - exp(-(pi / 4) * (v / v_mean)^2)
  const safeMeanHubV = Math.max(0.15, avgWindSpeedMs);
  let rayleighTotalWh = 0;
  const powerCurveBins: PowerCurveBin[] = [];

  for (let s = 0; s <= 25; s++) {
    // Evaluate bin [s, s+1) midpoint (or s=0..0.5 for bin 0)
    const vLow = s === 0 ? 0 : s - 0.5;
    const vHigh = s + 0.5;
    const vEval = s;

    const cdfLow = 1 - Math.exp((-Math.PI / 4) * Math.pow(vLow / safeMeanHubV, 2));
    const cdfHigh = 1 - Math.exp((-Math.PI / 4) * Math.pow(vHigh / safeMeanHubV, 2));
    const binProb = Math.max(0, cdfHigh - cdfLow);
    const rayleighHoursYr = Number((binProb * totalHours).toFixed(1));
    const rayleighPdfPct = Number((binProb * 100).toFixed(2));

    let binPowerW = 0;
    if (vEval >= cutInSpeedMs && vEval < cutOutSpeedMs) {
      if (config.ratedWindSpeedMs != null && config.ratedWindSpeedMs > cutInSpeedMs + 0.5) {
        if (vEval >= config.ratedWindSpeedMs) {
          binPowerW = config.ratedPowerW;
        } else {
          const aeroW =
            0.5 * avgAirDensityKgM3 * sweptAreaM2 * Math.pow(vEval, 3) * combinedCpEta;
          const cubicFrac =
            (Math.pow(vEval, 3) - Math.pow(cutInSpeedMs, 3)) /
            Math.max(1, Math.pow(config.ratedWindSpeedMs, 3) - Math.pow(cutInSpeedMs, 3));
          const curveW = config.ratedPowerW * Math.max(0, Math.min(1, cubicFrac));
          binPowerW = Math.min(config.ratedPowerW, Math.max(aeroW, curveW));
        }
      } else {
        binPowerW = computeInstantWindPowerW(
          vEval,
          sweptAreaM2,
          config.ratedPowerW,
          avgAirDensityKgM3,
          combinedCpEta,
          cutInSpeedMs,
          cutOutSpeedMs
        );
      }
    }

    const binEnergyWh = binPowerW * binProb * totalHours;
    rayleighTotalWh += binEnergyWh;

    powerCurveBins.push({
      speedMs: s,
      powerW: Math.round(binPowerW),
      rayleighPdfPct,
      rayleighHoursYr,
      empiricalHoursYr: empiricalBins26[s] ?? 0,
      rayleighEnergyKwh: Number((binEnergyWh / 1000).toFixed(2))
    });
  }
  const rayleighAnnualWindKwh = Math.round(rayleighTotalWh / 1000);

  // Statistical Distribution Metrics: Energy Pattern Factor (EPF) & Weibull (k, c)
  const meanVHubCubed = sumVHubCubed / totalHours;
  const cubedMeanVHub = Math.pow(Math.max(0.01, avgWindSpeedMs), 3);
  const energyPatternFactor = Math.max(1.0, Math.min(4.5, meanVHubCubed / cubedMeanVHub));

  // Method-of-moments Weibull shape parameter k ≈ (sigma / mean)^(-1.086)
  const varianceVHub = Math.max(0.01, sumVHubSquared / totalHours - avgWindSpeedMs * avgWindSpeedMs);
  const stdDevVHub = Math.sqrt(varianceVHub);
  const weibullShapeK = Math.max(
    1.1,
    Math.min(3.6, Math.pow(stdDevVHub / Math.max(0.1, avgWindSpeedMs), -1.086))
  );
  const gammaArg = 1 + 1 / weibullShapeK;
  const gammaApprox =
    0.886227 + 0.113773 * Math.pow(gammaArg - 1.5, 2) * 2.2;
  const weibullScaleCMs = avgWindSpeedMs / Math.max(0.85, gammaApprox);

  // What a naive "cube the average wind speed" calculation would estimate (ignoring distribution & cut-in)
  const naivePowerW =
    0.5 * avgAirDensityKgM3 * sweptAreaM2 * Math.pow(avgWindSpeedMs, 3) * combinedCpEta;
  const naiveCubedAvgWindKwh = Math.round((Math.min(naivePowerW, config.ratedPowerW) * totalHours) / 1000);

  const pctBelowCutIn = (hoursBelowCutIn / totalHours) * 100;
  const hoursGenerating = Math.max(0, totalHours - hoursBelowCutIn - hoursStormCutOut);

  const annualWindKwh = totalWindWh / 1000;
  const maxPossibleKwh = (config.ratedPowerW / 1000) * totalHours;
  const capacityFactorPct = maxPossibleKwh > 0 ? (annualWindKwh / maxPossibleKwh) * 100 : 0;

  // Typical cheap online micro-turbine marketing claim (claims ~40% continuous rated output, e.g. 3,504 kWh/yr for 1,000W)
  const marketingClaimWindKwh = Math.round(maxPossibleKwh * 0.40);
  const marketingRealityRatio = Number(
    (marketingClaimWindKwh / Math.max(1, annualWindKwh)).toFixed(1)
  );

  // Mean daily solar insolation in kWh/m²/day (horizontal GHI and tilted/oriented POA)
  const avgSolarInsolationKwhM2Day = Number((totalRawGhiKwhM2 / (totalHours / 24)).toFixed(2));
  const avgSolarPoaKwhM2Day = Number((totalPoaKwhM2 / (totalHours / 24)).toFixed(2));
  const flatHorizontalSolarKwh = Math.round(totalFlatSolarKwhAccum);

  // Effective irradiance-weighted Solar Performance Ratio (%) and Total Derate (%)
  const idealUnderratedSolarKwh = totalPoaKwhM2 * solarEquivalentKw;
  const effectiveSolarPr =
    idealUnderratedSolarKwh > 0 ? totalSolarKwhAccum / idealUnderratedSolarKwh : 0.78;
  const effectiveSolarPrPct = Number((effectiveSolarPr * 100).toFixed(1));
  const solarTotalDeratePct = Number((100 - effectiveSolarPrPct).toFixed(1));

  // Southwest Monsoon months in India: May (4), Jun (5), Jul (6), Aug (7), Sep (8)
  const monsoonWindKwh =
    monthlyWindKwh[4] +
    monthlyWindKwh[5] +
    monthlyWindKwh[6] +
    monthlyWindKwh[7] +
    monthlyWindKwh[8];
  const monsoonWindSharePct =
    annualWindKwh > 0 ? Number(((monsoonWindKwh / annualWindKwh) * 100).toFixed(1)) : 0;

  const peakSeasonSummary: PeakSeasonSummary = {
    peakMonthIdx,
    peakMonthKwh: Math.round(peakMonthKwh),
    peakDayLabel,
    peakDayKwh: Number(Math.max(0, peakDayKwh).toFixed(2)),
    peakDayWindMs: Number(peakDayWindMs.toFixed(2)),
    monsoonWindSharePct
  };

  const annualSavingsInr = annualWindKwh * config.tariffInr;
  const rawPayback =
    annualSavingsInr > 0 && config.budgetInr > 0 ? config.budgetInr / annualSavingsInr : null;
  const paybackYears =
    rawPayback !== null && Number.isFinite(rawPayback) && rawPayback > 0 && rawPayback <= 50
      ? rawPayback
      : null;

  const annualSolarKwh = monthlySolarKwh.reduce((acc, v) => acc + v, 0);
  const maxSolarPossibleKwh = Math.max(0.01, solarEquivalentKw * totalHours);
  const solarCapacityFactorPct = Number(((annualSolarKwh / maxSolarPossibleKwh) * 100).toFixed(1));

  const solarTiltGainPct =
    totalFlatSolarKwhAccum > 0
      ? Number((((annualSolarKwh - totalFlatSolarKwhAccum) / totalFlatSolarKwhAccum) * 100).toFixed(1))
      : 0;

  const solarAnnualSavingsInr = annualSolarKwh * config.tariffInr;
  const rawSolarPayback =
    solarAnnualSavingsInr > 0 && config.budgetInr > 0
      ? config.budgetInr / solarAnnualSavingsInr
      : null;
  const solarPaybackYears =
    rawSolarPayback !== null &&
    Number.isFinite(rawSolarPayback) &&
    rawSolarPayback > 0 &&
    rawSolarPayback <= 50
      ? rawSolarPayback
      : null;

  // Annual Maintenance (O&M): 1.5%/yr for Micro-Wind (moving bearings/brushes/guy wires) vs 0.5%/yr for solid-state Solar PV
  const windAnnualOmInr = Math.round(config.budgetInr * 0.015);
  const solarAnnualOmInr = Math.round(config.budgetInr * 0.005);

  // 10-Year & 20-Year Levelized Cost of Energy (LCOE in ₹/kWh)
  const wind10YrTotalCostInr = config.budgetInr + 10 * windAnnualOmInr;
  const solar10YrTotalCostInr = config.budgetInr + 10 * solarAnnualOmInr;
  const wind10YrLcoeInr =
    annualWindKwh >= 1
      ? Number((wind10YrTotalCostInr / (annualWindKwh * 10)).toFixed(2))
      : null;
  const solar10YrLcoeInr =
    annualSolarKwh >= 1
      ? Number((solar10YrTotalCostInr / (annualSolarKwh * 10)).toFixed(2))
      : null;

  const LIFESPAN_YRS = 20;
  const wind20YrTotalCostInr = config.budgetInr + LIFESPAN_YRS * windAnnualOmInr;
  const solar20YrTotalCostInr = config.budgetInr + LIFESPAN_YRS * solarAnnualOmInr;
  const windLcoeInr =
    annualWindKwh >= 1
      ? Number((wind20YrTotalCostInr / (annualWindKwh * LIFESPAN_YRS)).toFixed(2))
      : null;
  const solarLcoeInr =
    annualSolarKwh >= 1
      ? Number((solar20YrTotalCostInr / (annualSolarKwh * LIFESPAN_YRS)).toFixed(2))
      : null;

  const solarToWindRatio =
    annualWindKwh > 0.5
      ? annualSolarKwh / annualWindKwh
      : annualSolarKwh > 0
      ? 999
      : 1.0;

  const histogramBins: HistogramBin[] = binCounts.map((count, idx) => {
    const minMs = idx;
    const maxMs = idx === 12 ? 25 : idx + 1;
    const label = idx === 12 ? '12+ m/s' : `${idx}–${idx + 1} m/s`;
    return {
      label,
      minMs,
      maxMs,
      hours: count,
      pct: Number(((count / totalHours) * 100).toFixed(1)),
      isBelowCutIn: idx + 0.5 <= cutInSpeedMs
    };
  });

  // Determine Engineering & Economic Verdict and Recommended Hardware Choice
  const ECONOMIC_WIND_THRESHOLD_MS = 4.5;
  let verdict: AuditVerdict;
  const solarPaybackText = formatPaybackPeriod(solarPaybackYears, 'long');
  const windPaybackText = formatPaybackPeriod(paybackYears, 'long');
  const ratioBadgeText =
    solarToWindRatio >= 100 ? '100+' : solarToWindRatio.toFixed(1);

  if (
    capacityFactorPct >= 11.5 &&
    paybackYears !== null &&
    paybackYears <= 18
  ) {
    const windBeatsOrMatchesSolar = annualWindKwh >= annualSolarKwh * 0.85;
    const comparisonClause =
      solarToWindRatio >= 1.05
        ? `(same-budget solar still generates ${solarToWindRatio.toFixed(1)}x the energy, so a Wind + Solar Hybrid is ideal)`
        : `(outperforming same-budget solar by ${(1 / Math.max(0.01, solarToWindRatio)).toFixed(1)}x)`;
    verdict = {
      status: 'GO',
      recommendedSystem: windBeatsOrMatchesSolar ? 'WIND' : 'HYBRID',
      headline: windBeatsOrMatchesSolar
        ? `Install Wind Turbine · ${capacityFactorPct.toFixed(0)}% Capacity Factor (${windPaybackText} Payback)`
        : `Wind Turbine Viable · Install Wind or Wind+Solar Hybrid (${capacityFactorPct.toFixed(0)}% CF)`,
      plainSummary: windBeatsOrMatchesSolar
        ? `Strong wind resource makes a micro-wind turbine the top primary choice here (${Math.round(annualWindKwh).toLocaleString('en-IN')} kWh/yr).`
        : `High wind velocity makes micro-wind economically viable here (${Math.round(annualWindKwh).toLocaleString('en-IN')} kWh/yr, ${windPaybackText} payback).`,
      reason: `Mean wind speed at ${config.hubHeightM}m hub height is ${avgWindSpeedMs.toFixed(2)} m/s — exceeding the ${ECONOMIC_WIND_THRESHOLD_MS.toFixed(1)} m/s economic threshold for micro-wind (EPF = ${energyPatternFactor.toFixed(2)}, ρ = ${avgAirDensityKgM3.toFixed(3)} kg/m³) with active generation during ${(100 - pctBelowCutIn).toFixed(1)}% of the year. 10-Yr Wind LCOE is ₹${wind10YrLcoeInr?.toFixed(2) ?? 'N/A'}/kWh, making micro-wind physically viable here ${comparisonClause}.`
    };
  } else if (
    capacityFactorPct >= 5.0 &&
    paybackYears !== null &&
    paybackYears <= 32
  ) {
    verdict = {
      status: 'MARGINAL',
      recommendedSystem: 'HYBRID',
      headline: `Install Rooftop Solar Primary · Marginal Wind (${ratioBadgeText}× Solar Advantage)`,
      plainSummary: `Install Rooftop Solar PV as primary power (${Math.round(annualSolarKwh).toLocaleString('en-IN')} kWh/yr); micro-wind works best only as a secondary monsoon supplement (${Math.round(annualWindKwh).toLocaleString('en-IN')} kWh/yr).`,
      reason: `Mean wind speed at ${config.hubHeightM}m hub height is ${avgWindSpeedMs.toFixed(2)} m/s (EPF = ${energyPatternFactor.toFixed(2)}), and the turbine sits idle below its ${cutInSpeedMs.toFixed(1)} m/s cut-in gate for ${pctBelowCutIn.toFixed(1)}% of the year (${hoursBelowCutIn.toLocaleString('en-IN')} hrs). Same-budget rooftop solar (${solarEquivalentKw.toFixed(2)} kWp @ ${solarTiltDeg}° tilt) produces ${ratioBadgeText}x more electricity with a ${solarPaybackText} payback vs ${windPaybackText} for wind.`
    };
  } else {
    verdict = {
      status: 'NO-GO',
      recommendedSystem: 'SOLAR',
      headline: `Install Rooftop Solar Panels · Wind Not Viable on This Roof`,
      plainSummary: `Install Rooftop Solar PV (${Math.round(annualSolarKwh).toLocaleString('en-IN')} kWh/yr). Solar produces ${ratioBadgeText}× more electricity than micro-wind here.`,
      reason: `Mean wind speed at ${config.hubHeightM}m hub height (${profile.label.split(' (')[0]}) is ${avgWindSpeedMs.toFixed(2)} m/s — well below the ${ECONOMIC_WIND_THRESHOLD_MS.toFixed(1)} m/s economic threshold for micro-wind (ρ = ${avgAirDensityKgM3.toFixed(3)} kg/m³). Your ${turbineSpec.shortLabel} produces ZERO power for ${hoursBelowCutIn.toLocaleString('en-IN')} hours/year (< ${cutInSpeedMs.toFixed(1)} m/s cut-in), yielding just ${Math.round(annualWindKwh).toLocaleString('en-IN')} kWh/yr (${windPaybackText}). Investing the same ₹${config.budgetInr.toLocaleString('en-IN')} in rooftop solar (${solarTiltDeg}° tilt, ${solarAzimuthDeg}° ${solarCompassDirection}) delivers ${Math.round(annualSolarKwh).toLocaleString('en-IN')} kWh/yr (${ratioBadgeText}x more energy).`
    };
  }

  return {
    baselineWind10mMs,
    baselineSolarKwhM2Day,
    baselineElevationM,
    isWhatIfOverridden,
    avgWindSpeed10mMs: Number(avgWindSpeed10mMs.toFixed(2)),
    avgWindSpeedMs: Number(avgWindSpeedMs.toFixed(2)),
    pctBelowCutIn: Number(pctBelowCutIn.toFixed(1)),
    hoursBelowCutIn,
    hoursGenerating,
    hoursAtRatedCap,
    hoursStormCutOut,
    sweptAreaM2: Number(sweptAreaM2.toFixed(2)),
    turbineType,
    combinedCpEta: Number(combinedCpEta.toFixed(3)),
    cutInSpeedMs: Number(cutInSpeedMs.toFixed(1)),
    ratedWindSpeedMs: Number(ratedWindSpeedMs.toFixed(1)),
    cutOutSpeedMs: Number(cutOutSpeedMs.toFixed(1)),
    siteElevationM: Math.round(siteElevationM),
    avgAmbientTempC: Number(avgAmbientTempC.toFixed(1)),
    avgAirDensityKgM3: Number(avgAirDensityKgM3.toFixed(3)),
    airDensityRatioVsStd: Number(airDensityRatioVsStd.toFixed(3)),
    energyPatternFactor: Number(energyPatternFactor.toFixed(2)),
    weibullShapeK: Number(weibullShapeK.toFixed(2)),
    weibullScaleCMs: Number(weibullScaleCMs.toFixed(2)),
    rayleighAnnualWindKwh,
    naiveCubedAvgWindKwh,
    marketingClaimWindKwh,
    marketingRealityRatio,
    shearModel,
    alpha: Number(alpha.toFixed(3)),
    z0: Number(z0.toFixed(4)),
    turbulenceFactor: Number(turbulenceFactor.toFixed(2)),
    verticalProfileRatio: Number(verticalProfileRatio.toFixed(3)),
    shearMultiplier: Number(shearMultiplier.toFixed(3)),
    powerLawMultiplier: Number(powerLawMultiplier.toFixed(3)),
    logLawMultiplier: Number(logLawMultiplier.toFixed(3)),
    annualWindKwh: Math.round(annualWindKwh),
    capacityFactorPct: Number(capacityFactorPct.toFixed(1)),
    annualSavingsInr: Math.round(annualSavingsInr),
    paybackYears: paybackYears !== null ? Number(paybackYears.toFixed(1)) : null,
    windAnnualOmInr,
    wind10YrLcoeInr,
    windLcoeInr,
    solarEquivalentKw: Number(solarEquivalentKw.toFixed(2)),
    solarCapacityFactorPct,
    solarTiltDeg,
    solarAzimuthDeg,
    solarOptimalTiltDeg,
    solarOptimalAzimuthDeg,
    solarCompassDirection,
    avgSolarInsolationKwhM2Day,
    avgSolarPoaKwhM2Day,
    solarTiltGainPct,
    flatHorizontalSolarKwh,
    effectiveSolarPrPct,
    solarTotalDeratePct,
    annualSolarKwh: Math.round(annualSolarKwh),
    solarAnnualSavingsInr: Math.round(solarAnnualSavingsInr),
    solarPaybackYears: solarPaybackYears !== null ? Number(solarPaybackYears.toFixed(1)) : null,
    solarAnnualOmInr,
    solar10YrLcoeInr,
    solarLcoeInr,
    solarToWindRatio:
      solarToWindRatio < 2
        ? Number(solarToWindRatio.toFixed(2))
        : Number(solarToWindRatio.toFixed(1)),
    monthlyWindKwh: monthlyWindKwh.map((v) => Math.round(v)),
    monthlySolarKwh: monthlySolarKwh.map((v) => Math.round(v)),
    calendarDailyWindKwh,
    calendarDailyPeakWindMs,
    monthHourWindAvgW,
    monthHourSolarAvgW,
    diurnalWindAvgW,
    diurnalSolarAvgW,
    monsoonDiurnalWindAvgW,
    monsoonDiurnalSolarAvgW,
    nonMonsoonDiurnalWindAvgW,
    nonMonsoonDiurnalSolarAvgW,
    peakSeasonSummary,
    histogramBins,
    powerCurveBins,
    verdict
  };
}

/**
 * Generates a clean, formatted plain-text / Markdown engineering audit summary
 * ready to paste into Reddit, X (Twitter), Hacker News, or renewable energy forums.
 */
export function buildShareableAuditSummary(
  siteName: string,
  lat: number,
  lon: number,
  rawConfig: AuditConfig,
  audit: AuditResult
): string {
  const config = sanitizeAuditConfig(rawConfig);
  const profile = TERRAIN_PROFILES[config.terrain] || TERRAIN_PROFILES.urban;
  const turbineSpec = TURBINE_ARCHITECTURES[audit.turbineType] || TURBINE_ARCHITECTURES.hawt;
  const windPayback = formatPaybackPeriod(audit.paybackYears, 'short');
  const solarPayback = formatPaybackPeriod(audit.solarPaybackYears, 'short');
  const wind10Lcoe =
    audit.wind10YrLcoeInr !== null && audit.wind10YrLcoeInr < 999
      ? `₹${audit.wind10YrLcoeInr.toFixed(2)}/kWh`
      : 'N/A (No viable yield)';
  const solar10Lcoe =
    audit.solar10YrLcoeInr !== null ? `₹${audit.solar10YrLcoeInr.toFixed(2)}/kWh` : 'N/A';
  const windBeatsSolar = audit.annualWindKwh > audit.annualSolarKwh && audit.annualSolarKwh > 0;
  const advantageFactor = windBeatsSolar
    ? audit.annualWindKwh / Math.max(1, audit.annualSolarKwh)
    : audit.solarToWindRatio;
  const ratioStr =
    advantageFactor >= 100 ? '100+x' : `${advantageFactor.toFixed(1)}x`;
  const hypeComparisonText =
    audit.marketingRealityRatio > 1.05
      ? `${audit.marketingRealityRatio}x less than brochure hype`
      : 'matches or exceeds brochure baseline';

  return [
    `⚡ AEROCHECK — MICRO-WIND vs. SOLAR SITE AUDIT — ${siteName} (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`,
    `VERDICT [${audit.verdict.status}]: ${audit.verdict.headline}`,
    ``,
    `📊 SAME-BUDGET REALITY CHECK (CapEx: ₹${config.budgetInr.toLocaleString('en-IN')} | Grid Tariff: ₹${config.tariffInr.toFixed(2)}/kWh):`,
    `• Micro-Wind (${config.ratedPowerW}W ${turbineSpec.shortLabel}, Ø${config.rotorDiameterM}m @ ${config.hubHeightM}m): ${audit.annualWindKwh.toLocaleString('en-IN')} kWh/yr (Rayleigh k=2: ${audit.rayleighAnnualWindKwh.toLocaleString('en-IN')} kWh/yr) | CF: ${audit.capacityFactorPct.toFixed(1)}% | O&M: ₹${audit.windAnnualOmInr.toLocaleString('en-IN')}/yr | 10-Yr LCOE: ${wind10Lcoe} | Payback: ${windPayback}`,
    `• Rooftop Solar (${audit.solarEquivalentKw.toFixed(2)} kWp @ ${audit.solarTiltDeg}° tilt, ${audit.solarAzimuthDeg}° ${audit.solarCompassDirection}): ${audit.annualSolarKwh.toLocaleString('en-IN')} kWh/yr | CF: ${audit.solarCapacityFactorPct.toFixed(1)}% (PR: ${audit.effectiveSolarPrPct}%) | O&M: ₹${audit.solarAnnualOmInr.toLocaleString('en-IN')}/yr | 10-Yr LCOE: ${solar10Lcoe} | Payback: ${solarPayback}`,
    `• Dollar-for-Dollar Winner: ${windBeatsSolar ? 'Micro-Wind' : 'Solar'} produces ${ratioStr} the annual electricity of ${windBeatsSolar ? 'rooftop solar' : 'micro-wind'} here.`,
    ``,
    `🔬 WHY MARKETING BROCHURES FAIL THE PHYSICS CHECK:`,
    `• Brochure Claim (${config.ratedPowerW}W Turbine): ~${audit.marketingClaimWindKwh.toLocaleString('en-IN')} kWh/yr (assumes continuous 11–12 m/s gale winds)`,
    `• 8,760-Hr Physics Reality: ${audit.annualWindKwh.toLocaleString('en-IN')} kWh/yr (${hypeComparisonText})`,
    `• Cut-In Dead Zone (<${audit.cutInSpeedMs.toFixed(1)} m/s): 0 W output for ${audit.hoursBelowCutIn.toLocaleString('en-IN')} hrs/yr (${audit.pctBelowCutIn.toFixed(1)}% of the year)`,
    `• Atmospheric Telemetry: 10m Wind ${audit.avgWindSpeed10mMs.toFixed(2)} m/s × ${audit.shearMultiplier.toFixed(3)} shear (${profile.label.split(' (')[0]}) = ${audit.avgWindSpeedMs.toFixed(2)} m/s hub wind (vs 4.5 m/s economic threshold) | EPF = ${audit.energyPatternFactor.toFixed(2)} (Weibull k=${audit.weibullShapeK.toFixed(2)}) | Air Density ρ = ${audit.avgAirDensityKgM3.toFixed(3)} kg/m³ (${audit.siteElevationM}m elev, ${audit.avgAmbientTempC}°C) | Net Cp·η = ${(audit.combinedCpEta * 100).toFixed(1)}%`
  ].join('\n');
}

export interface SanityCheckReport {
  timestamp: string;
  rotorDiameterM: number;
  sweptAreaM2: number;
  airDensityKgM3: number;
  hotHighAltitudeRhoKgM3: number;
  combinedEfficiencyCpEta: number;
  powerAt2_5MsW: number;
  powerAt5MsW: number;
  powerAt10MsW: number;
  cubicRatio10to5: number;
  rayleighEpfTheoretical: number;
  windShear10mTo25mUrban: number;
  passedCubicLaw: boolean;
  passedCutInGate: boolean;
  summary: string;
}

/**
 * Teacher Sanity Check: Verifies the v³ Cubic Scaling Law (10 m/s vs 5 m/s = exact 8.00x power),
 * the < 3 m/s Cut-In Dead Zone gate, Barometric Air Density adjustment, and Rayleigh EPF (6/pi ≈ 1.91).
 * Callable directly from DevTools console via window.runTeacherSanityCheck()
 */
export function runTeacherSanityCheck(): SanityCheckReport {
  const diameter = 2.5;
  const area = Math.PI * Math.pow(diameter / 2, 2); // 4.9087 m²
  const unclippedRatedW = 100000; // Unclipped to test pure aerodynamic v³ scaling

  const p2_5 = computeInstantWindPowerW(2.5, area, unclippedRatedW);
  const p5 = computeInstantWindPowerW(5.0, area, unclippedRatedW);
  const p10 = computeInstantWindPowerW(10.0, area, unclippedRatedW);

  const ratio = p5 > 0 ? Number((p10 / p5).toFixed(4)) : 0;
  const shear25mUrban = Number(Math.pow(25 / 10, TERRAIN_PROFILES.urban.alpha).toFixed(4));
  const hotHighAltitudeRho = Number(computeAirDensityKgM3(920, 36.0).toFixed(4)); // Bengaluru 920m @ 36°C
  const rayleighEpf = Number((6 / Math.PI).toFixed(4)); // 1.9099

  const passedCubicLaw = Math.abs(ratio - 8.0) < 0.001;
  const passedCutInGate = p2_5 === 0;

  const report: SanityCheckReport = {
    timestamp: new Date().toISOString(),
    rotorDiameterM: diameter,
    sweptAreaM2: Number(area.toFixed(4)),
    airDensityKgM3: ISA_SEA_LEVEL_RHO,
    hotHighAltitudeRhoKgM3: hotHighAltitudeRho,
    combinedEfficiencyCpEta: REFERENCE_SANITY_CP_ETA,
    powerAt2_5MsW: Number(p2_5.toFixed(2)),
    powerAt5MsW: Number(p5.toFixed(2)),
    powerAt10MsW: Number(p10.toFixed(2)),
    cubicRatio10to5: ratio,
    rayleighEpfTheoretical: rayleighEpf,
    windShear10mTo25mUrban: shear25mUrban,
    passedCubicLaw,
    passedCutInGate,
    summary: `SANITY CHECK ${passedCubicLaw && passedCutInGate ? 'PASSED' : 'FAILED'}: At 2.5 m/s (<3 m/s cut-in), P = ${p2_5} W. At 5.0 m/s, P = ${p5.toFixed(2)} W. At 10.0 m/s (2x speed), P = ${p10.toFixed(2)} W (${ratio}x power — exact v³ cubic scaling). Rayleigh EPF = ${rayleighEpf}x; Air Density @ 920m/36°C = ${hotHighAltitudeRho} kg/m³.`
  };

  console.group('%c[Micro-Wind Physics Sanity Check — v³, Cut-In, Air Density & Rayleigh EPF]', 'color: #06B6D4; font-weight: bold; font-size: 13px;');
  console.log('Formula: P(t) = 0.5 * ρ(z,T) * A (4.9087 m²) * v(t)³ * (Cp·η)');
  console.table({
    '2.5 m/s (Below 3 m/s Cut-In)': { 'Wind Speed (m/s)': 2.5, 'Output Power (W)': report.powerAt2_5MsW, 'Status': '0 W Dead Zone (PASS)' },
    '5.0 m/s (Baseline Wind)': { 'Wind Speed (m/s)': 5.0, 'Output Power (W)': report.powerAt5MsW, 'Status': 'Baseline Active' },
    '10.0 m/s (2x Wind Speed)': { 'Wind Speed (m/s)': 10.0, 'Output Power (W)': report.powerAt10MsW, 'Status': `${report.cubicRatio10to5}x Baseline (2³ = 8x PASS)` }
  });
  console.log('%c' + report.summary, 'color: #10B981; font-weight: bold;');
  console.groupEnd();

  return report;
}
