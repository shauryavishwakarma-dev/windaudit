import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Sliders,
  RotateCcw,
  Trees,
  Settings2,
  Layers,
  MapPin,
  Gauge
} from 'lucide-react';
import {
  AuditConfig,
  TERRAIN_PROFILES,
  TURBINE_ARCHITECTURES,
  TurbineType,
  computeWindShearMetrics,
  computeAirDensityKgM3,
  ShearModel
} from '../physics';
import { useLanguage } from '../i18n';

interface ControlsPanelProps {
  config: AuditConfig;
  onChange: (updated: Partial<AuditConfig>) => void;
  onReset: () => void;
  sweptAreaM2: number;
  shearMultiplier: number;
  lat?: number;
  lon?: number;
  onApplyCoords?: (lat: number, lon: number) => void;
  baselineWind10mMs?: number;
  baselineSolarKwhM2Day?: number;
  baselineElevationM?: number;
  activeRatedWindSpeedMs?: number;
  avgAmbientTempC?: number;
}

const STANDARD_ALPHA_PRESETS = [
  { label: '0.10 · Coastal', value: 0.10 },
  { label: '0.14 · 1/7th Open', value: 0.14 },
  { label: '0.22 · Suburban', value: 0.22 },
  { label: '0.30 · Urban Roof', value: 0.30 },
  { label: '0.40 · Deep Canyon', value: 0.40 }
];

const STANDARD_Z0_PRESETS = [
  { label: '0.002m · Salt Flat', value: 0.002 },
  { label: '0.03m · Farmland', value: 0.03 },
  { label: '0.30m · Suburban', value: 0.30 },
  { label: '1.00m · Urban Roof', value: 1.00 },
  { label: '1.50m · High-Rise', value: 1.50 }
];

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  config,
  onChange,
  onReset,
  sweptAreaM2,
  shearMultiplier,
  lat = 25.3176,
  lon = 82.9739,
  onApplyCoords,
  baselineWind10mMs = 2.45,
  baselineSolarKwhM2Day = 5.15,
  baselineElevationM = 80,
  activeRatedWindSpeedMs = 11.2,
  avgAmbientTempC = 26.5
}) => {
  const { t } = useLanguage();
  const [showAdvancedShear, setShowAdvancedShear] = useState<boolean>(false);
  const [showAdvancedPhysics, setShowAdvancedPhysics] = useState<boolean>(false);
  const [latInput, setLatInput] = useState<string>(lat.toFixed(4));
  const [lonInput, setLonInput] = useState<string>(lon.toFixed(4));

  useEffect(() => {
    setLatInput(lat.toFixed(4));
    setLonInput(lon.toFixed(4));
  }, [lat, lon]);

  const terrainProfile = TERRAIN_PROFILES[config.terrain] || TERRAIN_PROFILES.urban;
  const shearMetrics = computeWindShearMetrics(config);
  const activeShearModel: ShearModel = config.shearModel ?? 'power_law';
  const activeTurbineType: TurbineType = config.turbineType ?? 'hawt';
  const activeTurbineSpec = TURBINE_ARCHITECTURES[activeTurbineType] || TURBINE_ARCHITECTURES.hawt;

  const effectiveWind10m = config.overrideMeanWind10mMs ?? baselineWind10mMs;
  const effectivePeakSunHours = config.overridePeakSunHoursDay ?? baselineSolarKwhM2Day;
  const effectiveElevationM = config.overrideElevationM ?? baselineElevationM;
  const effectiveCutInMs = config.cutInSpeedMs ?? activeTurbineSpec.cutInMs;
  const effectiveRatedMs = config.ratedWindSpeedMs ?? activeRatedWindSpeedMs;
  const effectiveCutOutMs = config.cutOutSpeedMs ?? activeTurbineSpec.cutOutMs;
  const effectiveCpEta = config.customCpEta ?? activeTurbineSpec.combinedCpEta;
  const previewRho = computeAirDensityKgM3(
    effectiveElevationM + config.hubHeightM,
    avgAmbientTempC
  );

  const hasWhatIfOverrides = Boolean(
    config.overrideMeanWind10mMs != null ||
      config.overridePeakSunHoursDay != null ||
      config.overrideElevationM != null ||
      config.cutInSpeedMs != null ||
      config.ratedWindSpeedMs != null ||
      config.cutOutSpeedMs != null ||
      config.customCpEta != null
  );

  const handleSelectTerrainPreset = (terrainKey: string) => {
    onChange({
      terrain: terrainKey,
      customAlpha: null,
      customZ0: null
    });
  };

  const handleSelectShearModel = (model: ShearModel) => {
    onChange({ shearModel: model });
  };

  const handleCoordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onApplyCoords) return;
    const parsedLat = Number(latInput);
    const parsedLon = Number(lonInput);
    if (
      Number.isFinite(parsedLat) &&
      Number.isFinite(parsedLon) &&
      parsedLat >= -90 &&
      parsedLat <= 90 &&
      parsedLon >= -180 &&
      parsedLon <= 180
    ) {
      onApplyCoords(parsedLat, parsedLon);
    }
  };

  const sliderPct = (value: number, min: number, max: number) =>
    `${Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)).toFixed(1)}%`;

  const SYSTEM_SIZE_PRESETS = [
    { label: 'Home (1 kW)', ratedPowerW: 1000, rotorDiameterM: 1.8, budgetInr: 150000 },
    { label: 'Farm (3 kW)', ratedPowerW: 3000, rotorDiameterM: 3.2, budgetInr: 320000 },
    { label: 'Comm (5 kW)', ratedPowerW: 5000, rotorDiameterM: 4.6, budgetInr: 480000 }
  ];

  return (
    <div className="flex flex-col justify-between border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/35 dark:bg-[#101216] p-5 sm:p-6">
      {/* Screen Interactive Sliders */}
      <div className="no-print">
        <div className="mb-4 flex items-center justify-between border-b border-[#D4D4CE] dark:border-[#22252A] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] text-[#0F62FE] dark:text-sky-400">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-mono-tabular text-xs font-bold uppercase tracking-widest text-[#111315] dark:text-[#F3F4F6]">
                {t('ctrl_title')}
              </h2>
              <p className="text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
                {t('ctrl_subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowAdvancedShear(false);
              setShowAdvancedPhysics(false);
              onReset();
            }}
            className="flex items-center gap-1 border border-[#D4D4CE] dark:border-[#2E333C] bg-[#F4F4F0] dark:bg-[#0A0B0D] px-2.5 py-1 font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-[#52565E] dark:text-[#9CA3AF] transition-colors hover:border-[#0F62FE] hover:text-[#0F62FE] dark:hover:border-sky-400 dark:hover:text-sky-400 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>{t('ctrl_reset')}</span>
          </button>
        </div>

        {/* Sub-Grid for Sliders */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-1">
          {/* 0. Turbine Architecture */}
          <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/80 dark:bg-[#0A0B0D]/80 p-3 sm:col-span-2 lg:col-span-1">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono-tabular text-[10px] font-bold uppercase tracking-widest text-[#52565E] dark:text-[#9CA3AF]">
                {t('ctrl_arch')}
              </span>
              <span className="border border-[#0F62FE]/30 dark:border-sky-400/30 bg-[#0F62FE]/10 dark:bg-sky-500/10 px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-[#0F62FE] dark:text-sky-400">
                {activeTurbineType === 'hawt' ? '3-Blade Horizontal' : 'Helical Vertical'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6] dark:bg-[#101216] p-1">
              {(['hawt', 'vawt'] as const).map((tKey) => {
                const spec = TURBINE_ARCHITECTURES[tKey];
                const isSelected = activeTurbineType === tKey;
                return (
                  <button
                    key={tKey}
                    type="button"
                    onClick={() => onChange({ turbineType: tKey, cutInSpeedMs: null })}
                    className={`px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#0F62FE] text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950'
                        : 'text-[#52565E] dark:text-[#9CA3AF] hover:bg-[#F4F4F0] dark:hover:bg-[#181B21] hover:text-[#111315] dark:hover:text-white'
                    }`}
                  >
                    <div className="font-mono-tabular text-[11px] font-bold uppercase tracking-wide">
                      {tKey === 'hawt' ? '3-Blade HAWT' : 'Helical VAWT'}
                    </div>
                    <div
                      className={`text-[10px] ${
                        isSelected
                          ? 'text-white/85 dark:text-[#0A0B0D]/80'
                          : 'text-[#52565E] dark:text-[#9CA3AF]'
                      }`}
                    >
                      {tKey === 'hawt' ? 'High efficiency' : 'Low rooftop noise'}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick System Size Presets */}
            <div className="mt-2.5 flex items-center justify-between gap-1.5">
              {SYSTEM_SIZE_PRESETS.map((preset) => {
                const isActivePreset =
                  config.ratedPowerW === preset.ratedPowerW &&
                  Math.abs(config.rotorDiameterM - preset.rotorDiameterM) < 0.05;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      onChange({
                        ratedPowerW: preset.ratedPowerW,
                        rotorDiameterM: preset.rotorDiameterM,
                        budgetInr: preset.budgetInr
                      })
                    }
                    className={`flex-1 border py-1 px-1.5 font-mono-tabular text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                      isActivePreset
                        ? 'border-[#0F62FE] bg-[#0F62FE] text-white dark:border-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950'
                        : 'border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#101216] text-[#52565E] dark:text-[#9CA3AF] hover:border-[#0F62FE] dark:hover:border-sky-400'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1. Mounting Hub Height */}
          <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/80 dark:bg-[#0A0B0D]/80 p-3">
            <div className="mb-2 flex items-baseline justify-between">
              <label htmlFor="slider-hub-height" className="text-xs font-semibold text-[#111315] dark:text-[#F3F4F6]">
                {t('ctrl_hub_height')}
              </label>
              <div className="font-mono-tabular text-xs font-bold text-[#0F62FE] dark:text-sky-400">
                {config.hubHeightM} m{' '}
                <span className="text-[10px] font-medium text-[#52565E] dark:text-[#9CA3AF]">
                  ({config.hubHeightM <= 10 ? 'Parapet' : config.hubHeightM <= 20 ? 'Roof Mast' : 'Tower'})
                </span>
              </div>
            </div>
            <input
              id="slider-hub-height"
              type="range"
              min={6}
              max={40}
              step={1}
              value={config.hubHeightM}
              style={{ '--slider-pct': sliderPct(config.hubHeightM, 6, 40) } as React.CSSProperties}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) {
                  onChange({ hubHeightM: Math.min(120, Math.max(3, Math.round(v))) });
                }
              }}
              className="aero-slider w-full"
            />
            <div className="font-mono-tabular mt-1.5 flex justify-between text-[10px] text-[#52565E] dark:text-[#6B7280]">
              <span>6m</span>
              <span>15m</span>
              <span>40m</span>
            </div>
          </div>

          {/* 2. Rotor Blade Diameter */}
          <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/80 dark:bg-[#0A0B0D]/80 p-3">
            <div className="mb-2 flex items-baseline justify-between">
              <label htmlFor="slider-rotor-diameter" className="text-xs font-semibold text-[#111315] dark:text-[#F3F4F6]">
                {t('ctrl_rotor_diam')}
              </label>
              <div className="font-mono-tabular text-xs font-bold text-[#0F62FE] dark:text-sky-400">
                {config.rotorDiameterM.toFixed(1)} m{' '}
                <span className="text-[10px] font-medium text-[#52565E] dark:text-[#9CA3AF]">
                  (A = {sweptAreaM2.toFixed(2)} m²)
                </span>
              </div>
            </div>
            <input
              id="slider-rotor-diameter"
              type="range"
              min={1.0}
              max={6.0}
              step={0.1}
              value={config.rotorDiameterM}
              style={{ '--slider-pct': sliderPct(config.rotorDiameterM, 1.0, 6.0) } as React.CSSProperties}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) {
                  onChange({ rotorDiameterM: Math.min(20, Math.max(0.5, Number(v.toFixed(1)))) });
                }
              }}
              className="aero-slider w-full"
            />
            <div className="font-mono-tabular mt-1.5 flex justify-between text-[10px] text-[#52565E] dark:text-[#6B7280]">
              <span>1.0m</span>
              <span>2.5m</span>
              <span>6.0m</span>
            </div>
          </div>

          {/* 3. Rated Generator Power */}
          <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/80 dark:bg-[#0A0B0D]/80 p-3">
            <div className="mb-2 flex items-baseline justify-between">
              <label htmlFor="slider-rated-power" className="text-xs font-semibold text-[#111315] dark:text-[#F3F4F6]">
                {t('ctrl_rated_power')}
              </label>
              <div className="font-mono-tabular text-xs font-bold text-[#0F62FE] dark:text-sky-400">
                {config.ratedPowerW.toLocaleString('en-IN')} W
                <span className="ml-1.5 text-[10px] font-medium text-[#52565E] dark:text-[#9CA3AF]">
                  ({(config.ratedPowerW / 1000).toFixed(1)} kW)
                </span>
              </div>
            </div>
            <input
              id="slider-rated-power"
              type="range"
              min={500}
              max={5000}
              step={100}
              value={config.ratedPowerW}
              style={{ '--slider-pct': sliderPct(config.ratedPowerW, 500, 5000) } as React.CSSProperties}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) {
                  onChange({ ratedPowerW: Math.min(50000, Math.max(100, Math.round(v))) });
                }
              }}
              className="aero-slider w-full"
            />
            <div className="font-mono-tabular mt-1.5 flex justify-between text-[10px] text-[#52565E] dark:text-[#6B7280]">
              <span>500 W</span>
              <span>1,000 W</span>
              <span>5,000 W</span>
            </div>
          </div>

          {/* 4. Installed Turbine Budget */}
          <div className="border border-[#059669]/40 dark:border-[#10B981]/35 bg-[#059669]/5 dark:bg-[#10B981]/8 p-3">
            <div className="mb-2 flex items-baseline justify-between">
              <label htmlFor="slider-budget" className="text-xs font-semibold text-[#111315] dark:text-[#F3F4F6]">
                {t('ctrl_budget')}
              </label>
              <div className="font-mono-tabular text-xs font-bold text-[#059669] dark:text-[#34D399]">
                ₹{config.budgetInr.toLocaleString('en-IN')}
                <span className="ml-1.5 text-[10px] font-medium text-[#52565E] dark:text-[#9CA3AF]">
                  (= {(config.budgetInr / 60000).toFixed(2)} kW Solar)
                </span>
              </div>
            </div>
            <input
              id="slider-budget"
              type="range"
              min={50000}
              max={500000}
              step={10000}
              value={config.budgetInr}
              style={{ '--slider-pct': sliderPct(config.budgetInr, 50000, 500000) } as React.CSSProperties}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) {
                  onChange({ budgetInr: Math.min(10000000, Math.max(10000, Math.round(v))) });
                }
              }}
              className="aero-slider w-full"
            />
            <div className="font-mono-tabular mt-1.5 flex justify-between text-[10px] text-[#52565E] dark:text-[#6B7280]">
              <span>₹50,000</span>
              <span>₹1,50,000</span>
              <span>₹5,00,000</span>
            </div>
          </div>

          {/* 5. Electricity Tariff */}
          <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/80 dark:bg-[#0A0B0D]/80 p-3 sm:col-span-2 lg:col-span-1">
            <div className="mb-2 flex items-baseline justify-between">
              <label htmlFor="slider-tariff" className="text-xs font-semibold text-[#111315] dark:text-[#F3F4F6]">
                {t('ctrl_tariff')}
              </label>
              <div className="font-mono-tabular text-xs font-bold text-[#0F62FE] dark:text-sky-400">
                ₹{config.tariffInr.toFixed(1)} /kWh
              </div>
            </div>
            <input
              id="slider-tariff"
              type="range"
              min={4}
              max={15}
              step={0.5}
              value={config.tariffInr}
              style={{ '--slider-pct': sliderPct(config.tariffInr, 4, 15) } as React.CSSProperties}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) {
                  onChange({ tariffInr: Math.min(50, Math.max(0.5, Number(v.toFixed(1)))) });
                }
              }}
              className="aero-slider w-full"
            />
            <div className="font-mono-tabular mt-1.5 flex justify-between text-[10px] text-[#52565E] dark:text-[#6B7280]">
              <span>₹4.0 /kWh</span>
              <span>₹8.0 /kWh</span>
              <span>₹15.0 /kWh</span>
            </div>
          </div>

          {/* 6. Terrain Roughness Dropdown + Advanced Wind Shear Model Toggle */}
          <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/80 dark:bg-[#0A0B0D]/80 p-3.5 sm:col-span-2 lg:col-span-1">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="select-terrain"
                className="flex items-center gap-1.5 font-mono-tabular text-[10px] font-bold uppercase tracking-widest text-[#52565E] dark:text-[#9CA3AF]"
              >
                <Trees className="h-3.5 w-3.5 text-[#0F62FE] dark:text-sky-400" />
                <span>{t('ctrl_terrain')}</span>
              </label>

              <button
                type="button"
                onClick={() => setShowAdvancedShear((prev) => !prev)}
                className={`flex items-center gap-1 border px-2 py-1 font-mono-tabular text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                  showAdvancedShear ||
                  activeShearModel === 'logarithmic' ||
                  config.customAlpha != null ||
                  config.customZ0 != null
                    ? 'border-[#0F62FE] bg-[#0F62FE] text-white dark:border-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950'
                    : 'border-[#D4D4CE] dark:border-[#2E333C] bg-[#ECECE6] dark:bg-[#101216] text-[#52565E] dark:text-[#9CA3AF] hover:border-[#0F62FE] dark:hover:border-sky-400'
                }`}
              >
                <Settings2 className="h-3 w-3" />
                <span>
                  {showAdvancedShear ? 'Hide Shear' : 'Advanced Shear'}
                </span>
              </button>
            </div>

            <select
              id="select-terrain"
              value={config.terrain}
              onChange={(e) => handleSelectTerrainPreset(e.target.value)}
              className="w-full border border-[#D4D4CE] dark:border-[#22252A] bg-white/85 dark:bg-[#0A0B0D] px-3 py-2 text-xs font-semibold text-[#111214] dark:text-[#F3F4F6] focus:border-[#0F62FE] dark:focus:border-sky-400 focus:outline-none"
            >
              {Object.values(TERRAIN_PROFILES).map((prof) => (
                <option key={prof.id} value={prof.id} className="bg-white dark:bg-[#101216] text-[#111214] dark:text-[#F3F4F6]">
                  {prof.label}
                </option>
              ))}
            </select>

            {/* Quick Active Shear Equation & Multiplier Summary Pill */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border border-[#D4D4CE] dark:border-[#22252A] bg-white/75 dark:bg-[#0A0B0D] px-2.5 py-1.5 text-[11px]">
              <span className="font-medium text-[#52565E] dark:text-[#9CA3AF]">
                Active Model:{' '}
                <strong className="text-[#111214] dark:text-[#F3F4F6]">
                  {activeShearModel === 'logarithmic'
                    ? `Logarithmic (z₀ = ${shearMetrics.z0}m)`
                    : `Power Law (α = ${shearMetrics.alpha.toFixed(2)})`}
                </strong>
              </span>
              <span className="font-mono-tabular font-extrabold text-[#0F62FE] dark:text-sky-400 whitespace-nowrap">
                ×{shearMetrics.activeMultiplier.toFixed(3)} @ {config.hubHeightM}m
              </span>
            </div>

            {/* Expandable Advanced Wind Shear Drawer: Power Law (Hellmann α) vs. Logarithmic Law (Prandtl z₀) */}
            <AnimatePresence initial={false}>
              {showAdvancedShear && (
                <motion.div
                  key="advanced-shear-drawer"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-3 border-t border-[#D4D4CE] dark:border-[#22252A] pt-3">
                    {/* Segmented Toggle: Power Law vs. Logarithmic Profile */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1 font-bold text-[#111214] dark:text-[#D1D5DB]">
                          <Layers className="h-3 w-3 text-[#0F62FE] dark:text-sky-400" />
                          <span>Boundary-Layer Shear Formulation</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/70 dark:bg-[#0A0B0D] p-1">
                        <button
                          type="button"
                          onClick={() => handleSelectShearModel('power_law')}
                          className={`px-2.5 py-1.5 text-left transition-all ${
                            activeShearModel === 'power_law'
                              ? 'bg-white dark:bg-[#1C2026] text-[#111214] dark:text-[#F3F4F6] border border-[#0F62FE]/50 dark:border-sky-400/50'
                              : 'text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111214] dark:hover:text-[#F3F4F6]'
                          }`}
                        >
                          <div className="text-[11px] font-extrabold text-[#0F62FE] dark:text-sky-400">
                            Power Law (Hellmann α)
                          </div>
                          <div className="font-mono-tabular text-[10px] text-[#52565E] dark:text-[#9CA3AF]">
                            v(h) = v₁₀ · (h / 10)^α
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectShearModel('logarithmic')}
                          className={`px-2.5 py-1.5 text-left transition-all ${
                            activeShearModel === 'logarithmic'
                              ? 'bg-white dark:bg-[#1C2026] text-[#111214] dark:text-[#F3F4F6] border border-emerald-500/50 dark:border-emerald-400/50'
                              : 'text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111214] dark:hover:text-[#F3F4F6]'
                          }`}
                        >
                          <div className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400">
                            Logarithmic Law (z₀)
                          </div>
                          <div className="font-mono-tabular text-[10px] text-[#52565E] dark:text-[#9CA3AF]">
                            v(h) = v₁₀ · ln(h/z₀)/ln(10/z₀)
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Conditional Exponent / Roughness Length Fine-Tuning Controls */}
                    {activeShearModel === 'power_law' ? (
                      <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-white/80 dark:bg-[#0A0B0D] p-2.5">
                        <div className="mb-1.5 flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-[#111214] dark:text-[#D1D5DB]">
                            Hellmann Shear Exponent (α)
                          </span>
                          <span className="font-mono-tabular font-bold text-[#0F62FE] dark:text-sky-400">
                            α = {shearMetrics.alpha.toFixed(2)}
                            {config.customAlpha != null && (
                              <span className="ml-1 bg-sky-500/15 px-1 py-0.2 text-[9px] text-[#0F62FE] dark:text-sky-300">
                                Custom
                              </span>
                            )}
                          </span>
                        </div>

                        <input
                          type="range"
                          min={0.06}
                          max={0.45}
                          step={0.01}
                          value={shearMetrics.alpha}
                          onChange={(e) =>
                            onChange({ customAlpha: Number(e.target.value) })
                          }
                          className="telemetry-slider"
                        />

                        {/* Quick Standard IEC/WMO Exponent Chips */}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {STANDARD_ALPHA_PRESETS.map((item) => {
                            const isCurrent =
                              Math.abs(shearMetrics.alpha - item.value) < 0.005;
                            return (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() => onChange({ customAlpha: item.value })}
                                className={`font-mono-tabular px-2 py-0.5 text-[10px] font-semibold transition-all ${
                                  isCurrent
                                    ? 'bg-[#0F62FE] dark:bg-sky-500 text-white dark:text-slate-950'
                                    : 'bg-[#ECECE6] dark:bg-[#161A20] text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111214] dark:hover:text-[#F3F4F6]'
                                }`}
                              >
                                {item.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-white/80 dark:bg-[#0A0B0D] p-2.5">
                        <div className="mb-1.5 flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-[#111214] dark:text-[#D1D5DB]">
                            Surface Roughness Length (z₀)
                          </span>
                          <span className="font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400">
                            z₀ = {shearMetrics.z0} m
                            {config.customZ0 != null && (
                              <span className="ml-1 bg-emerald-500/15 px-1 py-0.2 text-[9px] text-emerald-700 dark:text-emerald-300">
                                Custom
                              </span>
                            )}
                          </span>
                        </div>

                        <input
                          type="range"
                          min={0.002}
                          max={1.8}
                          step={0.01}
                          value={shearMetrics.z0}
                          onChange={(e) =>
                            onChange({ customZ0: Number(e.target.value) })
                          }
                          className="telemetry-slider"
                        />

                        {/* Quick Standard WMO Roughness Length Chips */}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {STANDARD_Z0_PRESETS.map((item) => {
                            const isCurrent =
                              Math.abs(shearMetrics.z0 - item.value) < 0.005;
                            return (
                              <button
                                key={item.label}
                                type="button"
                                onClick={() => onChange({ customZ0: item.value })}
                                className={`font-mono-tabular px-2 py-0.5 text-[10px] font-semibold transition-all ${
                                  isCurrent
                                    ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950'
                                    : 'bg-[#ECECE6] dark:bg-[#161A20] text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111214] dark:hover:text-[#F3F4F6]'
                                }`}
                              >
                                {item.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Head-to-Head Model Comparison Strip at Current Hub Height */}
                    <div className="grid grid-cols-2 gap-2 border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/70 dark:bg-[#0A0B0D] p-2 text-[10px]">
                      <div
                        className={`p-1.5 ${
                          activeShearModel === 'power_law'
                            ? 'bg-sky-500/15 font-bold text-[#0F62FE] dark:text-sky-300 border border-[#0F62FE]/30 dark:border-sky-400/30'
                            : 'text-[#52565E] dark:text-[#9CA3AF]'
                        }`}
                      >
                        <div>Power Law (α = {shearMetrics.alpha.toFixed(2)})</div>
                        <div className="font-mono-tabular mt-0.5 text-xs font-extrabold">
                          ×{shearMetrics.powerLawMultiplier.toFixed(3)} shear
                        </div>
                      </div>
                      <div
                        className={`p-1.5 ${
                          activeShearModel === 'logarithmic'
                            ? 'bg-emerald-500/15 font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 dark:border-emerald-400/30'
                            : 'text-[#52565E] dark:text-[#9CA3AF]'
                        }`}
                      >
                        <div>Log Law (z₀ = {shearMetrics.z0}m)</div>
                        <div className="font-mono-tabular mt-0.5 text-xs font-extrabold">
                          ×{shearMetrics.logLawMultiplier.toFixed(3)} shear
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="mt-2 text-[11px] leading-relaxed text-[#52565E] dark:text-[#9CA3AF]">
              {terrainProfile.description}
            </p>
          </div>

          {/* 7. Collapsible Advanced Physics & "What-If" Telemetry Overrides (10m Wind, Sun Hours, Altitude, Cut-In/Rated/Cut-Out, Cp·η) */}
          <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/50 dark:bg-[#0A0B0D]/70 p-3.5 sm:col-span-2 lg:col-span-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowAdvancedPhysics((prev) => !prev)}
                className="flex flex-1 items-center justify-between text-left"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#111214] dark:text-[#F3F4F6]">
                  <Gauge className="h-3.5 w-3.5 text-[#0F62FE] dark:text-sky-400" />
                  <span>Advanced Physics &amp; &ldquo;What-If&rdquo; Overrides</span>
                </div>
                <span
                  className={`font-mono-tabular border px-2 py-0.5 text-[10px] font-bold transition-all ${
                    showAdvancedPhysics || hasWhatIfOverrides
                      ? 'border-[#0F62FE] bg-[#0F62FE] text-white dark:border-sky-500 dark:bg-sky-500 dark:text-slate-950'
                      : 'border-[#D4D4CE] dark:border-[#22252A] bg-white/80 dark:bg-[#161A20] text-[#52565E] dark:text-[#9CA3AF]'
                  }`}
                >
                  {showAdvancedPhysics
                    ? 'Hide Overrides'
                    : hasWhatIfOverrides
                    ? 'Overrides Active'
                    : 'Configure'}
                </span>
              </button>
            </div>

            {hasWhatIfOverrides && (
              <div className="mt-2 flex items-center justify-between border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                <span>Manual &ldquo;What-If&rdquo; overrides active</span>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      overrideMeanWind10mMs: null,
                      overridePeakSunHoursDay: null,
                      overrideElevationM: null,
                      cutInSpeedMs: null,
                      ratedWindSpeedMs: null,
                      cutOutSpeedMs: null,
                      customCpEta: null
                    })
                  }
                  className="font-mono-tabular bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-amber-700"
                >
                  Restore Live API
                </button>
              </div>
            )}

            <AnimatePresence initial={false}>
              {showAdvancedPhysics && (
                <motion.div
                  key="advanced-physics-whatif-drawer"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-2.5 border-t border-[#D4D4CE] dark:border-[#22252A] pt-3">
                    {/* What-If 1: Baseline 10m Mean Wind Speed Override */}
                    <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-white/80 dark:bg-[#101216] p-2.5">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px]">
                        <span className="font-semibold text-[#111214] dark:text-[#D1D5DB]">
                          10m Baseline Wind Speed (What-If)
                        </span>
                        <span className="font-mono-tabular font-bold text-[#0F62FE] dark:text-sky-400 whitespace-nowrap">
                          {effectiveWind10m.toFixed(2)} m/s
                          <span className="ml-1 text-[10px] font-normal text-[#52565E] dark:text-[#9CA3AF]">
                            (API: {baselineWind10mMs.toFixed(2)})
                          </span>
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.8}
                        max={10.0}
                        step={0.1}
                        value={effectiveWind10m}
                        onChange={(e) =>
                          onChange({ overrideMeanWind10mMs: Number(e.target.value) })
                        }
                        className="telemetry-slider"
                      />
                    </div>

                    {/* What-If 2: Peak Sun Hours (GHI) Override */}
                    <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-white/80 dark:bg-[#101216] p-2.5">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px]">
                        <span className="font-semibold text-[#111214] dark:text-[#D1D5DB]">
                          Peak Sun Hours / GHI (What-If)
                        </span>
                        <span className="font-mono-tabular font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                          {effectivePeakSunHours.toFixed(2)} kWh/m²/d
                          <span className="ml-1 text-[10px] font-normal text-[#52565E] dark:text-[#9CA3AF]">
                            (API: {baselineSolarKwhM2Day.toFixed(2)})
                          </span>
                        </span>
                      </div>
                      <input
                        type="range"
                        min={2.5}
                        max={7.5}
                        step={0.1}
                        value={effectivePeakSunHours}
                        onChange={(e) =>
                          onChange({ overridePeakSunHoursDay: Number(e.target.value) })
                        }
                        className="telemetry-slider"
                      />
                    </div>

                    {/* What-If 3: Site Elevation / Altitude Air Density Correction */}
                    <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-white/80 dark:bg-[#101216] p-2.5">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px]">
                        <span className="font-semibold text-[#111214] dark:text-[#D1D5DB]">
                          Site Elevation / Altitude (ρ)
                        </span>
                        <span className="font-mono-tabular font-bold text-[#111214] dark:text-[#F3F4F6] whitespace-nowrap">
                          {effectiveElevationM} m ASL · ρ={previewRho.toFixed(3)} kg/m³
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={3500}
                        step={20}
                        value={effectiveElevationM}
                        onChange={(e) =>
                          onChange({ overrideElevationM: Number(e.target.value) })
                        }
                        className="telemetry-slider"
                      />
                    </div>

                    {/* Power Curve Thresholds: Cut-In, Rated, Cut-Out, Net System Efficiency */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-white/80 dark:bg-[#101216] p-2">
                        <div className="mb-1 flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-[#111214] dark:text-[#D1D5DB]">Cut-In Speed</span>
                          <span className="font-mono-tabular font-bold text-rose-600 dark:text-rose-400">
                            {effectiveCutInMs.toFixed(1)} m/s
                          </span>
                        </div>
                        <input
                          type="range"
                          min={2.0}
                          max={4.5}
                          step={0.1}
                          value={effectiveCutInMs}
                          onChange={(e) =>
                            onChange({ cutInSpeedMs: Number(e.target.value) })
                          }
                          className="telemetry-slider"
                        />
                      </div>

                      <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-white/80 dark:bg-[#101216] p-2">
                        <div className="mb-1 flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-[#111214] dark:text-[#D1D5DB]">Rated Speed</span>
                          <span className="font-mono-tabular font-bold text-[#0F62FE] dark:text-sky-400">
                            {effectiveRatedMs.toFixed(1)} m/s
                          </span>
                        </div>
                        <input
                          type="range"
                          min={9.0}
                          max={15.0}
                          step={0.2}
                          value={effectiveRatedMs}
                          onChange={(e) =>
                            onChange({ ratedWindSpeedMs: Number(e.target.value) })
                          }
                          className="telemetry-slider"
                        />
                      </div>

                      <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-white/80 dark:bg-[#101216] p-2">
                        <div className="mb-1 flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-[#111214] dark:text-[#D1D5DB]">Cut-Out Speed</span>
                          <span className="font-mono-tabular font-bold text-[#111214] dark:text-[#F3F4F6]">
                            {effectiveCutOutMs.toFixed(0)} m/s
                          </span>
                        </div>
                        <input
                          type="range"
                          min={18.0}
                          max={25.0}
                          step={0.5}
                          value={effectiveCutOutMs}
                          onChange={(e) =>
                            onChange({ cutOutSpeedMs: Number(e.target.value) })
                          }
                          className="telemetry-slider"
                        />
                      </div>

                      <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-white/80 dark:bg-[#101216] p-2">
                        <div className="mb-1 flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-[#111214] dark:text-[#D1D5DB]">Net Cp·η (&lt;59.3%)</span>
                          <span className="font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400">
                            {(effectiveCpEta * 100).toFixed(1)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.10}
                          max={0.45}
                          step={0.005}
                          value={effectiveCpEta}
                          onChange={(e) =>
                            onChange({ customCpEta: Number(e.target.value) })
                          }
                          className="telemetry-slider"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Compact Single-Line Turbine Spec Summary for @media print */}
      <div className="print-only hidden">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Audited Micro-Wind Configuration Summary
        </div>
        <div className="font-mono-tabular mt-1 text-xs text-slate-900">
          Hub Height: <strong>{config.hubHeightM} m</strong> ({terrainProfile.label}) · Shear Model:{' '}
          <strong>
            {activeShearModel === 'logarithmic'
              ? `Logarithmic (z₀ = ${shearMetrics.z0}m)`
              : `Power Law (α = ${shearMetrics.alpha.toFixed(2)})`}
          </strong>{' '}
          (×{shearMultiplier.toFixed(3)}) · Rotor Diameter:{' '}
          <strong>{config.rotorDiameterM.toFixed(1)} m</strong> ({sweptAreaM2.toFixed(2)} m² Swept Area) · Rated Power:{' '}
          <strong>{config.ratedPowerW.toLocaleString('en-IN')} W</strong> · Budget:{' '}
          <strong>₹{config.budgetInr.toLocaleString('en-IN')}</strong> · Tariff:{' '}
          <strong>₹{config.tariffInr.toFixed(1)}/kWh</strong>
        </div>
      </div>
    </div>
  );
};
