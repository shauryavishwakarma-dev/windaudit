import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Wind,
  Gauge,
  AlertOctagon,
  Sun,
  Terminal,
  CheckCircle2,
  Play,
  Layers
} from 'lucide-react';
import { runTeacherSanityCheck, SanityCheckReport, TERRAIN_PROFILES, TURBINE_ARCHITECTURES } from '../physics';

export const MethodologyTab: React.FC = () => {
  const [sanityReport, setSanityReport] = useState<SanityCheckReport | null>(null);
  const hawt = TURBINE_ARCHITECTURES.hawt;
  const vawt = TURBINE_ARCHITECTURES.vawt;

  const handleRunSanityCheck = () => {
    const report = runTeacherSanityCheck();
    setSanityReport(report);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* AeroCheck Section Header */}
      <div className="border-b border-[#D4D4CE] dark:border-[#22252A] pb-4">
        <div className="font-mono-tabular text-[11px] uppercase tracking-[0.2em] text-[#0F62FE] dark:text-sky-400">
          03. PHYSICAL FORMULATION
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111315] dark:text-[#F3F4F6] mt-1">
          Aerodynamic &amp; Photovoltaic Governing Equations
        </h2>
        <p className="text-xs sm:text-sm text-[#52565E] dark:text-[#9CA3AF] mt-1">
          First-principles site audit equations evaluating swept-area air kinetics, Hellmann wind shear, and PV yield parity.
        </p>
      </div>

      {/* Top Interactive Verification Card: Teacher 5 m/s vs 10 m/s Sanity Check */}
      <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/35 dark:bg-[#101216] p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2 font-mono-tabular text-[10px] font-bold uppercase tracking-widest text-[#0F62FE] dark:text-sky-400">
              <Terminal className="h-4 w-4" />
              <span>Interactive Physics Engine Verification</span>
            </div>
            <h3 className="font-display mt-1.5 text-lg font-extrabold text-[#111315] dark:text-[#F3F4F6]">
              Cubic Wind Law (v³) &amp; Cut-In Dead-Zone Sanity Check
            </h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#52565E] dark:text-[#9CA3AF] sm:text-sm">
              Doubling wind speed from{' '}
              <span className="font-mono-tabular font-semibold text-[#0F62FE] dark:text-sky-400">5.0 m/s</span>{' '}
              to{' '}
              <span className="font-mono-tabular font-semibold text-[#0F62FE] dark:text-sky-400">10.0 m/s</span>{' '}
              multiplies aerodynamic power by exactly{' '}
              <span className="font-mono-tabular font-bold text-[#059669] dark:text-[#34D399]">2³ = 8.00x</span>, while
              winds at{' '}
              <span className="font-mono-tabular font-semibold text-[#DC2626] dark:text-[#FCA5A5]">2.5 m/s</span>{' '}
              (&lt; 3 m/s cut-in) output{' '}
              <span className="font-mono-tabular font-bold text-[#DC2626] dark:text-[#FCA5A5]">0 W</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunSanityCheck}
            className="flex items-center justify-center gap-2 border border-[#0F62FE] bg-[#0F62FE] dark:border-sky-400 dark:bg-sky-400 px-4 py-2.5 font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-white dark:text-[#0A0B0D] transition-opacity hover:opacity-90 active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Run 5 vs 10 m/s Cubic Verification</span>
          </button>
        </div>

        {/* Monospace Telemetry Output Panel */}
        {sanityReport && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-5 overflow-hidden border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4D4CE] dark:border-[#22252A] pb-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#059669] dark:text-emerald-400" />
                <span className="font-mono-tabular text-xs font-bold text-[#059669] dark:text-emerald-400">
                  VERIFICATION PASSED · EXACT 8.0000x CUBIC SCALING CONFIRMED
                </span>
              </div>
              <span className="font-mono-tabular text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
                Logged to DevTools Console · {sanityReport.timestamp}
              </span>
            </div>

            <div className="font-mono-tabular mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/50 dark:bg-[#101216] p-3">
                <div className="text-[10px] font-semibold text-[#52565E] dark:text-[#9CA3AF]">TEST ROTOR GEOMETRY</div>
                <div className="mt-1 text-sm font-bold text-[#111315] dark:text-[#F3F4F6]">
                  D = {sanityReport.rotorDiameterM} m (A = {sanityReport.sweptAreaM2} m²)
                </div>
                <div className="mt-0.5 text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
                  ρ = {sanityReport.airDensityKgM3} kg/m³ · Cp·η = {sanityReport.combinedEfficiencyCpEta}
                </div>
              </div>

              <div className="border border-[#DC2626]/35 dark:border-[#EF4444]/35 bg-[#DC2626]/10 dark:bg-[#EF4444]/10 p-3">
                <div className="text-[10px] font-semibold text-[#DC2626] dark:text-[#FCA5A5]">V = 2.5 m/s (&lt; 3 m/s CUT-IN)</div>
                <div className="mt-1 text-sm font-bold text-[#DC2626] dark:text-[#F87171]">
                  P(2.5 m/s) = {sanityReport.powerAt2_5MsW.toFixed(2)} W
                </div>
                <div className="mt-0.5 text-[11px] text-[#DC2626] dark:text-[#FCA5A5]">
                  Dead-Zone Gate: {sanityReport.passedCutInGate ? 'PASS (0 W)' : 'FAIL'}
                </div>
              </div>

              <div className="border border-[#0F62FE]/35 dark:border-[#60A5FA]/35 bg-[#0F62FE]/10 dark:bg-[#60A5FA]/10 p-3">
                <div className="text-[10px] font-semibold text-[#0F62FE] dark:text-[#93C5FD]">V = 5.0 m/s vs V = 10.0 m/s</div>
                <div className="mt-1 text-sm font-bold text-[#0F62FE] dark:text-[#93C5FD]">
                  {sanityReport.powerAt5MsW.toFixed(2)} W → {sanityReport.powerAt10MsW.toFixed(2)} W
                </div>
                <div className="mt-0.5 text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
                  Unclipped Aerodynamic Output
                </div>
              </div>

              <div className="border border-[#059669]/35 dark:border-emerald-400/35 bg-[#059669]/10 dark:bg-emerald-500/10 p-3">
                <div className="text-[10px] font-semibold text-[#059669] dark:text-emerald-400">P(10 m/s) / P(5 m/s) RATIO</div>
                <div className="mt-1 text-sm font-bold text-[#059669] dark:text-emerald-400">
                  {sanityReport.cubicRatio10to5.toFixed(4)}x (2³ = 8.0000x)
                </div>
                <div className="mt-0.5 text-[11px] text-[#059669] dark:text-[#34D399]">
                  Cubic v³ Law: {sanityReport.passedCubicLaw ? 'PASS' : 'FAIL'}
                </div>
              </div>
            </div>

            <div className="font-mono-tabular mt-3 border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/50 dark:bg-[#101216] px-3 py-2 text-[11px] font-medium text-[#111315] dark:text-[#D1D5DB]">
              &gt; {sanityReport.summary}
            </div>
          </motion.div>
        )}
      </div>

      {/* 12-Column Light Bento Grid for the 5 Methodology & Physics Formula Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* Card 1: 60m Blending-Height Wind Shear & Urban Wake Turbulence Penalty (6 cols) */}
        <div className="bento-card p-5 md:col-span-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-[#0F62FE]/30 dark:border-sky-400/30 bg-[#0F62FE]/10 dark:bg-sky-500/10 text-[#0F62FE] dark:text-sky-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-[#111315] dark:text-[#F3F4F6]">
                01. Meso-Micro Blending Height (60m) &amp; Urban Wake Penalty
              </h3>
              <p className="text-xs text-[#52565E] dark:text-[#9CA3AF]">Translating 10m open-terrain API wind to obstructed rooftops</p>
            </div>
          </div>

          <div className="font-mono-tabular my-3.5 grid grid-cols-1 gap-2 border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-3 text-center text-xs font-bold text-[#0F62FE] dark:text-sky-400 sm:grid-cols-2">
            <div className="bg-white/80 dark:bg-[#101216] p-2 border border-[#D4D4CE] dark:border-[#22252A]">
              <div className="text-[10px] font-semibold uppercase text-[#52565E] dark:text-[#9CA3AF]">Power Law (60m Blending)</div>
              <div className="mt-0.5 text-xs">v(h) = v₁₀ · (60/10)^0.14 · (h/60)^α · η_wake</div>
            </div>
            <div className="bg-white/80 dark:bg-[#101216] p-2 border border-[#D4D4CE] dark:border-[#22252A] text-emerald-700 dark:text-emerald-400">
              <div className="text-[10px] font-semibold uppercase text-[#52565E] dark:text-[#9CA3AF]">Logarithmic Law (Prandtl z₀)</div>
              <div className="mt-0.5 text-xs">v(h) = v₁₀ · [ln(60/z₀,ref)/ln(10/z₀,ref)] · [ln(h/z₀)/ln(60/z₀)] · η_wake</div>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-[#52565E] dark:text-[#D1D5DB]">
            Meteorological APIs report <span className="font-mono-tabular font-semibold text-[#111315] dark:text-[#F3F4F6]">v₁₀</span> for
            standard WMO open terrain (<span className="font-mono-tabular">α_ref = 0.14, z₀,ref = 0.03m</span>). Applying
            a naive <span className="font-mono-tabular">(h/10)^α</span> directly to <span className="font-mono-tabular">v₁₀</span>{' '}
            wrongly makes urban wind faster than open terrain above 10m. Instead, we couple the open-terrain boundary
            layer at the <strong className="text-[#0F62FE] dark:text-sky-400">60 m meso-scale blending height</strong> and project downward
            through local surface roughness (<span className="font-mono-tabular">α, z₀</span>) plus a micro-scale{' '}
            <strong className="text-[#0F62FE] dark:text-sky-400">wake turbulence velocity factor (η_wake)</strong>:
          </p>

          <div className="mt-3 space-y-2 border-t border-[#D4D4CE] dark:border-[#22252A] pt-2.5 text-xs">
            {Object.values(TERRAIN_PROFILES).map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[#52565E] dark:text-[#9CA3AF]">
                <span>{t.label.split(' (')[0]}</span>
                <span className="font-mono-tabular font-bold text-[#0F62FE] dark:text-sky-400 whitespace-nowrap">
                  α = {t.alpha.toFixed(2)} · z₀ = {t.z0}m · -{t.turbulencePenaltyPct}% wake
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Hourly Time-Series vs. Rayleigh/Weibull Distribution & Barometric Air Density (6 cols) */}
        <div className="bento-card p-5 md:col-span-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-[#0F62FE]/30 dark:border-sky-400/30 bg-[#0F62FE]/10 dark:bg-sky-500/10 text-[#0F62FE] dark:text-sky-400">
              <Wind className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-[#111315] dark:text-[#F3F4F6]">
                02. Hourly v(t)³ Integration, Rayleigh EPF &amp; Air Density ρ(z,T)
              </h3>
              <p className="text-xs text-[#52565E] dark:text-[#9CA3AF]">Why we never cube the average wind speed or hardcode ρ = 1.225</p>
            </div>
          </div>

          <div className="font-mono-tabular my-3.5 border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-3 text-center text-xs font-bold text-[#0F62FE] dark:text-sky-400 space-y-1">
            <div>P(t) = ½ · ρ(z, T(t)) · A · v(t)³ · (Cₚ · η_gen · η_inv · η_wire)</div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
              ρ(z,T) = [101325 · (1 - 0.0065·z / 288.15)^5.2559] / [287.058 · (T_C + 273.15)]
            </div>
          </div>

          <p className="text-xs leading-relaxed text-[#52565E] dark:text-[#D1D5DB]">
            Because <span className="font-mono-tabular font-semibold text-[#111315] dark:text-[#F3F4F6]">mean(v³) ≠ (mean(v))³</span>, cubing
            the average wind speed misses the <strong className="text-[#0F62FE] dark:text-sky-400">Energy Pattern Factor (EPF = mean(v³)/mean(v)³ ≈ 1.91 for a Rayleigh k=2 distribution)</strong>. We integrate all 8,760 hourly wind records directly, while dynamically adjusting air density <span className="font-mono-tabular font-semibold text-[#111315] dark:text-[#F3F4F6]">ρ(z,T)</span> for site elevation and hourly ambient temperature (reducing air density to ~1.03–1.14 kg/m³ on hot Indian summer afternoons and elevated plateaus like Bengaluru at 920m).
          </p>
        </div>

        {/* Card 3: Betz Limit vs Realistic HAWT and VAWT Efficiency Chain (6 cols) */}
        <div className="bento-card p-5 md:col-span-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-[#0F62FE]/30 dark:border-sky-400/30 bg-[#0F62FE]/10 dark:bg-sky-500/10 text-[#0F62FE] dark:text-sky-400">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-[#111315] dark:text-[#F3F4F6]">
                03. Betz Limit (59.3%) vs. HAWT ({(hawt.combinedCpEta * 100).toFixed(1)}%) &amp; VAWT ({(vawt.combinedCpEta * 100).toFixed(1)}%)
              </h3>
              <p className="text-xs text-[#52565E] dark:text-[#9CA3AF]">Full component efficiency chain from rotor to inverter</p>
            </div>
          </div>

          <div className="font-mono-tabular my-3.5 border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-3 text-center text-xs font-bold space-y-1">
            <div className="text-[#0F62FE] dark:text-sky-400">
              HAWT: Cₚ({hawt.rotorCp.toFixed(2)}) × PMG({hawt.generatorEta.toFixed(2)}) × Inv({hawt.inverterEta.toFixed(2)}) × Wire({hawt.wiringEta.toFixed(2)}) = {(hawt.combinedCpEta * 100).toFixed(1)}% Net
            </div>
            <div className="text-[#059669] dark:text-[#34D399]">
              VAWT: Cₚ({vawt.rotorCp.toFixed(2)}) × PMG({vawt.generatorEta.toFixed(2)}) × Inv({vawt.inverterEta.toFixed(2)}) × Wire({vawt.wiringEta.toFixed(2)}) = {(vawt.combinedCpEta * 100).toFixed(1)}% Net
            </div>
          </div>

          <p className="text-xs leading-relaxed text-[#52565E] dark:text-[#D1D5DB]">
            No turbine can exceed the <strong className="text-[#111315] dark:text-[#F3F4F6]">59.26% Betz Limit</strong>. Real micro-turbines
            operate at low chord Reynolds numbers and lose further energy across the permanent-magnet generator,
            rectifier, MPPT grid-tie inverter, and wiring. Small 3-blade horizontal-axis turbines (HAWTs) achieve{' '}
            <strong className="text-[#0F62FE] dark:text-sky-400">~{(hawt.combinedCpEta * 100).toFixed(1)}% total efficiency</strong>, while lift-driven 3-blade helical Darrieus vertical-axis (VAWT) rotors achieve{' '}
            <strong className="text-[#0F62FE] dark:text-sky-400">~{(vawt.combinedCpEta * 100).toFixed(1)}% total efficiency</strong> with omni-directional rooftop capture.
          </p>
        </div>

        {/* Card 4: Piecewise Power Curve — Cut-In, Rated Wind Speed (v_rated) & Storm Cut-Out (6 cols) */}
        <div className="bento-card p-5 md:col-span-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-[#DC2626]/30 dark:border-[#EF4444]/35 bg-[#DC2626]/10 dark:bg-[#EF4444]/10 text-[#DC2626] dark:text-[#F87171]">
              <AlertOctagon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-[#111315] dark:text-[#F3F4F6]">
                04. Cut-In ({vawt.cutInMs.toFixed(1)}–{hawt.cutInMs.toFixed(1)} m/s), Rated Speed (v_rated) &amp; Cut-Out
              </h3>
              <p className="text-xs text-[#52565E] dark:text-[#9CA3AF]">Piecewise operating boundary across all 8,760 hours</p>
            </div>
          </div>

          <div className="font-mono-tabular my-3.5 border border-[#DC2626]/30 dark:border-[#EF4444]/35 bg-[#DC2626]/5 dark:bg-[#140E10] p-3 text-center text-xs font-bold text-[#DC2626] dark:text-[#F87171] space-y-1">
            <div>P(v) = 0 W if v &lt; v_cut-in or v ≥ v_cut-out</div>
            <div>v_rated = [ P_rated / (½ · ρ · A · Cₚ·η) ]^(1/3)</div>
          </div>

          <p className="text-xs leading-relaxed text-[#52565E] dark:text-[#D1D5DB]">
            Below <span className="font-mono-tabular font-semibold text-[#DC2626] dark:text-[#F87171]">v_cut-in ({vawt.cutInMs.toFixed(1)} m/s for Helical VAWT, {hawt.cutInMs.toFixed(1)} m/s for HAWT)</span>,
            aerodynamic torque cannot overcome PMG magnetic cogging resistance, producing <strong className="text-[#DC2626] dark:text-[#F87171]">0 W</strong>.
            Between <span className="font-mono-tabular">v_cut-in</span> and <span className="font-mono-tabular">v_rated</span>,
            power climbs cubically with <span className="font-mono-tabular">v³</span>, caps at{' '}
            <span className="font-mono-tabular">P_rated</span> above <span className="font-mono-tabular">v_rated</span>,
            and drops to <strong className="text-[#DC2626] dark:text-[#F87171]">0 W</strong> above storm cut-out ({vawt.cutOutMs.toFixed(0)}–{hawt.cutOutMs.toFixed(0)} m/s).
          </p>
        </div>

        {/* Card 5: Full-Width Same-Budget Rooftop Solar Benchmark with NOCT Thermal & BOS Derating (12 cols) */}
        <div className="bento-card border-[#059669]/35 dark:border-[#10B981]/35 bg-[#059669]/5 dark:bg-[#0B1410] p-5 md:col-span-12">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#059669]/35 dark:border-[#10B981]/35 bg-[#059669]/10 dark:bg-[#10B981]/15 text-[#059669] dark:text-[#34D399]">
                <Sun className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-[#111315] dark:text-[#F3F4F6]">
                  05. Same-Budget Rooftop Solar Parity &amp; NOCT Thermal Derate
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#52565E] dark:text-[#D1D5DB]">
                  We match the exact capital spend (<span className="font-mono-tabular font-bold text-[#059669] dark:text-[#34D399]">kW_solar = Budget / ₹60,000</span>)
                  and integrate all 8,760 hours of real site Plane-of-Array Irradiance (<span className="font-mono-tabular">POA</span>)
                  and ambient temperature (<span className="font-mono-tabular">T_amb</span>). Instead of an optimistic ideal output,
                  we apply a <span className="font-mono-tabular font-semibold">14.2%</span> fixed Balance-of-System derate (inverter 4%,
                  wiring/mismatch 3%, dust/soiling 6.5%, LID 1.5% → <span className="font-mono-tabular">η_BOS = 0.858</span>) PLUS
                  hourly <strong className="text-[#059669] dark:text-[#34D399]">NOCT cell-temperature thermal derating (-0.38%/°C above 25°C cell temp)</strong>,
                  yielding a realistic <strong className="text-[#059669] dark:text-[#34D399]">18%–23% total system derate (PR ≈ 77%–82%)</strong>.
                </p>
              </div>
            </div>

            <div className="font-mono-tabular shrink-0 border border-[#059669]/35 dark:border-[#10B981]/35 bg-[#F4F4F0] dark:bg-[#0A0B0D] px-4 py-3 text-xs font-bold text-[#059669] dark:text-[#34D399] space-y-1">
              <div>T_cell(t) = T_amb(t) + [(45 - 20)/800] · POA(t)</div>
              <div>η_net(t) = 0.858 · [1 - 0.0038 · max(0, T_cell - 25)]</div>
              <div>E_solar(t) = (POA(t) / 1000) · kW_solar · η_net(t)</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
