import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  Camera,
  Sliders,
  Compass,
  Layers,
  Activity,
  Sun,
  Wind,
  RotateCcw,
  GitCompare,
  X
} from 'lucide-react';
import {
  AuditConfig,
  AuditResult,
  TERRAIN_PROFILES,
  TURBINE_ARCHITECTURES,
  computeInstantWindPowerW
} from '../physics';
import { LiveSurfaceTelemetry, PRESET_LIST, SitePreset } from '../api';
import { useLanguage } from '../i18n';
import { AnimatedNumber } from './AnimatedNumber';

interface IglooSpatialStageProps {
  theme?: 'dark' | 'light';
  config: AuditConfig;
  audit: AuditResult | null;
  liveSurface?: LiveSurfaceTelemetry | null;
  siteName: string;
  lat: number;
  lon: number;
  scrollProgress: number; // 0.0 (top of sticky scroll track) to 1.0 (bottom of 4-chapter track)
  activePresetKey: string | null;
  isComparing?: boolean;
  onToggleComparison?: () => void;
  onSelectPreset: (preset: SitePreset) => void;
  onConfigChange: (updated: Partial<AuditConfig>) => void;
  onResetConfig: () => void;
  onScrollToBento: () => void;
  onJumpToChapter?: (chapterIndex: number) => void;
}

type CameraPreset = 'overview' | 'rotor' | 'solar' | 'corridor';
type HoveredPartId =
  | 'rotor_blades'
  | 'stator_generator'
  | 'nacelle_shell'
  | 'tail_vane'
  | 'tower_mast'
  | 'solar_array'
  | null;

interface HoveredPartMeta {
  id: Exclude<HoveredPartId, null>;
  tag: string;
  title: string;
  formula: string;
  summary: string;
  engineeringNote: string;
}

const PART_METADATA: Record<Exclude<HoveredPartId, null>, HoveredPartMeta> = {
  rotor_blades: {
    id: 'rotor_blades',
    tag: '01 // HELICAL ROTOR',
    title: '3-Blade Vertical Helical Darrieus Rotor',
    formula: 'P_aero = ½ · ρ · A · v³ · Cₚ',
    summary:
      'Captures omni-directional wind with no yaw mechanism needed. Returning vertical blades fight oncoming wind, capping aerodynamic efficiency at 15–22%.',
    engineeringNote:
      'Because power scales cubically (v³), light urban rooftop breezes yield negligible electrical output.'
  },
  stator_generator: {
    id: 'stator_generator',
    tag: '02 // AXIAL PMG STATOR',
    title: 'Direct-Drive Axial-Flux Neodymium Stator',
    formula: 'η_combined = Cₚ · η_gen · η_inv ≈ 12.6%–27.5%',
    summary:
      'Multi-pole stator exposed when the cowling splits open. Below 3.0 m/s cut-in speed, internal cogging torque stalls the rotor (0 W).',
    engineeringNote:
      'Brochure 1,000 W output requires continuous 11.5 m/s gale winds rarely observed in Indian cities.'
  },
  nacelle_shell: {
    id: 'nacelle_shell',
    tag: '03 // GENERATOR HOUSING',
    title: 'Articulated Clam-Shell Composite Cowling',
    formula: '847 Precision Mechanical Parts',
    summary:
      'Houses dual ceramic thrust bearings and emergency electromagnetic brake. Splits open on hover to reveal the internal stator core.',
    engineeringNote:
      'High mechanical fatigue and maintenance overhead compared to solid-state rooftop solar PV.'
  },
  tail_vane: {
    id: 'tail_vane',
    tag: '04 // AERO-STRUTS & STARTER',
    title: 'Radial Strut Arms & Helical Starter Scoop',
    formula: 'Centrifugal Stress σ ∝ m · ω² · R',
    summary:
      'Connects vertical airfoils to the central drive shaft. Inner helical scoops assist low-speed aerodynamic startup.',
    engineeringNote:
      'Urban boundary-layer turbulence induces continuous cyclic fatigue on radial strut joints.'
  },
  tower_mast: {
    id: 'tower_mast',
    tag: '05 // ELEVATION MAST',
    title: 'Boundary-Layer Wind Shear Elevation Column',
    formula: 'v(h) = v₁₀ · (h / 10)^α',
    summary:
      'Elevates the rotor cage above building parapets and rooftop recirculation dead-zones.',
    engineeringNote:
      'In high-roughness urban areas (α = 0.30), wind speed drops sharply near roof level.'
  },
  solar_array: {
    id: 'solar_array',
    tag: '06 // BENCHMARK TWIN',
    title: 'Same-Budget Rooftop Solar Array',
    formula: 'E_solar = POA_GHI · kW_eq · PR',
    summary:
      'Purchasable with the exact same capital budget (₹60,000/kW benchmark in India) with zero moving parts or wind shear dependency.',
    engineeringNote:
      'Harvests solar photons 365 days a year even under diffuse monsoon cloud cover.'
  }
};

// Pre-allocated reusable module-scope scratch objects (Zero GC in animation loop)
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _kfPosA = new THREE.Vector3();
const _kfPosB = new THREE.Vector3();
const _kfTargetA = new THREE.Vector3();
const _kfTargetB = new THREE.Vector3();
const _dummyMat = new THREE.Matrix4();
const _dummyPos = new THREE.Vector3();
const _dummyQuat = new THREE.Quaternion();
const _dummyScale = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointerNdc = new THREE.Vector2(-99, -99);
const _projVec = new THREE.Vector3();
const _yAxis = new THREE.Vector3(0, 1, 0);

// Igloo.inc 4-Chapter Spatial Scroll Narrative Metadata
const IGLOO_CHAPTERS = [
  {
    index: '01',
    code: '01 / 04 // KINETIC CAPTURE',
    headlineTop: 'Kinetic physics.',
    headlineBottom: 'Unforgiving math.',
    formula: 'P = ½ · ρ · A · v³ · Cₚ',
    caption:
      '8,760 hours of real wind telemetry. Hover the vertical turbine to split open the generator cowling and inspect internal mechanics.'
  },
  {
    index: '02',
    code: '02 / 04 // CUBIC SCALING',
    headlineTop: 'The v³ cliff.',
    headlineBottom: 'Zero below cut-in.',
    formula: 'v < 3.0 m/s ⇒ P = 0 W',
    caption:
      'Halving wind speed reduces power by 8×. Below 3.0 m/s cut-in speed, generator cogging torque stalls the rotor completely.'
  },
  {
    index: '03',
    code: '03 / 04 // CAPITAL PARITY',
    headlineTop: 'Same budget.',
    headlineBottom: 'Stationary light.',
    formula: 'kW_solar = Budget / ₹60,000',
    caption:
      'The same investment buys 2.5 kWp of rooftop solar PV generating predictable clean energy 365 days a year with zero mechanical wear.'
  },
  {
    index: '04',
    code: '04 / 04 // VERDICT',
    headlineTop: 'Empirical proof.',
    headlineBottom: 'Audited rooftop.',
    formula: 'LCOE_wind vs LCOE_solar',
    caption:
      'Explore hourly generation profiles, wind shear roughness, and Levelized Cost of Energy in the Bento Grid below.'
  }
];

function createContactShadowTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 122);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.34)');
  grad.addColorStop(0.45, 'rgba(15, 23, 42, 0.14)');
  grad.addColorStop(0.8, 'rgba(15, 23, 42, 0.04)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Procedurally renders the 3-bladed Vertical-Axis Darrieus Rotor projected ground shadow
 * (central hub core + 3 radial aero-strut spokes at 120° + 3 curved airfoil blade shadow lobes).
 */
function createVawtRotorShadowTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const cx = 256;
  const cy = 256;

  ctx.clearRect(0, 0, 512, 512);

  // Soft central generator & mast shadow core
  const coreGrad = ctx.createRadialGradient(cx, cy, 6, cx, cy, 78);
  coreGrad.addColorStop(0, 'rgba(15, 23, 42, 0.36)');
  coreGrad.addColorStop(0.55, 'rgba(15, 23, 42, 0.15)');
  coreGrad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 78, 0, Math.PI * 2);
  ctx.fill();

  // 3 Radial Aero-Struts + 3 Vertical Airfoil Blade Shadow Lobes (120° apart)
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Radial strut spoke shadow with soft penumbra
    const strutGrad = ctx.createLinearGradient(18, 0, 178, 0);
    strutGrad.addColorStop(0, 'rgba(15, 23, 42, 0.24)');
    strutGrad.addColorStop(0.7, 'rgba(15, 23, 42, 0.18)');
    strutGrad.addColorStop(1, 'rgba(15, 23, 42, 0.05)');
    ctx.strokeStyle = strutGrad;
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(174, 0);
    ctx.stroke();

    // Curved NACA airfoil blade shadow lobe at outer radius + trailing wake penumbra
    const bladeGrad = ctx.createRadialGradient(174, 0, 4, 170, 14, 64);
    bladeGrad.addColorStop(0, 'rgba(15, 23, 42, 0.34)');
    bladeGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0.16)');
    bladeGrad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
    ctx.fillStyle = bladeGrad;
    ctx.beginPath();
    ctx.ellipse(174, 8, 28, 56, 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Procedurally renders the high-RPM swept motion-blur annulus shadow beneath the spinning VAWT cage.
 */
function createVawtMotionRingShadowTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const cx = 256;
  const cy = 256;

  const ringGrad = ctx.createRadialGradient(cx, cy, 70, cx, cy, 235);
  ringGrad.addColorStop(0, 'rgba(15, 23, 42, 0.0)');
  ringGrad.addColorStop(0.32, 'rgba(15, 23, 42, 0.06)');
  ringGrad.addColorStop(0.62, 'rgba(15, 23, 42, 0.22)');
  ringGrad.addColorStop(0.82, 'rgba(15, 23, 42, 0.09)');
  ringGrad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');

  ctx.fillStyle = ringGrad;
  ctx.fillRect(0, 0, 512, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSolarCellTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0F2942';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2;
  const cols = 6;
  const rows = 10;
  for (let c = 0; c <= cols; c++) {
    const x = (c / cols) * 512;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    const y = (r / rows) * 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Computes the exact helical centerline position and azimuth angle for a 3-blade
 * helical Darrieus VAWT blade at normalized height t in [-1, 1].
 */
function getHelicalBladePose(
  t: number,
  height: number,
  baseRadius: number,
  totalTwistRad: number
): { y: number; r: number; theta: number } {
  const y = t * (height / 2);
  // Subtle Darrieus barrel bow (wider in middle, gently tapered toward tips)
  const r = baseRadius * (1.0 - 0.14 * t * t);
  const theta = t * (totalTwistRad / 2);
  return { y, r, theta };
}

/**
 * Builds a smooth, watertight 3-blade helical Darrieus airfoil blade geometry
 * matching the wide white composite helical blades with tapered cambered profile.
 */
function createHelicalDarrieusBladeGeometry(
  height = 2.24,
  baseRadius = 1.12,
  totalTwistRad = Math.PI * 0.68,
  chordWidth = 0.44,
  thickness = 0.056,
  heightSegments = 48,
  profileSegments = 28
): THREE.BufferGeometry {
  // Build closed 2D cambered airfoil cross-section in local (radialOffset, chordOffset)
  const profile: Array<[number, number]> = [];
  for (let i = 0; i < profileSegments; i++) {
    const u = (i / profileSegments) * Math.PI * 2;
    // Chord parameter s in [-1, 1] along blade width, thickness along radial direction
    const s = Math.cos(u);
    const sinU = Math.sin(u);
    // Taper thickness smoothly toward leading & trailing edges
    const edgeFactor = Math.sqrt(Math.max(0, 1 - s * s * 0.92));
    // Gentle outward aerodynamic camber (+0.022 in center)
    const camber = 0.022 * (1 - s * s);
    const radialLocal = camber + sinU * (thickness * 0.5) * edgeFactor;
    const chordLocal = s * (chordWidth * 0.5);
    profile.push([radialLocal, chordLocal]);
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iy = 0; iy <= heightSegments; iy++) {
    const v = iy / heightSegments;
    const t = v * 2 - 1; // [-1, 1]
    const { y, r, theta } = getHelicalBladePose(t, height, baseRadius, totalTwistRad);

    // Subtle chord taper near the very top/bottom tips
    const chordScale = 1.0 - 0.12 * t * t;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    // Outward radial unit vector: (cosT, 0, sinT)
    // Circumferential tangent unit vector: (-sinT, 0, cosT)
    // Slight pitch toe-in for realistic Darrieus angle of attack
    const pitchRad = 0.06;
    const cosP = Math.cos(pitchRad);
    const sinP = Math.sin(pitchRad);

    for (let ip = 0; ip <= profileSegments; ip++) {
      const [radRaw, chordRaw] = profile[ip % profileSegments];
      const chordVal = chordRaw * chordScale;
      const radLocal = radRaw * cosP - chordVal * sinP;
      const tanLocal = radRaw * sinP + chordVal * cosP;

      const rWorld = r + radLocal;
      const px = rWorld * cosT + tanLocal * -sinT;
      const pz = rWorld * sinT + tanLocal * cosT;

      positions.push(px, y, pz);
      uvs.push(ip / profileSegments, v);
    }
  }

  const ringStride = profileSegments + 1;
  for (let iy = 0; iy < heightSegments; iy++) {
    for (let ip = 0; ip < profileSegments; ip++) {
      const a = iy * ringStride + ip;
      const b = a + 1;
      const c = (iy + 1) * ringStride + ip;
      const d = c + 1;

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Cap bottom (iy = 0) and top (iy = heightSegments) cleanly
  const bottomCenterIdx = positions.length / 3;
  const botPose = getHelicalBladePose(-1, height, baseRadius, totalTwistRad);
  positions.push(botPose.r * Math.cos(botPose.theta), botPose.y, botPose.r * Math.sin(botPose.theta));
  uvs.push(0.5, 0);
  for (let ip = 0; ip < profileSegments; ip++) {
    indices.push(bottomCenterIdx, ip, ip + 1);
  }

  const topCenterIdx = positions.length / 3;
  const topPose = getHelicalBladePose(1, height, baseRadius, totalTwistRad);
  positions.push(topPose.r * Math.cos(topPose.theta), topPose.y, topPose.r * Math.sin(topPose.theta));
  uvs.push(0.5, 1);
  const topRingStart = heightSegments * ringStride;
  for (let ip = 0; ip < profileSegments; ip++) {
    indices.push(topCenterIdx, topRingStart + ip + 1, topRingStart + ip);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

interface RotorKinematics {
  omegaRadS: number;
  visualOmegaRadS: number;
  rpm: number;
  tipSpeedMs: number;
  effectiveTsr: number;
  regime: 'STALLED' | 'SUB-CUT-IN DRIFT' | 'ACTIVE GENERATION' | 'RATED CAP' | 'STORM BRAKE';
}

function computeRotorKinematics(
  windSpeedMs: number,
  rotorDiameterM: number,
  cutInSpeedMs: number,
  ratedWindSpeedMs: number,
  cutOutSpeedMs: number,
  turbineType: 'vawt' | 'hawt' = 'vawt'
): RotorKinematics {
  const radiusM = Math.max(0.4, rotorDiameterM / 2);
  const optimalTsr = turbineType === 'vawt' ? 2.25 : 4.5;

  if (windSpeedMs >= cutOutSpeedMs) {
    return {
      omegaRadS: 0,
      visualOmegaRadS: 0,
      rpm: 0,
      tipSpeedMs: 0,
      effectiveTsr: 0,
      regime: 'STORM BRAKE'
    };
  }

  if (windSpeedMs <= 0.08) {
    return {
      omegaRadS: 0,
      visualOmegaRadS: 0,
      rpm: 0,
      tipSpeedMs: 0,
      effectiveTsr: 0,
      regime: 'STALLED'
    };
  }

  if (windSpeedMs < cutInSpeedMs) {
    // Sub-cut-in regime: PMG cogging torque resists rotation; unloaded blades only slowly drift with wind speed
    const ratio = Math.max(0, windSpeedMs / Math.max(0.5, cutInSpeedMs));
    const driftTsr = 0.28 * Math.pow(ratio, 1.15);
    const omegaRadS = (driftTsr * windSpeedMs) / radiusM;
    const tipSpeedMs = omegaRadS * radiusM;
    const rpm = (omegaRadS * 60) / (Math.PI * 2);
    return {
      omegaRadS,
      visualOmegaRadS: omegaRadS,
      rpm,
      tipSpeedMs,
      effectiveTsr: driftTsr,
      regime: 'SUB-CUT-IN DRIFT'
    };
  }

  // Active MPPT generation or Rated Cap regime: omega = (TSR * v_hub) / R
  const effectiveWindMs = Math.min(windSpeedMs, ratedWindSpeedMs);
  const omegaRadS = (optimalTsr * effectiveWindMs) / radiusM;
  const tipSpeedMs = omegaRadS * radiusM;
  const rpm = (omegaRadS * 60) / (Math.PI * 2);
  const effectiveTsr = tipSpeedMs / Math.max(0.1, windSpeedMs);

  // Keep 60fps visual rotation proportional to true location omega while preventing 60Hz 3-blade stroboscopic aliasing
  const visualOmegaRadS = Math.min(14.5, omegaRadS * 0.48);

  return {
    omegaRadS,
    visualOmegaRadS,
    rpm,
    tipSpeedMs,
    effectiveTsr,
    regime: windSpeedMs >= ratedWindSpeedMs ? 'RATED CAP' : 'ACTIVE GENERATION'
  };
}

export const IglooSpatialStage: React.FC<IglooSpatialStageProps> = ({
  theme = 'dark',
  config,
  audit,
  liveSurface = null,
  siteName,
  lat,
  lon,
  scrollProgress,
  activePresetKey,
  isComparing = false,
  onToggleComparison,
  onSelectPreset,
  onConfigChange,
  onResetConfig,
  onScrollToBento,
  onJumpToChapter
}) => {
  const { t } = useLanguage();
  const hudRootRef = useRef<HTMLDivElement>(null);
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const hudCardRef = useRef<HTMLDivElement>(null);
  const scrollBarFillRef = useRef<HTMLDivElement>(null);
  const cutawayPctRef = useRef<HTMLSpanElement>(null);
  const applyThreeThemeRef = useRef<((nextTheme: 'dark' | 'light') => void) | null>(null);

  // UI HUD States (Default front page: Aerial Streamlines camera with 3D controls dock collapsed until opened)
  const [dockCollapsed, setDockCollapsed] = useState(true);
  const [dockTab, setDockTab] = useState<'sliders' | 'camera' | 'presets'>('camera');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset | null>('corridor');
  const [explodedAmount, setExplodedAmount] = useState<number>(0.0);
  const [isCustomCameraView, setIsCustomCameraView] = useState<boolean>(false);

  // Hover-to-open VAWT & Solar Array Inspection State
  const [hoveredPart, setHoveredPart] = useState<HoveredPartId>(null);
  const [pinnedPart, setPinnedPart] = useState<HoveredPartId>(null);
  const [isCardHovered, setIsCardHovered] = useState<boolean>(false);

  const activeHoverId = hoveredPart ?? pinnedPart;
  const isTurbineHovered =
    activeHoverId === 'rotor_blades' ||
    activeHoverId === 'stator_generator' ||
    activeHoverId === 'nacelle_shell' ||
    activeHoverId === 'tail_vane' ||
    activeHoverId === 'tower_mast' ||
    isCardHovered;

  const activeHoverMeta = activeHoverId ? PART_METADATA[activeHoverId] : null;

  // Determine active chapter (0..3) from scrollProgress (0..1)
  const activeChapterIdx = Math.min(3, Math.max(0, Math.floor(scrollProgress * 3.99)));
  const activeChapter = IGLOO_CHAPTERS[activeChapterIdx];

  const defaultSpec =
    TURBINE_ARCHITECTURES[config.turbineType ?? 'vawt'] || TURBINE_ARCHITECTURES.vawt;

  // Mutable ref bridge for 60fps animation loop
  const liveStateRef = useRef({
    theme,
    hubHeightM: config.hubHeightM,
    rotorDiameterM: config.rotorDiameterM,
    budgetInr: config.budgetInr,
    turbineType: config.turbineType,
    avgWindSpeedMs: audit?.avgWindSpeedMs ?? 2.1,
    cutInSpeedMs: audit?.cutInSpeedMs ?? defaultSpec.cutInMs,
    ratedWindSpeedMs: audit?.ratedWindSpeedMs ?? 11.0,
    cutOutSpeedMs: audit?.cutOutSpeedMs ?? defaultSpec.cutOutMs,
    verdictStatus: audit?.verdict.status ?? 'NO-GO',
    windDirectionDeg: liveSurface?.windDirectionDeg ?? 245,
    solarTiltDeg: audit?.solarTiltDeg ?? config.solarTiltDeg ?? 25,
    solarAzimuthDeg: audit?.solarAzimuthDeg ?? config.solarAzimuthDeg ?? 180,
    cameraPreset: 'corridor' as CameraPreset | null,
    explodedAmount: 0.0,
    scrollProgress: 0,
    pointerX: 0,
    pointerY: 0,
    userControllingCamera: false,
    isOrbitDragging: false,
    isTurbineHovered: false,
    isSolarHovered: false,
    hoveredPartId: null as HoveredPartId,
    pinnedPart: null as HoveredPartId
  });

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !hudRootRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.hero-hud-stagger',
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.07,
          ease: 'power2.out',
          clearProps: 'transform,opacity'
        }
      );
    }, hudRootRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    liveStateRef.current.theme = theme;
    applyThreeThemeRef.current?.(theme);
  }, [theme]);

  useEffect(() => {
    const spec =
      TURBINE_ARCHITECTURES[config.turbineType ?? 'vawt'] || TURBINE_ARCHITECTURES.vawt;
    liveStateRef.current.hubHeightM = config.hubHeightM;
    liveStateRef.current.rotorDiameterM = config.rotorDiameterM;
    liveStateRef.current.budgetInr = config.budgetInr;
    liveStateRef.current.turbineType = config.turbineType;
    liveStateRef.current.avgWindSpeedMs = audit?.avgWindSpeedMs ?? 2.1;
    liveStateRef.current.cutInSpeedMs = audit?.cutInSpeedMs ?? spec.cutInMs;
    liveStateRef.current.ratedWindSpeedMs = audit?.ratedWindSpeedMs ?? 11.0;
    liveStateRef.current.cutOutSpeedMs = audit?.cutOutSpeedMs ?? spec.cutOutMs;
    liveStateRef.current.verdictStatus = audit?.verdict.status ?? 'NO-GO';
    liveStateRef.current.windDirectionDeg = liveSurface?.windDirectionDeg ?? 245;
    liveStateRef.current.solarTiltDeg = audit?.solarTiltDeg ?? config.solarTiltDeg ?? 25;
    liveStateRef.current.solarAzimuthDeg = audit?.solarAzimuthDeg ?? config.solarAzimuthDeg ?? 180;
    liveStateRef.current.cameraPreset = cameraPreset;
    liveStateRef.current.explodedAmount = explodedAmount;
  }, [config, audit, liveSurface, cameraPreset, explodedAmount]);

  useEffect(() => {
    liveStateRef.current.isTurbineHovered = isTurbineHovered;
    liveStateRef.current.isSolarHovered = activeHoverId === 'solar_array';
    liveStateRef.current.pinnedPart = pinnedPart;
  }, [isTurbineHovered, activeHoverId, pinnedPart]);

  const prevScrollRef = useRef(scrollProgress);
  useEffect(() => {
    liveStateRef.current.scrollProgress = scrollProgress;
    // Only reset camera if user actually scrolled the page meaningfully (> 1% delta)
    if (Math.abs(scrollProgress - prevScrollRef.current) > 0.01) {
      prevScrollRef.current = scrollProgress;
      liveStateRef.current.userControllingCamera = false;
      setIsCustomCameraView(false);
      setCameraPreset(null);
    }
  }, [scrollProgress]);

  // Keyboard shortcut 'H' to toggle bottom control drawer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key.toLowerCase() === 'h') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Initialize Three.js Matte-White Architectural Vertical-Axis Wind Turbine (VAWT) Scene
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance'
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    container.appendChild(renderer.domElement);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    // AeroCheck Dynamic Theme Background & Fog (#0A0B0D dark vs #BADFF8 deeper icy light)
    const scene = new THREE.Scene();
    const initialDark = liveStateRef.current.theme !== 'light';
    const bgHex = initialDark ? 0x0a0b0d : 0xbadff8;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.015);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.16).texture;
    pmremGenerator.dispose();

    // Camera framed on the Vertical-Axis Wind Turbine inside the central dotted circle
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 220);
    camera.position.set(0, 9.8, 15.8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(1.3, 3.05, 0.0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minPolarAngle = Math.PI * 0.16; // Prevents gimbal lock / pole singularity at zenith
    controls.maxPolarAngle = Math.PI * 0.48; // Keeps camera above floor level
    controls.minDistance = 3.2;
    controls.maxDistance = 42;
    controls.enableZoom = false;

    let isPointerDown = false;
    let pointerDownPos = { x: 0, y: 0 };
    let partHoveredAtDown: HoveredPartId = null;

    controls.addEventListener('end', () => {
      liveStateRef.current.isOrbitDragging = false;
    });

    const handlePointerDown = (e: PointerEvent) => {
      isPointerDown = true;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      partHoveredAtDown = liveStateRef.current.hoveredPartId;
    };

    const handlePointerMoveCapture = (e: PointerEvent) => {
      if (isPointerDown) {
        const dx = e.clientX - pointerDownPos.x;
        const dy = e.clientY - pointerDownPos.y;
        if (Math.hypot(dx, dy) >= 6) {
          liveStateRef.current.userControllingCamera = true;
          liveStateRef.current.isOrbitDragging = true;
          setIsCustomCameraView(true);
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isPointerDown) return;
      isPointerDown = false;
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      const moved = Math.hypot(dx, dy);

      // Only treat as a click to pin if pointer moved < 6px (not dragging/orbiting)
      if (moved < 6) {
        const targetPart = liveStateRef.current.hoveredPartId || partHoveredAtDown;
        if (targetPart) {
          setPinnedPart((prev) => {
            const next = prev === targetPart ? null : targetPart;
            liveStateRef.current.pinnedPart = next;
            return next;
          });
        } else {
          // Clicked empty canvas space: unpin
          setPinnedPart(null);
          liveStateRef.current.pinnedPart = null;
        }
      }
      liveStateRef.current.isOrbitDragging = false;
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMoveCapture, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);

    // Balanced Studio Lighting so metallic titanium blades & galvanized mast have crisp 3D contrast against #ECEFF2
    const hemiLight = new THREE.HemisphereLight('#FFFFFF', '#94A3B8', 0.95);
    hemiLight.position.set(0, 40, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#FFFFFF', 1.45);
    keyLight.position.set(12, 24, 16);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    const d = 16;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 70;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight('#CBD5E1', 0.75);
    fillLight.position.set(-14, 10, 10);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight('#E0F2FE', 0.65);
    rimLight.position.set(-10, 18, -14);
    scene.add(rimLight);

    // Materials
    const contactShadowTex = createContactShadowTexture(maxAniso);
    const vawtRotorShadowTex = createVawtRotorShadowTexture(maxAniso);
    const vawtMotionRingTex = createVawtMotionRingShadowTexture(maxAniso);
    const solarCellTex = createSolarCellTexture(maxAniso);

    const matteAlabasterFloorMat = new THREE.MeshStandardMaterial({
      color: '#E5E9EE',
      roughness: 0.9,
      metalness: 0.04
    });

    const matteWhiteShellMat = new THREE.MeshPhysicalMaterial({
      color: '#F1F5F9',
      roughness: 0.22,
      metalness: 0.08,
      clearcoat: 0.65,
      clearcoatRoughness: 0.18
    });

    // High-contrast metallic titanium-slate composite for the main vertical airfoil blades (never blends into #ECEFF2 background)
    const titaniumAirfoilMat = new THREE.MeshPhysicalMaterial({
      color: '#475569',
      roughness: 0.26,
      metalness: 0.58,
      clearcoat: 0.75,
      clearcoatRoughness: 0.16
    });

    const galvanizedSteelMastMat = new THREE.MeshStandardMaterial({
      color: '#94A3B8',
      roughness: 0.32,
      metalness: 0.68
    });

    const brushedAluminumMat = new THREE.MeshPhysicalMaterial({
      color: '#64748B',
      roughness: 0.24,
      metalness: 0.84,
      clearcoat: 0.35
    });

    const chromeShaftMat = new THREE.MeshPhysicalMaterial({
      color: '#94A3B8',
      roughness: 0.18,
      metalness: 0.92,
      clearcoat: 0.5
    });

    const gunmetalGeneratorMat = new THREE.MeshStandardMaterial({
      color: '#1E293B',
      roughness: 0.28,
      metalness: 0.82
    });

    const carbonStrutMat = new THREE.MeshPhysicalMaterial({
      color: '#0F172A',
      roughness: 0.24,
      metalness: 0.55,
      clearcoat: 0.7
    });

    const aviationRedMat = new THREE.MeshPhysicalMaterial({
      color: '#DC2626',
      roughness: 0.2,
      metalness: 0.12,
      clearcoat: 0.85
    });

    const beaconGlowMat = new THREE.MeshPhysicalMaterial({
      color: '#EF4444',
      emissive: '#DC2626',
      emissiveIntensity: 0.65,
      roughness: 0.15,
      metalness: 0.1
    });

    const copperWindingMat = new THREE.MeshPhysicalMaterial({
      color: '#D97706',
      emissive: '#B45309',
      emissiveIntensity: 0.22,
      roughness: 0.2,
      metalness: 0.92,
      clearcoat: 0.65
    });

    const cutawayGlassMat = new THREE.MeshPhysicalMaterial({
      color: '#BAE6FD',
      transparent: true,
      opacity: 0.16,
      roughness: 0.08,
      metalness: 0.1,
      transmission: 0.4,
      depthWrite: false
    });

    const hawtXrayShellMat = new THREE.MeshPhysicalMaterial({
      color: '#F1F5F9',
      roughness: 0.25,
      metalness: 0.12,
      clearcoat: 0.55,
      transparent: true,
      opacity: 1.0,
      depthWrite: true
    });

    const pvLayerGlassMat = new THREE.MeshPhysicalMaterial({
      color: '#E0F2FE',
      transparent: true,
      opacity: 0.28,
      roughness: 0.06,
      metalness: 0.15,
      clearcoat: 1.0,
      depthWrite: false
    });

    const softGrayCollarMat = new THREE.MeshStandardMaterial({
      color: '#64748B',
      roughness: 0.45,
      metalness: 0.38
    });

    const solarPanelMat = new THREE.MeshPhysicalMaterial({
      map: solarCellTex,
      emissive: new THREE.Color('#D97706'),
      emissiveIntensity: 0.0,
      roughness: 0.15,
      metalness: 0.65,
      clearcoat: 1.0
    });

    const terrainMat = new THREE.MeshStandardMaterial({
      color: initialDark ? 0x13161c : 0x9bcff2,
      roughness: 0.92,
      metalness: 0.05
    });

    const terrainWireMat = new THREE.LineBasicMaterial({
      color: initialDark ? 0x343b49 : 0x5aa9e6,
      transparent: true,
      opacity: 0.72
    });

    const accentStripeMat = new THREE.MeshPhysicalMaterial({
      color: initialDark ? '#38BDF8' : '#0284C7',
      emissive: initialDark ? '#38BDF8' : '#0F62FE',
      emissiveIntensity: initialDark ? 0.35 : 0.14,
      roughness: 0.2,
      metalness: 0.15,
      clearcoat: 0.85
    });

    // Procedural Undulating Architectural Wireframe Terrain (AeroCheck signature topography)
    const terrainGeo = new THREE.PlaneGeometry(88, 88, 40, 40);
    terrainGeo.rotateX(-Math.PI / 2);
    const tPos = terrainGeo.attributes.position;
    for (let i = 0; i < tPos.count; i++) {
      const tx = tPos.getX(i);
      const tz = tPos.getZ(i);
      const dist = Math.hypot(tx - 1.5, tz);
      // Keep central mounting pad flat beneath turbine & solar array (r < 6.4m)
      const padBlend = THREE.MathUtils.smoothstep(dist, 6.2, 13.5);
      const hill =
        Math.sin(tx * 0.14 + 0.5) * Math.cos(tz * 0.12 - 0.3) * 1.45 +
        Math.sin(tx * 0.06 - tz * 0.08) * 1.85 +
        Math.cos(dist * 0.11) * 0.55;
      tPos.setY(i, (hill * padBlend) - 0.03);
    }
    terrainGeo.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    const terrainWireMesh = new THREE.LineSegments(
      new THREE.WireframeGeometry(terrainGeo),
      terrainWireMat
    );
    terrainWireMesh.position.y = 0.008;
    scene.add(terrainWireMesh);

    const groundMesh = new THREE.Mesh(
      new THREE.CircleGeometry(7.2, 48),
      terrainMat
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(1.5, -0.015, 0);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // HERO SUBJECT 1: REALISTIC INDUSTRIAL VERTICAL-AXIS WIND TURBINE (VAWT) (x = 0, z = 0)
    const turbineRootGroup = new THREE.Group();
    turbineRootGroup.position.set(0, 0, 0);
    scene.add(turbineRootGroup);

    const pickableMeshes: THREE.Object3D[] = [];
    const registerPickable = (mesh: THREE.Object3D, partId: Exclude<HoveredPartId, null>) => {
      mesh.userData.partId = partId;
      pickableMeshes.push(mesh);
    };

    // Multi-Layer Dynamic Ground Shadow System beneath the Vertical-Axis Wind Turbine
    // 1. Base Plinth & Ambient Occlusion Contact Shadow
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.62
    });
    const turbineShadow = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 4.8), shadowMat);
    turbineShadow.rotation.x = -Math.PI / 2;
    turbineShadow.position.y = 0.015;
    turbineShadow.renderOrder = 1;
    turbineRootGroup.add(turbineShadow);

    // 2. Projected 3-Blade Rotating VAWT Cage Shadow (syncs with rotor angle, wind speed & diameter)
    const rotorBladeShadowMat = new THREE.MeshBasicMaterial({
      map: vawtRotorShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.52
    });
    const rotorBladeShadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 4.6),
      rotorBladeShadowMat
    );
    rotorBladeShadowMesh.rotation.x = -Math.PI / 2;
    // Offset down-sun opposite keyLight (12, 24, 16) for realistic elevated canopy projection
    rotorBladeShadowMesh.position.set(-0.42, 0.02, -0.52);
    rotorBladeShadowMesh.renderOrder = 2;
    turbineRootGroup.add(rotorBladeShadowMesh);

    // 3. Dynamic High-RPM Rotational Motion-Blur Swept Annulus Shadow
    const rotorMotionRingMat = new THREE.MeshBasicMaterial({
      map: vawtMotionRingTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.24
    });
    const rotorMotionRingMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(4.75, 4.75),
      rotorMotionRingMat
    );
    rotorMotionRingMesh.rotation.x = -Math.PI / 2;
    rotorMotionRingMesh.position.set(-0.42, 0.018, -0.52);
    rotorMotionRingMesh.renderOrder = 3;
    turbineRootGroup.add(rotorMotionRingMesh);

    // 1. Proportionate Tapered White Powder-Coated Support Mast + Bolted Base Pedestal
    const mastBaseHeight = 3.0;
    const mastGeo = new THREE.CylinderGeometry(0.24, 0.34, mastBaseHeight, 36);
    mastGeo.translate(0, mastBaseHeight / 2, 0);
    const mastMesh = new THREE.Mesh(mastGeo, matteWhiteShellMat);
    mastMesh.position.y = 0.35;
    mastMesh.castShadow = !isSoftwareGl;
    mastMesh.receiveShadow = true;
    turbineRootGroup.add(mastMesh);
    registerPickable(mastMesh, 'tower_mast');

    // Structural Concrete Plinth & Dark Steel Bolted Base Flange
    const baseFlangeMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.64, 0.80, 0.24, 32).translate(0, 0.12, 0),
      softGrayCollarMat
    );
    turbineRootGroup.add(baseFlangeMesh);
    registerPickable(baseFlangeMesh, 'tower_mast');

    const steelBasePlateMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.50, 0.54, 0.13, 32).translate(0, 0.30, 0),
      gunmetalGeneratorMat
    );
    turbineRootGroup.add(steelBasePlateMesh);
    registerPickable(steelBasePlateMesh, 'tower_mast');

    // 12 Base Anchor Bolts around the Steel Base Flange
    const anchorBoltGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.05, 8);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const bolt = new THREE.Mesh(anchorBoltGeo, chromeShaftMat);
      bolt.position.set(Math.cos(a) * 0.45, 0.37, Math.sin(a) * 0.45);
      turbineRootGroup.add(bolt);
    }

    // 2. Main Vertical-Axis Generator & Rotor Assembly mounted at the top of the Tower Mast
    const vawtAssemblyGroup = new THREE.Group();
    vawtAssemblyGroup.position.y = 3.35;
    turbineRootGroup.add(vawtAssemblyGroup);

    // A. Direct-Drive PMG Generator Housing & Internal Stator Mechanics
    const lowerSkirtMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.40, 0.27, 0.18, 36),
      brushedAluminumMat
    );
    lowerSkirtMesh.position.set(0, 0.09, 0);
    lowerSkirtMesh.castShadow = !isSoftwareGl;
    lowerSkirtMesh.receiveShadow = true;
    vawtAssemblyGroup.add(lowerSkirtMesh);
    registerPickable(lowerSkirtMesh, 'stator_generator');

    // --- Direct-Drive Axial-Flux Neodymium Stator Core & Visible Copper Windings ---
    const statorCoreGroup = new THREE.Group();
    statorCoreGroup.position.set(0, 0.44, 0);
    vawtAssemblyGroup.add(statorCoreGroup);

    // Central Stator Spindle Core + Drive Shaft Extension
    const statorCoreMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.50, 32),
      gunmetalGeneratorMat
    );
    statorCoreGroup.add(statorCoreMesh);
    registerPickable(statorCoreMesh, 'stator_generator');

    const innerDriveShaftMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.095, 0.72, 24),
      chromeShaftMat
    );
    statorCoreGroup.add(innerDriveShaftMesh);
    registerPickable(innerDriveShaftMesh, 'stator_generator');

    // 12 High-Detail Laminated Stator Teeth + Multi-Turn Wound Copper Coils
    const statorToothGeo = new THREE.BoxGeometry(0.055, 0.34, 0.045);
    const coilCoreGeo = new THREE.BoxGeometry(0.078, 0.29, 0.082);
    const wireTurnGeo = new THREE.TorusGeometry(0.046, 0.0085, 8, 18);
    for (let c = 0; c < 12; c++) {
      const angle = (c / 12) * Math.PI * 2;
      const toothMesh = new THREE.Mesh(statorToothGeo, gunmetalGeneratorMat);
      toothMesh.position.set(Math.sin(angle) * 0.225, 0, Math.cos(angle) * 0.225);
      toothMesh.rotation.y = angle;
      statorCoreGroup.add(toothMesh);

      const coilGroup = new THREE.Group();
      coilGroup.position.set(Math.sin(angle) * 0.255, 0, Math.cos(angle) * 0.255);
      coilGroup.rotation.y = angle;

      const coilMesh = new THREE.Mesh(coilCoreGeo, copperWindingMat);
      coilGroup.add(coilMesh);
      registerPickable(coilMesh, 'stator_generator');

      // Stacked copper wire loops around each stator pole for visible winding detail
      for (let w = -2; w <= 2; w++) {
        const wireLoop = new THREE.Mesh(wireTurnGeo, copperWindingMat);
        wireLoop.rotation.x = Math.PI / 2;
        wireLoop.position.y = w * 0.055;
        coilGroup.add(wireLoop);
      }
      statorCoreGroup.add(coilGroup);
    }

    // 3-Phase Copper Collector Busbar Rings & Braided Power Lead Wires descending into Mast
    for (let p = 0; p < 3; p++) {
      const busbarRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.245 + p * 0.016, 0.008, 8, 36),
        copperWindingMat
      );
      busbarRing.rotation.x = Math.PI / 2;
      busbarRing.position.y = -0.19 - p * 0.018;
      statorCoreGroup.add(busbarRing);

      const leadAngle = (p * Math.PI * 2) / 3 + 0.35;
      const leadCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.sin(leadAngle) * 0.25, -0.20, Math.cos(leadAngle) * 0.25),
        new THREE.Vector3(Math.sin(leadAngle) * 0.22, -0.29, Math.cos(leadAngle) * 0.22),
        new THREE.Vector3(Math.sin(leadAngle) * 0.14, -0.37, Math.cos(leadAngle) * 0.14)
      ]);
      const leadCable = new THREE.Mesh(
        new THREE.TubeGeometry(leadCurve, 12, 0.012, 8, false),
        copperWindingMat
      );
      statorCoreGroup.add(leadCable);
      registerPickable(leadCable, 'stator_generator');
    }

    // Spinning Outer Neodymium N52 Rotor Magnet Ring (Rotates in sync with VAWT Rotor!)
    const rotorMagnetRingGroup = new THREE.Group();
    statorCoreGroup.add(rotorMagnetRingGroup);

    const upperRotorCarrier = new THREE.Mesh(
      new THREE.TorusGeometry(0.325, 0.016, 10, 36),
      brushedAluminumMat
    );
    upperRotorCarrier.rotation.x = Math.PI / 2;
    upperRotorCarrier.position.y = 0.175;
    rotorMagnetRingGroup.add(upperRotorCarrier);

    const lowerRotorCarrier = new THREE.Mesh(
      new THREE.TorusGeometry(0.325, 0.016, 10, 36),
      brushedAluminumMat
    );
    lowerRotorCarrier.rotation.x = Math.PI / 2;
    lowerRotorCarrier.position.y = -0.175;
    rotorMagnetRingGroup.add(lowerRotorCarrier);

    // 16 Discrete N52 Permanent Magnet Poles with air-gaps so copper coils remain visible inside
    const magnetPoleGeo = new THREE.BoxGeometry(0.052, 0.31, 0.024);
    for (let m = 0; m < 16; m++) {
      const ma = (m / 16) * Math.PI * 2;
      const poleMesh = new THREE.Mesh(
        magnetPoleGeo,
        m % 2 === 0 ? chromeShaftMat : gunmetalGeneratorMat
      );
      poleMesh.position.set(Math.sin(ma) * 0.33, 0, Math.cos(ma) * 0.33);
      poleMesh.rotation.y = ma;
      rotorMagnetRingGroup.add(poleMesh);
      registerPickable(poleMesh, 'stator_generator');
    }

    // Dual High-Speed Ceramic Thrust Bearings with Visible Chrome Ball Bearings
    const lowerBearingMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.20, 0.028, 12, 32),
      chromeShaftMat
    );
    lowerBearingMesh.rotation.x = Math.PI / 2;
    lowerBearingMesh.position.y = -0.23;
    statorCoreGroup.add(lowerBearingMesh);

    const upperBearingMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.20, 0.028, 12, 32),
      chromeShaftMat
    );
    upperBearingMesh.rotation.x = Math.PI / 2;
    upperBearingMesh.position.y = 0.23;
    statorCoreGroup.add(upperBearingMesh);

    const ballGeo = new THREE.SphereGeometry(0.022, 10, 10);
    for (let b = 0; b < 10; b++) {
      const ba = (b / 10) * Math.PI * 2;
      const upperBall = new THREE.Mesh(ballGeo, chromeShaftMat);
      upperBall.position.set(Math.sin(ba) * 0.20, 0.23, Math.cos(ba) * 0.20);
      statorCoreGroup.add(upperBall);

      const lowerBall = new THREE.Mesh(ballGeo, chromeShaftMat);
      lowerBall.position.set(Math.sin(ba) * 0.20, -0.23, Math.cos(ba) * 0.20);
      statorCoreGroup.add(lowerBall);
    }

    // --- Seamless 360° X-Ray Cylindrical Inspection Sleeve + Retaining Rings ---
    // Keeps stator 100% enclosed without floating detached doors or protruding sticks
    const vawtXrayHousingMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.398, 0.398, 0.49, 32, 1, true),
      cutawayGlassMat
    );
    vawtXrayHousingMesh.position.set(0, 0.44, 0);
    vawtAssemblyGroup.add(vawtXrayHousingMesh);
    registerPickable(vawtXrayHousingMesh, 'nacelle_shell');

    const vawtLowerRetainerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.398, 0.014, 10, 36),
      gunmetalGeneratorMat
    );
    vawtLowerRetainerRing.rotation.x = Math.PI / 2;
    vawtLowerRetainerRing.position.set(0, 0.195, 0);
    vawtAssemblyGroup.add(vawtLowerRetainerRing);

    const vawtUpperRetainerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.398, 0.014, 10, 36),
      gunmetalGeneratorMat
    );
    vawtUpperRetainerRing.rotation.x = Math.PI / 2;
    vawtUpperRetainerRing.position.set(0, 0.685, 0);
    vawtAssemblyGroup.add(vawtUpperRetainerRing);

    // Upper Tapered Brushed Aluminum Generator Bearing Cap
    const generatorCrownMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.40, 0.20, 36),
      brushedAluminumMat
    );
    generatorCrownMesh.position.set(0, 0.80, 0);
    generatorCrownMesh.castShadow = !isSoftwareGl;
    generatorCrownMesh.receiveShadow = true;
    vawtAssemblyGroup.add(generatorCrownMesh);
    registerPickable(generatorCrownMesh, 'nacelle_shell');

    // Dark Rotary Shaft Collar Seal at the top of the Generator Cap
    const shaftSealMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.17, 0.06, 32),
      gunmetalGeneratorMat
    );
    shaftSealMesh.position.set(0, 0.92, 0);
    vawtAssemblyGroup.add(shaftSealMesh);

    // 3. VERTICAL-AXIS ROTATING DARRIEUS ROTOR CAGE (Raised y=2.18 for full blade-to-crown clearance)
    const vawtRotorGroup = new THREE.Group();
    vawtRotorGroup.position.set(0, 2.18, 0);
    vawtAssemblyGroup.add(vawtRotorGroup);

    // Central Vertical Chrome-Steel Drive Shaft (connects cleanly down into bearing seal)
    const centralShaftMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.125, 2.48, 32).translate(0, -0.08, 0),
      chromeShaftMat
    );
    centralShaftMesh.castShadow = !isSoftwareGl;
    centralShaftMesh.receiveShadow = true;
    vawtRotorGroup.add(centralShaftMesh);
    registerPickable(centralShaftMesh, 'tail_vane');

    // Central Hub Upper & Lower Anodized Gunmetal Strut Manifold Spiders + Brushed Aluminum Locking Rings
    const lowerHubRingMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.21, 0.15, 32),
      gunmetalGeneratorMat
    );
    lowerHubRingMesh.position.y = -0.56;
    lowerHubRingMesh.castShadow = !isSoftwareGl;
    vawtRotorGroup.add(lowerHubRingMesh);
    registerPickable(lowerHubRingMesh, 'tail_vane');

    const lowerHubCollarMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.22, 32),
      brushedAluminumMat
    );
    lowerHubCollarMesh.position.y = -0.56;
    vawtRotorGroup.add(lowerHubCollarMesh);

    const upperHubRingMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.21, 0.15, 32),
      gunmetalGeneratorMat
    );
    upperHubRingMesh.position.y = 0.56;
    upperHubRingMesh.castShadow = !isSoftwareGl;
    vawtRotorGroup.add(upperHubRingMesh);
    registerPickable(upperHubRingMesh, 'tail_vane');

    const upperHubCollarMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.22, 32),
      brushedAluminumMat
    );
    upperHubCollarMesh.position.y = 0.56;
    vawtRotorGroup.add(upperHubCollarMesh);

    // Top Anodized Spinner Cap & Red Aviation Obstruction Beacon at the apex of the Vertical Rotor Column
    const topApexCapGroup = new THREE.Group();
    topApexCapGroup.position.y = 1.09;
    vawtRotorGroup.add(topApexCapGroup);

    const apexBaseCollarMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.125, 0.145, 0.08, 32),
      gunmetalGeneratorMat
    );
    topApexCapGroup.add(apexBaseCollarMesh);

    const apexCapMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      beaconGlowMat
    );
    apexCapMesh.position.y = 0.04;
    apexCapMesh.castShadow = !isSoftwareGl;
    topApexCapGroup.add(apexCapMesh);
    registerPickable(apexCapMesh, 'nacelle_shell');

    // 3 Outer White Composite Helical Darrieus Blades + Black Radial Strut Arms + Bolt Bosses
    const helicalHeight = 2.24;
    const baseRadius = 1.12;
    const helicalTwistRad = Math.PI * 0.68; // ~122 deg helical sweep from bottom to top
    const helicalBladeGeo = createHelicalDarrieusBladeGeometry(
      helicalHeight,
      baseRadius,
      helicalTwistRad,
      0.44,
      0.056
    );

    const upperStrutT = 0.56 / (helicalHeight / 2);
    const lowerStrutT = -0.56 / (helicalHeight / 2);
    const upperPose = getHelicalBladePose(upperStrutT, helicalHeight, baseRadius, helicalTwistRad);
    const lowerPose = getHelicalBladePose(lowerStrutT, helicalHeight, baseRadius, helicalTwistRad);

    const makeRadialStrutMesh = (pose: { y: number; r: number; theta: number }) => {
      const strutStart = 0.16;
      const strutEnd = pose.r - 0.015;
      const strutLen = strutEnd - strutStart;
      const geo = new THREE.CylinderGeometry(0.024, 0.028, strutLen, 16);
      geo.rotateZ(-Math.PI / 2);
      geo.scale(1, 0.62, 1.55);
      geo.translate(strutStart + strutLen / 2, 0, 0);

      const group = new THREE.Group();
      group.position.set(0, pose.y, 0);
      group.rotation.y = -pose.theta;

      const bar = new THREE.Mesh(geo, carbonStrutMat);
      bar.castShadow = !isSoftwareGl;
      bar.receiveShadow = true;
      group.add(bar);
      registerPickable(bar, 'tail_vane');

      // Black clevis mounting bracket on inner blade face
      const bracket = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.07, 0.12),
        carbonStrutMat
      );
      bracket.position.set(strutEnd - 0.015, 0, 0);
      group.add(bracket);
      registerPickable(bracket, 'tail_vane');

      // Pair of silver hex mounting bolts visible on outer blade face
      const boltGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.024, 6);
      boltGeo.rotateZ(Math.PI / 2);
      for (const zOff of [-0.042, 0.042]) {
        const bolt = new THREE.Mesh(boltGeo, chromeShaftMat);
        bolt.position.set(pose.r + 0.042, 0, zOff);
        group.add(bolt);
      }
      return group;
    };

    const bladeWingGroups: THREE.Group[] = [];

    for (let b = 0; b < 3; b++) {
      const azimuthAngle = (b * Math.PI * 2) / 3 + 0.35;
      const wingPivot = new THREE.Group();
      wingPivot.rotation.y = azimuthAngle;

      const wingExpandContainer = new THREE.Group();
      wingPivot.add(wingExpandContainer);
      bladeWingGroups.push(wingExpandContainer);

      // Upper & Lower Black Radial Support Strut Arms aligned to the helical blade azimuths
      wingExpandContainer.add(makeRadialStrutMesh(upperPose));
      wingExpandContainer.add(makeRadialStrutMesh(lowerPose));

      // Smooth White Helical Composite Blade
      const helicalBladeMesh = new THREE.Mesh(helicalBladeGeo, matteWhiteShellMat);
      helicalBladeMesh.castShadow = !isSoftwareGl;
      helicalBladeMesh.receiveShadow = true;
      wingExpandContainer.add(helicalBladeMesh);
      registerPickable(helicalBladeMesh, 'rotor_blades');

      vawtRotorGroup.add(wingPivot);
    }

    // HERO SUBJECT 1B: 3-BLADE HORIZONTAL-AXIS WIND TURBINE (HAWT) ASSEMBLY
    const hawtAssemblyGroup = new THREE.Group();
    hawtAssemblyGroup.position.set(0, 3.35, 0);
    turbineRootGroup.add(hawtAssemblyGroup);

    // Machined Yaw Slew-Bearing Turret & Tower Interface Collar
    const hawtYawCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.31, 0.24, 32),
      brushedAluminumMat
    );
    hawtYawCollar.position.y = 0.08;
    hawtAssemblyGroup.add(hawtYawCollar);
    registerPickable(hawtYawCollar, 'tower_mast');

    const hawtYawRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31, 0.31, 0.055, 32),
      gunmetalGeneratorMat
    );
    hawtYawRing.position.y = 0.19;
    hawtAssemblyGroup.add(hawtYawRing);

    // Detailed Internal HAWT Drivetrain: Main Shaft, Planetary Gearbox, Copper Stator & Spinning N52 Rotor
    const hawtMainShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 1.12, 20).rotateZ(Math.PI / 2),
      chromeShaftMat
    );
    hawtMainShaft.position.set(0.04, 0.38, 0);
    hawtAssemblyGroup.add(hawtMainShaft);

    const hawtMainBearing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.10, 24).rotateZ(Math.PI / 2),
      brushedAluminumMat
    );
    hawtMainBearing.position.set(0.40, 0.38, 0);
    hawtAssemblyGroup.add(hawtMainBearing);

    const hawtGearboxGroup = new THREE.Group();
    hawtGearboxGroup.position.set(0.18, 0.38, 0);
    hawtAssemblyGroup.add(hawtGearboxGroup);
    const hawtGearRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.175, 0.175, 0.13, 24).rotateZ(Math.PI / 2),
      brushedAluminumMat
    );
    hawtGearboxGroup.add(hawtGearRing);
    const hawtGearTeethGeo = new THREE.BoxGeometry(0.14, 0.032, 0.032);
    for (let g = 0; g < 12; g++) {
      const ga = (g / 12) * Math.PI * 2;
      const tooth = new THREE.Mesh(hawtGearTeethGeo, gunmetalGeneratorMat);
      tooth.position.set(0, Math.sin(ga) * 0.182, Math.cos(ga) * 0.182);
      tooth.rotation.x = -ga;
      hawtGearboxGroup.add(tooth);
    }

    const hawtStatorGroup = new THREE.Group();
    hawtStatorGroup.position.set(-0.22, 0.38, 0);
    hawtAssemblyGroup.add(hawtStatorGroup);

    const hawtStatorCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.48, 24).rotateZ(Math.PI / 2),
      gunmetalGeneratorMat
    );
    hawtStatorGroup.add(hawtStatorCore);
    registerPickable(hawtStatorCore, 'stator_generator');

    const hawtCoilGeo = new THREE.BoxGeometry(0.32, 0.052, 0.052);
    const hawtWireLoopGeo = new THREE.TorusGeometry(0.035, 0.007, 6, 14);
    for (let c = 0; c < 8; c++) {
      const ca = (c / 8) * Math.PI * 2;
      const cGroup = new THREE.Group();
      cGroup.position.set(0, Math.sin(ca) * 0.152, Math.cos(ca) * 0.152);
      cGroup.rotation.x = -ca;
      const cBar = new THREE.Mesh(hawtCoilGeo, copperWindingMat);
      cGroup.add(cBar);
      for (let w = -2; w <= 2; w++) {
        const wLoop = new THREE.Mesh(hawtWireLoopGeo, copperWindingMat);
        wLoop.rotation.y = Math.PI / 2;
        wLoop.position.x = w * 0.06;
        cGroup.add(wLoop);
      }
      hawtStatorGroup.add(cGroup);
      registerPickable(cBar, 'stator_generator');
    }

    const hawtMagnetRingGroup = new THREE.Group();
    hawtMagnetRingGroup.position.set(-0.22, 0.38, 0);
    hawtAssemblyGroup.add(hawtMagnetRingGroup);
    const hawtPoleGeo = new THREE.BoxGeometry(0.34, 0.032, 0.018);
    for (let m = 0; m < 12; m++) {
      const ma = (m / 12) * Math.PI * 2;
      const hPole = new THREE.Mesh(hawtPoleGeo, m % 2 === 0 ? chromeShaftMat : aviationRedMat);
      hPole.position.set(0, Math.sin(ma) * 0.21, Math.cos(ma) * 0.21);
      hPole.rotation.x = -ma;
      hawtMagnetRingGroup.add(hPole);
    }

    // Structural Mainframe Bedplate & Rear Brake Disc Housing
    const hawtBedplate = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.12, 0.40),
      gunmetalGeneratorMat
    );
    hawtBedplate.position.set(-0.12, 0.23, 0);
    hawtAssemblyGroup.add(hawtBedplate);
    registerPickable(hawtBedplate, 'stator_generator');

    // Contoured Aerodynamic HAWT Split Nacelle Shell (Lathe profile with curved rear dome at -X)
    const hawtNacelleLathePoints: THREE.Vector2[] = [
      new THREE.Vector2(0.275, -0.56),
      new THREE.Vector2(0.30, -0.48),
      new THREE.Vector2(0.315, -0.15),
      new THREE.Vector2(0.31, 0.34),
      new THREE.Vector2(0.295, 0.48),
      new THREE.Vector2(0.24, 0.57),
      new THREE.Vector2(0.13, 0.63),
      new THREE.Vector2(0.0, 0.65)
    ];
    const hawtShellLeftGeo = new THREE.LatheGeometry(hawtNacelleLathePoints, 20, 0, Math.PI);
    hawtShellLeftGeo.rotateZ(Math.PI / 2);
    const hawtShellRightGeo = new THREE.LatheGeometry(hawtNacelleLathePoints, 20, Math.PI, Math.PI);
    hawtShellRightGeo.rotateZ(Math.PI / 2);

    const hawtCowlingLeft = new THREE.Group();
    hawtCowlingLeft.position.set(-0.1, 0.38, 0);
    const hawtLeftMesh = new THREE.Mesh(hawtShellLeftGeo, hawtXrayShellMat);
    hawtLeftMesh.castShadow = !isSoftwareGl;
    hawtCowlingLeft.add(hawtLeftMesh);
    registerPickable(hawtLeftMesh, 'nacelle_shell');
    hawtAssemblyGroup.add(hawtCowlingLeft);

    const hawtCowlingRight = new THREE.Group();
    hawtCowlingRight.position.set(-0.1, 0.38, 0);
    const hawtRightMesh = new THREE.Mesh(hawtShellRightGeo, hawtXrayShellMat);
    hawtRightMesh.castShadow = !isSoftwareGl;
    hawtCowlingRight.add(hawtRightMesh);
    registerPickable(hawtRightMesh, 'nacelle_shell');
    hawtAssemblyGroup.add(hawtCowlingRight);

    // Sculpted Roof Heatsink Louver Panel + Sleek Rear Anemometer Sensor Mast & Aviation Strobe
    const hawtRoofHeatSink = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.032, 0.34),
      accentStripeMat
    );
    hawtRoofHeatSink.position.set(-0.18, 0.70, 0);
    hawtAssemblyGroup.add(hawtRoofHeatSink);
    registerPickable(hawtRoofHeatSink, 'nacelle_shell');

    const hawtMetMastStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.02, 0.24, 10),
      gunmetalGeneratorMat
    );
    hawtMetMastStem.position.set(-0.56, 0.78, 0);
    hawtAssemblyGroup.add(hawtMetMastStem);
    const hawtMetSensorHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 14, 14),
      beaconGlowMat
    );
    hawtMetSensorHead.position.set(-0.56, 0.91, 0);
    hawtAssemblyGroup.add(hawtMetSensorHead);
    registerPickable(hawtMetSensorHead, 'tail_vane');

    // Slim Swept Stabilizer Fin on Rear Cone (replaces blocky box slab)
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(-0.34, 0);
    finShape.lineTo(-0.42, 0.24);
    finShape.lineTo(-0.22, 0.24);
    finShape.closePath();
    const hawtTailFin = new THREE.Mesh(
      new THREE.ExtrudeGeometry(finShape, { depth: 0.018, bevelEnabled: false }).translate(0, 0, -0.009),
      gunmetalGeneratorMat
    );
    hawtTailFin.position.set(-0.42, 0.62, 0);
    hawtAssemblyGroup.add(hawtTailFin);
    registerPickable(hawtTailFin, 'tail_vane');

    // Rotating 3-Blade HAWT Rotor mounted forward (+X axis) -> facing dramatically toward viewer
    const hawtRotorPivot = new THREE.Group();
    hawtRotorPivot.position.set(0.56, 0.38, 0);
    hawtAssemblyGroup.rotation.y = -Math.PI * 0.42;
    hawtAssemblyGroup.add(hawtRotorPivot);

    // Realistic Parabolic Ogive Nose Spinner Cone (compact r=0.20 so blade roots stand clearly proud of hub)
    const spinnerProfile: THREE.Vector2[] = [];
    const spinnerSteps = 18;
    for (let s = 0; s <= spinnerSteps; s++) {
      const t = s / spinnerSteps; // 0 = base, 1 = smooth bullet nose tip
      const r = 0.20 * Math.pow(Math.max(0, 1 - t * t), 0.52);
      const y = t * 0.42;
      spinnerProfile.push(new THREE.Vector2(r, y));
    }
    const hawtSpinnerGeo = new THREE.LatheGeometry(spinnerProfile, 28);
    hawtSpinnerGeo.rotateZ(-Math.PI / 2);
    const hawtNoseCone = new THREE.Mesh(hawtSpinnerGeo, matteWhiteShellMat);
    hawtNoseCone.position.x = 0.10;
    hawtNoseCone.castShadow = !isSoftwareGl;
    hawtRotorPivot.add(hawtNoseCone);
    registerPickable(hawtNoseCone, 'nacelle_shell');

    // Gunmetal Pitch-Control Hub Skirt (compact r=0.195..0.205, clear below blade pitch collars)
    const hawtHubHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.195, 0.205, 0.24, 28).rotateZ(Math.PI / 2),
      gunmetalGeneratorMat
    );
    hawtHubHub.position.x = -0.02;
    hawtRotorPivot.add(hawtHubHub);

    // Parametric Lofted NACA Twisted & Tapered Fiberglass HAWT Blade Geometry (starts at r=0.35 cleanly outside hub)
    const buildHawtAirfoilBladeGeo = (spanStart: number, spanEnd: number) => {
      const stations = 18;
      const ringPts = 14;
      const pos: number[] = [];
      const idx: number[] = [];
      const uvs: number[] = [];
      const totalSpan = 2.10;

      for (let i = 0; i <= stations; i++) {
        const f = i / stations;
        const r = THREE.MathUtils.lerp(spanStart, spanEnd, f);
        const spanNorm = THREE.MathUtils.clamp((r - 0.35) / (totalSpan - 0.35), 0, 1);
        const tipCapScale = spanEnd >= 2.05 && i === stations ? 0.1 : 1.0;

        // Chord distribution: narrow cylindrical neck -> aerodynamic shoulder -> slender taper at tip
        const chord =
          (spanNorm < 0.14
            ? THREE.MathUtils.lerp(0.088, 0.225, THREE.MathUtils.smoothstep(spanNorm, 0, 0.14))
            : THREE.MathUtils.lerp(0.225, 0.052, Math.pow(spanNorm, 0.85))) * tipCapScale;

        const thickness =
          (spanNorm < 0.14
            ? THREE.MathUtils.lerp(0.088, 0.064, spanNorm / 0.14)
            : THREE.MathUtils.lerp(0.064, 0.012, Math.pow(spanNorm, 0.9))) * tipCapScale;

        const twistRad = THREE.MathUtils.lerp(0.36, 0.04, spanNorm);
        const preConeX = -0.02 + 0.04 * spanNorm;
        const trailingSweepZ = spanNorm > 0.72 ? -0.055 * Math.pow((spanNorm - 0.72) / 0.28, 2) : 0;

        for (let j = 0; j < ringPts; j++) {
          const theta = (j / ringPts) * Math.PI * 2;
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);
          const foilZ = (0.34 - cosT * 0.5) * chord;
          const taperAlongChord = Math.pow(Math.max(0.05, 0.5 + cosT * 0.5), 0.45);
          const foilX = sinT * thickness * 0.5 * (0.45 + 0.55 * taperAlongChord);

          const rotatedX = foilX * Math.cos(twistRad) - foilZ * Math.sin(twistRad) + preConeX;
          const rotatedZ = foilX * Math.sin(twistRad) + foilZ * Math.cos(twistRad) + trailingSweepZ;

          pos.push(rotatedX, r, rotatedZ);
          uvs.push(j / ringPts, f);
        }
      }

      for (let i = 0; i < stations; i++) {
        for (let j = 0; j < ringPts; j++) {
          const nextJ = (j + 1) % ringPts;
          const a = i * ringPts + j;
          const b = i * ringPts + nextJ;
          const c = (i + 1) * ringPts + nextJ;
          const d = (i + 1) * ringPts + j;
          idx.push(a, b, c, a, c, d);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return geo;
    };

    const hawtMainBladeGeo = buildHawtAirfoilBladeGeo(0.35, 1.92);
    const hawtTipBladeGeo = buildHawtAirfoilBladeGeo(1.92, 2.10);
    const hawtBladeWingGroups: THREE.Group[] = [];
    for (let b = 0; b < 3; b++) {
      const bPivot = new THREE.Group();
      bPivot.rotation.x = (b * Math.PI * 2) / 3;

      const bExpand = new THREE.Group();
      bPivot.add(bExpand);
      hawtBladeWingGroups.push(bExpand);

      // Raised Pitch-Bearing Turret Collar sitting proud on the exterior of the r=0.20 hub
      const pitchBearingCollar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.082, 0.08, 18),
        carbonStrutMat
      );
      pitchBearingCollar.position.set(-0.02, 0.23, 0);
      bExpand.add(pitchBearingCollar);
      registerPickable(pitchBearingCollar, 'tail_vane');

      // Machined Steel Blade Root Neck connecting Bearing Collar to Airfoil Shoulder
      const bladeRootNeck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.044, 0.052, 0.11, 16),
        brushedAluminumMat
      );
      bladeRootNeck.position.set(-0.02, 0.31, 0);
      bExpand.add(bladeRootNeck);
      registerPickable(bladeRootNeck, 'tail_vane');

      const bladeMain = new THREE.Mesh(hawtMainBladeGeo, matteWhiteShellMat);
      bladeMain.castShadow = !isSoftwareGl;
      bladeMain.receiveShadow = true;
      bExpand.add(bladeMain);
      registerPickable(bladeMain, 'rotor_blades');

      const bladeTip = new THREE.Mesh(hawtTipBladeGeo, accentStripeMat);
      bladeTip.castShadow = !isSoftwareGl;
      bExpand.add(bladeTip);
      registerPickable(bladeTip, 'rotor_blades');

      hawtRotorPivot.add(bPivot);
    }

    // HERO SUBJECT 2: SAME-BUDGET ROOFTOP SOLAR ARRAY (Positioned closer at x = 4.5, z = -1.0 so both fit cleanly on screen)
    const solarRootGroup = new THREE.Group();
    solarRootGroup.position.set(4.5, 0, -1.0);
    scene.add(solarRootGroup);

    const solarShadow = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 4.8), shadowMat);
    solarShadow.rotation.x = -Math.PI / 2;
    solarShadow.position.y = 0.02;
    solarRootGroup.add(solarShadow);

    const ballastMesh = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.26, 3.2).translate(0, 0.13, 0),
      softGrayCollarMat
    );
    ballastMesh.receiveShadow = true;
    solarRootGroup.add(ballastMesh);
    registerPickable(ballastMesh, 'solar_array');

    const solarDeckGroup = new THREE.Group();
    solarDeckGroup.position.set(0, 1.24, 0);
    solarDeckGroup.rotation.x = 0.44;
    solarRootGroup.add(solarDeckGroup);

    const frameMesh = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 0.12, 2.75),
      matteWhiteShellMat
    );
    frameMesh.castShadow = !isSoftwareGl;
    solarDeckGroup.add(frameMesh);
    registerPickable(frameMesh, 'solar_array');

    // Internal Copper Busbar Ribbons & DC Collector Rails (Revealed when PV layer lifts!)
    const busbarGeo = new THREE.BoxGeometry(4.12, 0.025, 0.065);
    for (let r = -2; r <= 2; r++) {
      const busbarMesh = new THREE.Mesh(busbarGeo, copperWindingMat);
      busbarMesh.position.set(0, 0.072, r * 0.48);
      solarDeckGroup.add(busbarMesh);
      registerPickable(busbarMesh, 'solar_array');
    }
    const dcCollectorRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.032, 2.42),
      copperWindingMat
    );
    dcCollectorRail.position.set(-1.95, 0.075, 0);
    solarDeckGroup.add(dcCollectorRail);

    // Layer 2: Floating Monocrystalline PV Silicon Wafer Layer
    const pvSurfaceMesh = new THREE.Mesh(
      new THREE.BoxGeometry(4.34, 0.05, 2.60).translate(0, 0.09, 0),
      solarPanelMat
    );
    pvSurfaceMesh.castShadow = !isSoftwareGl;
    solarDeckGroup.add(pvSurfaceMesh);
    registerPickable(pvSurfaceMesh, 'solar_array');

    // Layer 3: Floating Tempered Anti-Reflective Glass Top Layer
    const pvGlassLayerGroup = new THREE.Group();
    pvGlassLayerGroup.position.set(0, 0.13, 0);
    solarDeckGroup.add(pvGlassLayerGroup);
    const pvGlassPane = new THREE.Mesh(
      new THREE.BoxGeometry(4.36, 0.024, 2.62),
      pvLayerGlassMat
    );
    pvGlassLayerGroup.add(pvGlassPane);
    const pvGlassTrim = new THREE.Mesh(
      new THREE.BoxGeometry(4.44, 0.032, 0.05),
      matteWhiteShellMat
    );
    pvGlassTrim.position.set(0, 0, -1.31);
    pvGlassLayerGroup.add(pvGlassTrim);

    // 4 Corner Alignment Guide Pillars for Exploded Solar Stack
    const solarGuidePillars: THREE.Mesh[] = [];
    const guideGeo = new THREE.CylinderGeometry(0.014, 0.014, 1.0, 8).translate(0, 0.5, 0);
    for (const [gx, gz] of [[-2.14, -1.26], [2.14, -1.26], [-2.14, 1.26], [2.14, 1.26]]) {
      const guide = new THREE.Mesh(guideGeo, accentStripeMat);
      guide.position.set(gx, 0.06, gz);
      guide.scale.y = 0.001;
      guide.visible = false;
      solarDeckGroup.add(guide);
      solarGuidePillars.push(guide);
    }

    // Grounded Matte Aluminum Solar Mounting Struts + Side Micro-Inverter Enclosure
    const solarStrutsGroup = new THREE.Group();
    solarRootGroup.add(solarStrutsGroup);
    for (const sx of [-1.7, 0, 1.7]) {
      const rearLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 1.26, 0.11),
        brushedAluminumMat
      );
      rearLeg.position.set(sx, 0.78, -0.78);
      rearLeg.castShadow = !isSoftwareGl;
      solarStrutsGroup.add(rearLeg);

      const frontLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.56, 0.11),
        brushedAluminumMat
      );
      frontLeg.position.set(sx, 0.46, 0.78);
      frontLeg.castShadow = !isSoftwareGl;
      solarStrutsGroup.add(frontLeg);
    }
    const microInverterMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.24, 0.34),
      gunmetalGeneratorMat
    );
    microInverterMesh.position.set(-2.05, 0.38, 1.22);
    microInverterMesh.castShadow = !isSoftwareGl;
    solarStrutsGroup.add(microInverterMesh);
    registerPickable(microInverterMesh, 'solar_array');

    const inverterLedMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.03, 0.02),
      accentStripeMat
    );
    inverterLedMesh.position.set(-2.05, 0.42, 1.40);
    solarStrutsGroup.add(inverterLedMesh);

    // Architectural Swept-Diameter CAD Datum Ring & Cardinal Crosshairs at Ground Plane
    const datumRingMat = new THREE.MeshBasicMaterial({
      color: initialDark ? '#38BDF8' : '#0F62FE',
      transparent: true,
      opacity: initialDark ? 0.34 : 0.28,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const rotorDatumGroup = new THREE.Group();
    rotorDatumGroup.position.set(0, 0.024, 0);
    turbineRootGroup.add(rotorDatumGroup);

    const datumOuterRing = new THREE.Mesh(
      new THREE.RingGeometry(1.24, 1.28, 72).rotateX(-Math.PI / 2),
      datumRingMat
    );
    rotorDatumGroup.add(datumOuterRing);

    const datumInnerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.84, 0.855, 48).rotateX(-Math.PI / 2),
      datumRingMat
    );
    rotorDatumGroup.add(datumInnerRing);

    const tickGeo = new THREE.BoxGeometry(0.22, 0.008, 0.024);
    for (let t = 0; t < 4; t++) {
      const a = (t * Math.PI) / 2;
      const tick = new THREE.Mesh(tickGeo, datumRingMat);
      tick.position.set(Math.cos(a) * 1.38, 0, Math.sin(a) * 1.38);
      tick.rotation.y = -a;
      rotorDatumGroup.add(tick);
    }

    // High-Fidelity Aerodynamic Wind Streamlines (AeroCheck sky / cobalt streamlines)
    const particleCount = 52;
    const streamGeo = new THREE.CapsuleGeometry(0.02, 0.85, 4, 8);
    streamGeo.rotateZ(Math.PI / 2);
    const streamMat = new THREE.MeshPhysicalMaterial({
      color: initialDark ? '#38BDF8' : '#0F62FE',
      emissive: initialDark ? '#38BDF8' : '#0F62FE',
      emissiveIntensity: initialDark ? 0.48 : 0.25,
      transparent: true,
      opacity: 0.42,
      roughness: 0.2,
      metalness: 0.1
    });
    const streamInstanced = new THREE.InstancedMesh(streamGeo, streamMat, particleCount);
    streamInstanced.frustumCulled = false;

    applyThreeThemeRef.current = (nextTheme) => {
      const dark = nextTheme !== 'light';
      const nextHex = dark ? 0x0a0b0d : 0xbadff8;
      scene.background = new THREE.Color(nextHex);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.setHex(nextHex);
      }
      terrainMat.color.setHex(dark ? 0x13161c : 0x9bcff2);
      terrainWireMat.color.setHex(dark ? 0x343b49 : 0x5aa9e6);
      accentStripeMat.color.set(dark ? '#38BDF8' : '#0369A1');
      accentStripeMat.emissive.set(dark ? '#38BDF8' : '#0284C7');
      accentStripeMat.emissiveIntensity = dark ? 0.35 : 0.28;
      datumRingMat.color.set(dark ? '#38BDF8' : '#0369A1');
      datumRingMat.opacity = dark ? 0.34 : 0.38;
      streamMat.color.set(dark ? '#38BDF8' : '#0284C7');
      streamMat.emissive.set(dark ? '#38BDF8' : '#0284C7');
      streamMat.emissiveIntensity = dark ? 0.48 : 0.36;
      hemiLight.color.set(dark ? '#B8D0EE' : '#E0F2FE');
      hemiLight.groundColor.set(dark ? '#232833' : '#7DD3FC');
      keyLight.intensity = dark ? 2.1 : 1.65;
    };

    const particleOffsets = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particleOffsets[i * 3 + 0] = (Math.random() - 0.5) * 24;
      particleOffsets[i * 3 + 1] = 1.0 + Math.random() * 7.5;
      particleOffsets[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    scene.add(streamInstanced);

    // Pointer Move & Raycast Hover Detection on Canvas
    const handlePointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      liveStateRef.current.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      liveStateRef.current.pointerY = (e.clientY / window.innerHeight) * 2 - 1;

      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        _pointerNdc.set(nx, ny);
      } else {
        _pointerNdc.set(-99, -99);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 60fps Animation Loop with Exponential Damping & Direct Scroll Tracking
    const clock = new THREE.Clock();
    let frameId = 0;
    let isDisposed = false;

    let currentTowerScaleY = 0.905;
    let currentRotorScale = 0.93;
    let currentSolarScale = 1.0;
    let currentExplode = 0.0;
    let currentHoverOpen = 0.0;
    let currentSolarHoverOpen = 0.0;
    let currentAngularVel = computeRotorKinematics(
      liveStateRef.current.avgWindSpeedMs,
      liveStateRef.current.rotorDiameterM,
      liveStateRef.current.cutInSpeedMs,
      liveStateRef.current.ratedWindSpeedMs,
      liveStateRef.current.cutOutSpeedMs,
      liveStateRef.current.turbineType
    ).visualOmegaRadS;
    let smoothedScrollProgress = liveStateRef.current.scrollProgress;
    let smoothedPointerX = 0;
    let smoothedPointerY = 0;
    let frameCounter = 0;

    // Reusable spline control points for buttery-smooth C2 camera motion
    const camSplinePoints = [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3()
    ];
    const lookSplinePoints = [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3()
    ];
    const camPosCurve = new THREE.CatmullRomCurve3(camSplinePoints, false, 'centripetal', 0.5);
    const camLookCurve = new THREE.CatmullRomCurve3(lookSplinePoints, false, 'centripetal', 0.5);

    // Locate the 235vh outer sticky scroll track element once and cache its geometry for zero-reflow 60fps scroll reading
    const stickyTrackEl =
      (container.closest('[data-spatial-track]') as HTMLElement | null) ||
      (container.closest('section') as HTMLElement | null) ||
      container.parentElement?.parentElement?.parentElement ||
      null;

    let cachedTrackTop = 0;
    let cachedScrollableDist = 1;
    let isTrackHidden = false;
    const updateTrackMetrics = () => {
      if (!stickyTrackEl) return;
      isTrackHidden = stickyTrackEl.getAttribute('aria-hidden') === 'true';
      if (isTrackHidden) return;
      const rect = stickyTrackEl.getBoundingClientRect();
      cachedTrackTop = rect.top + window.scrollY;
      cachedScrollableDist = Math.max(1, rect.height - window.innerHeight);
    };
    updateTrackMetrics();

    const trackResizeObserver =
      typeof ResizeObserver !== 'undefined' && stickyTrackEl
        ? new ResizeObserver(() => updateTrackMetrics())
        : null;
    if (trackResizeObserver && stickyTrackEl) {
      trackResizeObserver.observe(stickyTrackEl);
    }

    let hudScreenX = width * 0.5;
    let hudScreenY = height * 0.4;

    const TARGET_FRAME_MS = 1000 / 60;
    let lastFrameTime = performance.now();
    let lastRayPointerX = -999;
    let lastRayPointerY = -999;

    function tick(now: number = performance.now()) {
      if (isDisposed) return;
      frameId = requestAnimationFrame(tick);

      if (document.hidden || stickyTrackEl?.getAttribute('aria-hidden') === 'true') {
        lastFrameTime = now;
        clock.getDelta();
        return;
      }

      const elapsed = now - lastFrameTime;
      if (elapsed < TARGET_FRAME_MS - 2.5) {
        return;
      }
      lastFrameTime = now;

      const dt = Math.min(clock.getDelta(), 0.05);
      const state = liveStateRef.current;
      frameCounter++;

      // Read live scroll progress from cached metrics + window.scrollY (zero DOM layout reflow)
      let liveScroll = state.scrollProgress;
      if (stickyTrackEl) {
        liveScroll = THREE.MathUtils.clamp((window.scrollY - cachedTrackTop) / cachedScrollableDist, 0, 1);
      }

      // Raycast against VAWT & Solar Array sub-components only when pointer moved (zero idle CPU cost)
      if (
        !state.isOrbitDragging &&
        _pointerNdc.x > -10 &&
        frameCounter % 2 === 0 &&
        (Math.abs(_pointerNdc.x - lastRayPointerX) > 0.002 || Math.abs(_pointerNdc.y - lastRayPointerY) > 0.002)
      ) {
        lastRayPointerX = _pointerNdc.x;
        lastRayPointerY = _pointerNdc.y;
        _raycaster.setFromCamera(_pointerNdc, camera);
        const hits = _raycaster.intersectObjects(pickableMeshes, false);
        const hitPart = (hits[0]?.object?.userData?.partId as HoveredPartId) ?? null;

        if (hitPart !== state.hoveredPartId) {
          state.hoveredPartId = hitPart;
          setHoveredPart(hitPart);
          renderer.domElement.style.cursor = hitPart ? 'pointer' : 'grab';
        }
      }

      // Responsive smooth damping with fast completion cap (1.25 progress/sec) for short scroll tour
      const dampedScroll = THREE.MathUtils.damp(
        smoothedScrollProgress,
        liveScroll,
        8.5,
        dt
      );
      const maxScrollDelta = 1.25 * dt;
      const scrollDiff = dampedScroll - smoothedScrollProgress;
      smoothedScrollProgress += Math.max(-maxScrollDelta, Math.min(maxScrollDelta, scrollDiff));

      smoothedPointerX = THREE.MathUtils.damp(smoothedPointerX, state.pointerX, 6.0, dt);
      smoothedPointerY = THREE.MathUtils.damp(smoothedPointerY, state.pointerY, 6.0, dt);

      // A. Smoothly damp turbine tower height within viewport-safe bounds so the turbine never goes off-screen
      const targetTowerScaleY = THREE.MathUtils.mapLinear(
        THREE.MathUtils.clamp(state.hubHeightM, 6, 40),
        6,
        40,
        0.82,
        1.14
      );
      currentTowerScaleY = THREE.MathUtils.damp(currentTowerScaleY, targetTowerScaleY, 8.0, dt);
      mastMesh.scale.y = currentTowerScaleY;

      const topY = 0.35 + mastBaseHeight * currentTowerScaleY;
      const isHawt = state.turbineType === 'hawt';
      vawtAssemblyGroup.position.y = topY;
      vawtAssemblyGroup.visible = !isHawt;
      hawtAssemblyGroup.position.y = topY;
      hawtAssemblyGroup.visible = isHawt;

      // B. Smoothly damp rotor diameter within viewport-safe bounds
      const targetRotorScale = THREE.MathUtils.mapLinear(
        THREE.MathUtils.clamp(state.rotorDiameterM, 1.0, 6.0),
        1.0,
        6.0,
        0.84,
        1.14
      );
      currentRotorScale = THREE.MathUtils.damp(currentRotorScale, targetRotorScale, 8.0, dt);
      vawtRotorGroup.scale.set(
        currentRotorScale,
        1.0 + (currentRotorScale - 1.0) * 0.25,
        currentRotorScale
      );
      hawtRotorPivot.scale.setScalar(currentRotorScale);
      rotorDatumGroup.scale.setScalar(currentRotorScale);

      // C. Smoothly damp Same-Budget Solar Array width, tilt & azimuth orientation
      const targetSolarScale = THREE.MathUtils.mapLinear(
        THREE.MathUtils.clamp(state.budgetInr, 50000, 500000),
        50000,
        500000,
        0.74,
        1.32
      );
      currentSolarScale = THREE.MathUtils.damp(currentSolarScale, targetSolarScale, 8.0, dt);
      solarDeckGroup.scale.set(currentSolarScale, 1, currentSolarScale);
      ballastMesh.scale.set(currentSolarScale, 1, currentSolarScale);
      solarStrutsGroup.scale.set(currentSolarScale, 1, currentSolarScale);

      const targetTiltRad = (THREE.MathUtils.clamp(state.solarTiltDeg, 6, 52) * Math.PI) / 180;
      solarDeckGroup.rotation.x = THREE.MathUtils.damp(solarDeckGroup.rotation.x, targetTiltRad, 6.0, dt);
      const targetAzimuthYaw = (((180 - state.solarAzimuthDeg) * Math.PI) / 180) * 0.45;
      solarRootGroup.rotation.y = THREE.MathUtils.damp(solarRootGroup.rotation.y, targetAzimuthYaw, 5.0, dt);

      // D. Smooth Hover & Explode Response
      const hoverTarget = state.isTurbineHovered ? 1.0 : 0.0;
      currentHoverOpen = THREE.MathUtils.damp(currentHoverOpen, hoverTarget, 9.0, dt);

      const solarHoverTarget = state.isSolarHovered ? 1.0 : 0.0;
      currentSolarHoverOpen = THREE.MathUtils.damp(
        currentSolarHoverOpen,
        solarHoverTarget,
        8.5,
        dt
      );

      // Progressive 2-Phase Scroll Choreography matching reference video:
      // Phase A (0.08 -> 0.52): TURBINE X-RAY CUTAWAY (Blades -> Gearbox/Rotor -> Copper Generator)
      // Phase B (0.52 -> 0.94): SOLAR LAYER CUTAWAY (Anti-Reflective Glass -> Silicon PV Wafers -> Busbars)
      const turbineScrollExplode =
        THREE.MathUtils.smoothstep(smoothedScrollProgress, 0.08, 0.22) *
        (1.0 - THREE.MathUtils.smoothstep(smoothedScrollProgress, 0.48, 0.58));

      const desiredExplode = Math.min(
        1.0,
        Math.max(state.explodedAmount, currentHoverOpen, turbineScrollExplode)
      );
      currentExplode = THREE.MathUtils.damp(currentExplode, desiredExplode, 9.0, dt);

      // Symmetrical radial expansion of the 3 VAWT & 3 HAWT wing assemblies on hover/explode
      const bladeRadialOffset = currentExplode * 0.14;
      for (let b = 0; b < bladeWingGroups.length; b++) {
        bladeWingGroups[b].position.x = bladeRadialOffset;
      }
      for (let b = 0; b < hawtBladeWingGroups.length; b++) {
        hawtBladeWingGroups[b].position.y = currentExplode * 0.14;
      }
      hawtNoseCone.position.x = 0.10 + currentExplode * 0.28;
      lowerHubRingMesh.position.y = -0.56 - currentExplode * 0.10;
      upperHubRingMesh.position.y = 0.56 + currentExplode * 0.10;

      // Progressive 3-Layer Solar Exploded Cutaway Stack driven smoothly by Phase B scroll + hover/slider
      const scrollSolarPhase =
        THREE.MathUtils.smoothstep(smoothedScrollProgress, 0.52, 0.66) *
        (1.0 - THREE.MathUtils.smoothstep(smoothedScrollProgress, 0.94, 1.0));
      const solarGlassTarget = Math.min(1.0, Math.max(state.explodedAmount, currentSolarHoverOpen, scrollSolarPhase));
      const scrollWaferPhase =
        THREE.MathUtils.smoothstep(smoothedScrollProgress, 0.64, 0.78) *
        (1.0 - THREE.MathUtils.smoothstep(smoothedScrollProgress, 0.94, 1.0));
      const solarWaferTarget = Math.min(1.0, Math.max(state.explodedAmount, currentSolarHoverOpen, scrollWaferPhase));

      const pvGlassLift = THREE.MathUtils.damp(pvGlassLayerGroup.userData.lift ?? 0, solarGlassTarget, 8.5, dt);
      pvGlassLayerGroup.userData.lift = pvGlassLift;
      const pvWaferLift = THREE.MathUtils.damp(pvSurfaceMesh.userData.lift ?? 0, solarWaferTarget, 8.5, dt);
      pvSurfaceMesh.userData.lift = pvWaferLift;

      pvSurfaceMesh.position.y = pvWaferLift * 0.52;
      pvGlassLayerGroup.position.y = 0.06 + pvGlassLift * 1.02;
      solarPanelMat.emissiveIntensity = THREE.MathUtils.damp(
        solarPanelMat.emissiveIntensity,
        0.04 + pvWaferLift * 0.52,
        6.0,
        dt
      );
      const showGuides = pvGlassLift > 0.02;
      for (let g = 0; g < solarGuidePillars.length; g++) {
        solarGuidePillars[g].visible = showGuides;
        solarGuidePillars[g].scale.y = Math.max(0.01, pvGlassLift * 1.02);
      }

      // Smooth X-Ray Cutaway Transparency on VAWT Inspection Sleeve & HAWT Nacelle (no detached floating curtains)
      cutawayGlassMat.opacity = THREE.MathUtils.lerp(0.24, 0.08, currentExplode);

      hawtXrayShellMat.opacity = THREE.MathUtils.lerp(1.0, 0.22, currentExplode);
      hawtXrayShellMat.depthWrite = currentExplode < 0.08;
      hawtCowlingLeft.position.set(-0.1, 0.38, currentExplode * 0.05);
      hawtCowlingRight.position.set(-0.1, 0.38, -currentExplode * 0.05);

      generatorCrownMesh.position.y = 0.80 + currentExplode * 0.10;
      shaftSealMesh.position.y = 0.92 + currentExplode * 0.11;

      // Rotate Rotor (VAWT around Y, HAWT around local X) + internal drivetrain
      const windSpeed = state.avgWindSpeedMs;
      const kinematics = computeRotorKinematics(
        windSpeed,
        state.rotorDiameterM,
        state.cutInSpeedMs,
        state.ratedWindSpeedMs,
        state.cutOutSpeedMs,
        state.turbineType
      );
      const hoverSlowdown = 1 - currentHoverOpen * 0.55;
      const targetAngularVel = kinematics.visualOmegaRadS * hoverSlowdown;
      // Smooth rotational inertia damping when switching locations or adjusting hub height / rotor diameter
      currentAngularVel = THREE.MathUtils.damp(currentAngularVel, targetAngularVel, 5.5, dt);
      vawtRotorGroup.rotation.y += currentAngularVel * dt;
      rotorMagnetRingGroup.rotation.y = vawtRotorGroup.rotation.y;
      hawtRotorPivot.rotation.x += currentAngularVel * dt;
      hawtGearboxGroup.rotation.x = hawtRotorPivot.rotation.x * 2.5;
      hawtMagnetRingGroup.rotation.x = hawtRotorPivot.rotation.x;

      rotorBladeShadowMesh.visible = !isHawt;
      rotorMotionRingMesh.visible = !isHawt;

      // Dynamic VAWT Ground Shadow Scaling, Rotation & Motion-Blur Modulation
      const rotorAngle = vawtRotorGroup.rotation.y;
      const windNorm = THREE.MathUtils.clamp(windSpeed / 10.0, 0, 1.25);
      const speedNorm = THREE.MathUtils.clamp(currentAngularVel / 8.0, 0, 1.0);
      // 3-blade harmonic pulse as each vertical airfoil sweeps past the directional light plane
      const bladePassPulse = Math.sin(rotorAngle * 3) * 0.038 * (0.35 + 0.65 * speedNorm);
      // Radial expansion from rotor diameter, clam-shell explode, and centrifugal wind load
      const radialShadowScale =
        currentRotorScale * (1.0 + currentExplode * 0.08 + windNorm * 0.14 + bladePassPulse);
      // Downwind aerodynamic wake stretch along +X as wind speed rises
      const downwindStretchX = radialShadowScale * (1.0 + windNorm * 0.16);
      // Sun projection offset shifts proportionally with tower hub height and downwind drift
      const sunOffsetX = -0.38 * currentTowerScaleY + windNorm * 0.14;
      const sunOffsetZ = -0.48 * currentTowerScaleY;

      // 1. Base ambient contact shadow scales with rotor footprint & wind speed
      const baseShadowScale =
        0.92 * currentRotorScale * (1.0 + windNorm * 0.12 + Math.abs(bladePassPulse) * 0.5);
      turbineShadow.scale.set(
        baseShadowScale * (1.0 + windNorm * 0.1),
        baseShadowScale,
        1
      );
      shadowMat.opacity = THREE.MathUtils.clamp(
        0.54 + windNorm * 0.14 - (currentTowerScaleY - 0.9) * 0.15,
        0.42,
        0.74
      );

      // 2. Rotating 3-blade projected shadow locks phase with the 3D VAWT rotor above it
      rotorBladeShadowMesh.position.set(sunOffsetX, 0.02, sunOffsetZ);
      rotorBladeShadowMesh.rotation.z = -rotorAngle;
      rotorBladeShadowMesh.scale.set(downwindStretchX, radialShadowScale, 1);
      // Crisp individual blade shadows at low RPM; smoothly blends into motion blur at high RPM
      rotorBladeShadowMat.opacity = THREE.MathUtils.clamp(
        0.58 - speedNorm * 0.22 + bladePassPulse * 0.4,
        0.28,
        0.64
      );

      // 3. Swept motion-blur annulus shadow intensifies with wind speed and angular velocity
      rotorMotionRingMesh.position.set(sunOffsetX, 0.018, sunOffsetZ);
      rotorMotionRingMesh.scale.set(
        downwindStretchX * (1.02 + speedNorm * 0.06),
        radialShadowScale * (1.02 + speedNorm * 0.06),
        1
      );
      rotorMotionRingMat.opacity = THREE.MathUtils.clamp(
        0.12 + speedNorm * 0.42 + windNorm * 0.12,
        0.12,
        0.62
      );

      // Modulate internal copper stator emissive intensity with active generation state
      const targetCoilGlow = windSpeed >= state.cutInSpeedMs ? 0.45 : 0.12;
      copperWindingMat.emissiveIntensity = THREE.MathUtils.damp(
        copperWindingMat.emissiveIntensity,
        targetCoilGlow,
        4.0,
        dt
      );

      // Advance Wind Streamlines with potential flow diversion around the rotating VAWT cage & smooth boundary envelope
      const flowSpeed = Math.max(0.4, windSpeed * 2.1);
      const streakLength = THREE.MathUtils.clamp(windSpeed * 0.32, 0.3, 1.85);
      streamMat.opacity = THREE.MathUtils.clamp(0.18 + windSpeed * 0.04, 0.2, 0.52);

      const rCylinder = 1.45;
      const simTime = clock.getElapsedTime();
      for (let i = 0; i < particleCount; i++) {
        let px = particleOffsets[i * 3 + 0] + flowSpeed * dt;
        if (px > 12) px = -12;
        particleOffsets[i * 3 + 0] = px;

        const py0 = particleOffsets[i * 3 + 1];
        const pz0 = particleOffsets[i * 3 + 2];

        // Aerodynamic potential flow divergence around cylinder
        const distSq = px * px + pz0 * pz0;
        const flowDeflect = (rCylinder * rCylinder) / (distSq + 0.45);
        const pz = pz0 * (1.0 + flowDeflect * 0.72);

        // Downwind wake oscillation
        const inWake = px > 0.5 ? Math.min(1.0, px * 0.22) : 0.0;
        const wakeWobble = inWake * Math.sin(px * 1.6 - simTime * 5.0 + i) * 0.055;

        _dummyPos.set(px, py0, pz + wakeWobble);

        // Calculate flow tangent for natural alignment along airflow curves
        const dx = 0.35;
        const nextDistSq = (px + dx) * (px + dx) + pz0 * pz0;
        const nextDeflect = (rCylinder * rCylinder) / (nextDistSq + 0.45);
        const nextPz = pz0 * (1.0 + nextDeflect * 0.72);
        const tangentZ = nextPz - pz;
        const yaw = Math.atan2(tangentZ, dx);

        _dummyQuat.setFromAxisAngle(_yAxis, -yaw);

        // Bernoulli flank acceleration + smooth boundary fade-in/out near x = ±12
        const flankBoost = 1.0 + flowDeflect * 0.4;
        const edgeEnvelope = Math.max(0.04, Math.sin(((px + 12) / 24) * Math.PI));
        _dummyScale.set(streakLength * flankBoost * edgeEnvelope, edgeEnvelope, edgeEnvelope);
        _dummyMat.compose(_dummyPos, _dummyQuat, _dummyScale);
        streamInstanced.setMatrixAt(i, _dummyMat);
      }
      streamInstanced.instanceMatrix.needsUpdate = true;

      // H. Continuous C2-Smooth 4-Chapter Camera Spline that keeps the entire VAWT inside the screen at all times
      const vawtCenterY = topY + 1.55;

      // Organic subtle breathing motion (Lusion signature)
      const breathX = Math.sin(simTime * 0.75) * 0.045;
      const breathY = Math.cos(simTime * 0.55) * 0.03;
      const breathZ = Math.sin(simTime * 0.45) * 0.02;

      if (!state.userControllingCamera) {
        const isPortrait = camera.aspect < 0.95;
        const aspectPullback =
          camera.aspect < 1.35
            ? THREE.MathUtils.lerp(1.42, 1.0, THREE.MathUtils.clamp((camera.aspect - 0.65) / 0.7, 0, 1))
            : 1.0;

        if (state.cameraPreset) {
          if (state.cameraPreset === 'overview') {
            _targetCamPos.set(
              isPortrait ? 0.9 : 2.1,
              vawtCenterY + (isPortrait ? 0.6 : 0.2),
              (isPortrait ? 19.5 : 14.0) * aspectPullback
            );
            _targetLookAt.set(isPortrait ? 0.85 : 1.5, vawtCenterY - (isPortrait ? 2.4 : 1.85), -0.4);
          } else if (state.cameraPreset === 'rotor') {
            _targetCamPos.set(-1.35, vawtCenterY + 0.1, (isPortrait ? 11.2 : 8.6) * aspectPullback);
            _targetLookAt.set(0, vawtCenterY - (isPortrait ? 1.1 : 0.75), 0.0);
          } else if (state.cameraPreset === 'solar') {
            _targetCamPos.set(3.8, vawtCenterY - 0.1, (isPortrait ? 14.8 : 11.8) * aspectPullback);
            _targetLookAt.set(2.1, vawtCenterY - (isPortrait ? 2.2 : 1.75), -0.6);
          } else {
            _targetCamPos.set(
              isPortrait ? 0.65 : 0,
              vawtCenterY + (isPortrait ? 5.6 : 4.9),
              (isPortrait ? 23.2 : 16.4) * aspectPullback
            );
            _targetLookAt.set(isPortrait ? 0.85 : 1.3, vawtCenterY - (isPortrait ? 3.5 : 2.55), 0);
          }
        } else {
          // 5-Point Scroll Camera Spline matching video:
          // [0] Full Aerial Overview -> [1] Turbine X-Ray Blades/Shaft -> [2] Turbine Generator Close-up ->
          // [3] Solar 3-Layer Exploded Cutaway -> [4] Exit pull-back into Site Auditor
          camSplinePoints[0].set(
            isPortrait ? 0.65 : 0,
            vawtCenterY + (isPortrait ? 5.6 : 4.9),
            (isPortrait ? 23.2 : 16.4) * aspectPullback
          );
          lookSplinePoints[0].set(isPortrait ? 0.85 : 1.3, vawtCenterY - (isPortrait ? 3.5 : 2.55), 0.0);

          camSplinePoints[1].set(-1.1 * aspectPullback, vawtCenterY + 0.15, 7.2 * aspectPullback);
          lookSplinePoints[1].set(0.0, vawtCenterY - 0.15, 0.0);

          camSplinePoints[2].set(2.1 * aspectPullback, vawtCenterY - 0.15, 6.2 * aspectPullback);
          lookSplinePoints[2].set(0.0, topY + 0.55, 0.0);

          camSplinePoints[3].set(4.3 + 1.9 * aspectPullback, 1.45 + 1.65 * aspectPullback, -1.0 + 5.4 * aspectPullback);
          lookSplinePoints[3].set(4.3, 1.45, -1.0);

          camSplinePoints[4].set(2.2, vawtCenterY + 0.35, 14.4 * aspectPullback);
          lookSplinePoints[4].set(1.6, vawtCenterY - 1.55, -0.4);

          const smoothU = THREE.MathUtils.smoothstep(smoothedScrollProgress, 0, 1);
          camPosCurve.getPoint(smoothU, _targetCamPos);
          camLookCurve.getPoint(smoothU, _targetLookAt);

          _targetCamPos.x += smoothedPointerX * 0.32 + breathX;
          _targetCamPos.y += -smoothedPointerY * 0.20 + breathY;
          _targetCamPos.z += breathZ;

          _targetLookAt.x += smoothedPointerX * 0.08;
          _targetLookAt.y += -smoothedPointerY * 0.05;
        }

        const dampFactor = 1 - Math.exp(-8.5 * dt);
        camera.position.lerp(_targetCamPos, dampFactor);
        controls.target.lerp(_targetLookAt, dampFactor);
      } else {
        // While user is orbiting, gently keep the target at turbine center height if turbine dimensions change
        controls.target.y = THREE.MathUtils.damp(controls.target.y, vawtCenterY, 4.0, dt);
      }
      controls.update();

      // Update Floating Glass Holographic Inspection HUD with Sub-Pixel Damping (Zero React Re-render!)
      if (hudCardRef.current) {
        const currentActiveId = !state.isOrbitDragging
          ? (state.hoveredPartId ?? state.pinnedPart)
          : null;
        if (currentActiveId) {
          if (currentActiveId === 'solar_array') {
            _projVec.set(4.5, 1.8, -1.0);
          } else if (currentActiveId === 'rotor_blades') {
            _projVec.set(0.0, vawtCenterY + 0.5, 1.25);
          } else if (currentActiveId === 'stator_generator' || currentActiveId === 'nacelle_shell') {
            _projVec.set(0.0, topY + 0.45, 0.4);
          } else if (currentActiveId === 'tail_vane') {
            _projVec.set(0.65, topY + 1.2, 0.0);
          } else if (currentActiveId === 'tower_mast') {
            _projVec.set(0.0, topY * 0.55, 0.0);
          } else {
            _projVec.set(0.0, vawtCenterY, 0.25);
          }
          _projVec.project(camera);
          const w = container?.clientWidth || window.innerWidth;
          const h = container?.clientHeight || window.innerHeight;
          const rawTargetX = (_projVec.x * 0.5 + 0.5) * w;
          const rawTargetY = (-_projVec.y * 0.5 + 0.5) * h;
          // Clamp so HUD tooltip stays inside viewport cleanly across both mobile & desktop
          const halfMarginX = Math.min(w * 0.44, 190);
          const targetX = THREE.MathUtils.clamp(rawTargetX, halfMarginX, Math.max(halfMarginX, w - halfMarginX));
          const targetY = THREE.MathUtils.clamp(rawTargetY, 170, Math.max(185, h - 145));

          hudScreenX = THREE.MathUtils.damp(hudScreenX, targetX, 12.0, dt);
          hudScreenY = THREE.MathUtils.damp(hudScreenY, targetY, 12.0, dt);

          hudCardRef.current.style.transform = `translate3d(${hudScreenX.toFixed(1)}px, ${hudScreenY.toFixed(1)}px, 0)`;
          hudCardRef.current.style.opacity = '1';
        } else {
          hudCardRef.current.style.opacity = '0';
        }
      }

      // Update right-margin scroll gauge directly at 60 FPS with zero React re-renders
      if (scrollBarFillRef.current) {
        const isSolar = liveScroll >= 0.52;
        const ratio =
          liveScroll >= 0.08 && liveScroll <= 0.96
            ? isSolar
              ? THREE.MathUtils.clamp((liveScroll - 0.52) / 0.44, 0, 1)
              : THREE.MathUtils.clamp((liveScroll - 0.08) / 0.44, 0, 1)
            : liveScroll;
        scrollBarFillRef.current.style.transform = `scaleY(${Math.max(0.05, ratio).toFixed(3)})`;
        if (cutawayPctRef.current) {
          cutawayPctRef.current.textContent = `${Math.round(ratio * 100)}%`;
        }
      }

      renderer.render(scene, camera);
    }

    frameId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      updateTrackMetrics();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMoveCapture);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
      trackResizeObserver?.disconnect();
      cancelAnimationFrame(frameId);
      controls.dispose();
      // Full GPU geometry, material & texture disposal on unmount
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry && typeof mesh.geometry.dispose === 'function') {
          mesh.geometry.dispose();
        }
        const mat = (mesh as any).material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => m?.dispose?.());
        } else if (mat && typeof mat.dispose === 'function') {
          mat.dispose();
        }
      });
      if (scene.environment) {
        scene.environment.dispose();
      }
      contactShadowTex.dispose();
      vawtRotorShadowTex.dispose();
      vawtMotionRingTex.dispose();
      solarCellTex.dispose();
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const handleSelectCameraPreset = (preset: CameraPreset) => {
    liveStateRef.current.userControllingCamera = false;
    setIsCustomCameraView(false);
    setCameraPreset(preset);
  };

  const presetList: SitePreset[] = PRESET_LIST;

  const fallbackSpec =
    TURBINE_ARCHITECTURES[config.turbineType ?? 'vawt'] || TURBINE_ARCHITECTURES.vawt;
  const sweptArea = audit?.sweptAreaM2 ?? Math.PI * Math.pow(config.rotorDiameterM / 2, 2);
  const avgHubSpeed = audit?.avgWindSpeedMs ?? 2.1;
  const siteAirDensity = audit?.avgAirDensityKgM3 ?? 1.225;
  const siteCpEta = audit?.combinedCpEta ?? fallbackSpec.combinedCpEta;
  const siteCutInMs = audit?.cutInSpeedMs ?? fallbackSpec.cutInMs;
  const siteCutOutMs = audit?.cutOutSpeedMs ?? fallbackSpec.cutOutMs;
  const instantPowerAtAvgW = computeInstantWindPowerW(
    avgHubSpeed,
    sweptArea,
    config.ratedPowerW,
    siteAirDensity,
    siteCpEta,
    siteCutInMs,
    siteCutOutMs
  );

  const siteRatedMs = audit?.ratedWindSpeedMs ?? 11.0;
  const rotorKinematics = computeRotorKinematics(
    avgHubSpeed,
    config.rotorDiameterM,
    siteCutInMs,
    siteRatedMs,
    siteCutOutMs,
    config.turbineType
  );

  const activeArchLabel = config.turbineType === 'hawt' ? '3-Blade HAWT' : 'Helical VAWT';
  const isCutawayActive =
    scrollProgress >= 0.08 || explodedAmount > 0.05 || isTurbineHovered || !dockCollapsed;

  // Video-matched Cutaway Overlay Stage Logic (0.08 -> 0.52 Turbine X-Ray, 0.52 -> 0.96 Solar Layer Cutaway)
  const inScrollCutaway = scrollProgress >= 0.08 && scrollProgress <= 0.96;
  const isSolarCutawayPhase = scrollProgress >= 0.52;
  const turbineSubStep = scrollProgress < 0.22 ? 0 : scrollProgress < 0.36 ? 1 : 2;
  const solarSubStep = scrollProgress < 0.66 ? 0 : scrollProgress < 0.80 ? 1 : 2;
  const cutawayStepIdx = isSolarCutawayPhase ? solarSubStep : turbineSubStep;
  const cutawayPhaseRatio = isSolarCutawayPhase
    ? Math.min(1, Math.max(0, (scrollProgress - 0.52) / 0.44))
    : Math.min(1, Math.max(0, (scrollProgress - 0.08) / 0.44));
  const cutawayPhasePct = Math.round(cutawayPhaseRatio * 100);

  const cutawayStory = isSolarCutawayPhase
    ? [
        {
          code: '01',
          title: 'ANTI-REFLECTIVE GLASS',
          desc: 'Traps incoming sunlight while shielding monocrystalline silicon cells from heat and weather.'
        },
        {
          code: '02',
          title: 'SILICON PV WAFERS',
          desc: 'High-efficiency PERC/TOPCon cells convert solar photons directly into steady DC electricity.'
        },
        {
          code: '03',
          title: 'BUSBARS & INVERTER',
          desc: 'Collects direct current via copper ribbons and converts it into grid-ready AC power for your home.'
        }
      ][cutawayStepIdx]
    : [
        {
          code: '01',
          title: 'AERODYNAMIC BLADES',
          desc: 'Lift forces convert wind kinetic energy into smooth rotational shaft torque.'
        },
        {
          code: '02',
          title: config.turbineType === 'hawt' ? 'PLANETARY GEARBOX & SHAFT' : 'DIRECT-DRIVE ROTOR CAGE',
          desc:
            config.turbineType === 'hawt'
              ? 'Steps up low-RPM blade rotation cleanly to match the high-speed permanent-magnet core.'
              : 'Omnidirectional helical rotor transfers torque directly into the central stainless drive shaft.'
        },
        {
          code: '03',
          title: 'ELECTROMAGNETIC GENERATOR',
          desc: 'Multi-turn copper stator coils capture flux from spinning N52 magnets to generate AC power.'
        }
      ][cutawayStepIdx];

  return (
    <div className="no-print relative h-full w-full overflow-hidden border-b border-sky-300/80 dark:border-[#22252A] bg-[#BADFF8] dark:bg-[#0A0B0D] text-[#0C1B2A] dark:text-[#F3F4F6] select-none transition-colors duration-200">
      {/* 1. Isolated Stable WebGL Canvas Mount Container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
      />

      {/* Bottom subtle architectural gradient scrim for crisp AEROCHECK headline contrast (hidden during zoomed cutaway) */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-80 sm:h-72 bg-gradient-to-t from-[#CBE7FA] via-[#CBE7FA]/92 to-transparent dark:h-56 dark:from-[#0A0B0D] dark:via-[#0A0B0D]/90 dark:to-transparent z-10 transition-opacity duration-300 ${
          inScrollCutaway ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* 2. Floating Technical Inspection HUD Tooltip */}
      <div
        ref={hudCardRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          opacity: 0,
          willChange: 'transform, opacity',
          transition: 'opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 35
        }}
      >
        {activeHoverMeta && (
          <div
            className="pointer-events-none relative -translate-x-1/2 -translate-y-full pb-6"
            onMouseEnter={() => {
              if (pinnedPart) setIsCardHovered(true);
            }}
            onMouseLeave={() => {
              if (pinnedPart) setIsCardHovered(false);
            }}
          >
            <div
              className="pointer-events-auto w-[310px] sm:w-[350px] p-4 bg-[#F4F4F0]/95 dark:bg-[#0A0B0D]/95 backdrop-blur-xl border border-[#D4D4CE] dark:border-[#22252A]"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[#D4D4CE] dark:border-[#22252A] pb-2 mb-2">
                <span className="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-[#0F62FE] dark:text-sky-400">
                  {activeHoverMeta.tag}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/70 dark:bg-[#101216] px-1.5 py-0.5 font-mono-tabular text-[9px] font-bold text-[#0F62FE] dark:text-sky-400">
                    {activeHoverMeta.formula}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPinnedPart(null);
                      setHoveredPart(null);
                      liveStateRef.current.pinnedPart = null;
                      liveStateRef.current.hoveredPartId = null;
                    }}
                    className="pointer-events-auto text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111214] dark:hover:text-[#F3F4F6] p-0.5 cursor-pointer"
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <h4 className="font-display text-xs sm:text-sm font-bold text-[#111214] dark:text-[#F3F4F6] leading-tight">
                {activeHoverMeta.title}
              </h4>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#52565E] dark:text-[#9CA3AF]">
                {activeHoverMeta.summary}
              </p>
              <div className="mt-2.5 border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/60 dark:bg-[#101216] p-2 text-[10px] text-[#111214] dark:text-[#F3F4F6] flex items-start gap-1.5">
                <Activity className="h-3 w-3 text-[#0F62FE] dark:text-sky-400 shrink-0 mt-0.5" />
                <span className="leading-normal">{activeHoverMeta.engineeringNote}</span>
              </div>
            </div>
            <div className="absolute left-1/2 bottom-0 -translate-x-1/2 flex flex-col items-center pointer-events-none">
              <div className="h-3.5 w-px bg-[#0F62FE] dark:bg-sky-400" />
              <div className="h-2 w-2 bg-[#0F62FE] dark:bg-sky-400" />
            </div>
          </div>
        )}
      </div>

      {/* 3. AeroCheck Floating Architectural HUD Layer */}
      <div
        ref={hudRootRef}
        className="pointer-events-none absolute inset-0 z-20 max-w-[1440px] mx-auto px-4 sm:px-10 py-4 sm:py-7 flex flex-col justify-between"
      >
        {/* Top HUD Row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
          {/* Top-Left: Active Reference Site */}
          <div className="hero-hud-stagger pointer-events-auto px-3 py-2 sm:px-4 sm:py-3 bg-sky-50/92 border border-sky-200/85 shadow-[0_4px_16px_rgba(14,165,233,0.1)] dark:bg-[#0A0B0D]/90 dark:border-[#22252A] dark:shadow-none font-mono-tabular text-xs w-full sm:w-auto sm:max-w-[340px]">
            <div className="text-[9px] sm:text-[10px] text-[#52565E] dark:text-[#8E94A0] tracking-wider">
              {t('hero_active_site')}
            </div>
            <div className="text-[#111214] dark:text-[#F3F4F6] font-semibold mt-0.5 truncate">
              {siteName}
            </div>
            <div className="text-[10px] sm:text-[11px] text-[#52565E] dark:text-[#9CA3AF] mt-0.5">
              {lat.toFixed(4)}° N / {lon.toFixed(4)}° E · {audit?.siteElevationM ?? liveSurface?.elevationM ?? 85} m ASL
            </div>
          </div>

          {/* Top-Center: Internal Mechanics Cutaway Header */}
          <div
            className={`hidden md:block text-center px-5 py-2.5 bg-sky-50/92 border border-sky-200/85 shadow-[0_4px_16px_rgba(14,165,233,0.1)] dark:bg-[#0A0B0D]/90 dark:border-[#22252A] dark:shadow-none transition-opacity duration-300 ${
              isCutawayActive ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="font-mono-tabular text-[10px] text-[#0F62FE] dark:text-sky-400 tracking-widest">
              {t('hero_cutaway_badge')} · {activeArchLabel.toUpperCase()}
            </div>
            <div className="font-display text-sm font-bold text-[#111214] dark:text-[#F3F4F6] mt-0.5">
              {config.turbineType === 'hawt'
                ? 'Nacelle Drivetrain & Yaw Assembly'
                : 'Direct-Drive Permanent-Magnet Core'}
            </div>
          </div>

          {/* Top-Right: Anemometer Telemetry */}
          <div className="hero-hud-stagger pointer-events-auto flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-auto px-3 py-2 sm:px-4 sm:py-3 bg-sky-50/92 border border-sky-200/85 shadow-[0_4px_16px_rgba(14,165,233,0.1)] dark:bg-[#0A0B0D]/90 dark:border-[#22252A] dark:shadow-none font-mono-tabular text-xs flex sm:block items-center justify-between gap-3 sm:text-right">
              <div>
                <div className="text-[9px] sm:text-[10px] text-[#52565E] dark:text-[#8E94A0] tracking-wider flex items-center sm:justify-end gap-1.5">
                  <span>{t('hero_anemometer')}</span>
                  {liveSurface?.source === 'open_meteo_live' && (
                    <span className="inline-flex items-center gap-1 border border-[#059669]/40 dark:border-emerald-400/40 bg-[#059669]/10 dark:bg-emerald-500/10 px-1 py-0.2 text-[8px] font-bold text-[#059669] dark:text-emerald-400">
                      LIVE
                    </span>
                  )}
                </div>
                <div className="flex items-baseline sm:justify-end gap-2 sm:gap-3 mt-0.5">
                  <AnimatedNumber
                    value={avgHubSpeed}
                    decimals={1}
                    suffix=" m/s"
                    className="text-sm sm:text-lg font-bold text-[#0F62FE] dark:text-sky-400 whitespace-nowrap"
                  />
                  <span className="text-[11px] sm:text-xs text-[#111214] dark:text-[#F3F4F6] font-semibold whitespace-nowrap">
                    ρ {siteAirDensity.toFixed(3)} kg/m³
                  </span>
                </div>
              </div>
              <div className="text-[10px] sm:text-[11px] text-[#52565E] dark:text-[#9CA3AF] text-right sm:mt-0.5">
                {activeArchLabel} · {Math.round(instantPowerAtAvgW)} W · {rotorKinematics.regime}
              </div>
              {liveSurface && (
                <div className="hidden sm:block text-[9.5px] text-[#52565E] dark:text-[#8E94A0] mt-0.5">
                  {t('hero_live_wind')}: {liveSurface.currentWindSpeedMs.toFixed(1)} m/s @ {liveSurface.windDirectionDeg}° · {liveSurface.shortwaveRadiationWm2} W/m²
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {inScrollCutaway && (
                <button
                  type="button"
                  onClick={onScrollToBento}
                  className="pointer-events-auto border border-[#D4D4CE] dark:border-[#22252A] bg-sky-50/92 dark:bg-[#0A0B0D]/92 px-3 py-1.5 font-mono-tabular text-[10px] font-bold tracking-widest text-[#111214] dark:text-[#F3F4F6] hover:border-[#0F62FE] dark:hover:border-sky-400 transition-colors cursor-pointer"
                >
                  SKIP TO AUDIT →
                </button>
              )}
              {isCustomCameraView && (
                <button
                  type="button"
                  onClick={() => {
                    liveStateRef.current.userControllingCamera = false;
                    setIsCustomCameraView(false);
                    setCameraPreset('corridor');
                  }}
                  className="flex items-center gap-1.5 border border-[#0F62FE] dark:border-sky-400 bg-[#F4F4F0]/94 dark:bg-[#0A0B0D]/92 px-2.5 py-1 font-mono-tabular text-[10px] font-bold text-[#0F62FE] dark:text-sky-400 whitespace-nowrap shrink-0 cursor-pointer"
                  title="Reset camera angle to narrative view"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>{t('btn_reset_view').toUpperCase()}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Video-Style Bottom-Left X-Ray / Layer Cutaway Card (Visible during 8% -> 96% scroll sequence) */}
        <AnimatePresence mode="wait">
          {inScrollCutaway && dockCollapsed && (
            <motion.div
              key={`${isSolarCutawayPhase ? 'solar' : 'wind'}-${cutawayStepIdx}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto absolute bottom-14 sm:bottom-16 left-4 sm:left-10 z-[25] w-[calc(100%-2rem)] max-w-[390px] border border-sky-300/80 dark:border-[#2A3038] bg-sky-50/92 dark:bg-[#0D1014]/88 px-5 py-4 shadow-lg"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <span
                  className={`font-mono-tabular text-[10px] font-bold tracking-[0.16em] uppercase ${
                    isSolarCutawayPhase
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-[#0F62FE] dark:text-sky-400'
                  }`}
                >
                  {isSolarCutawayPhase ? 'SOLAR LAYER CUTAWAY' : 'TURBINE X-RAY CUTAWAY'}
                </span>
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((dotIdx) => (
                    <span
                      key={dotIdx}
                      className={`h-[3px] transition-all duration-200 ${
                        dotIdx === cutawayStepIdx
                          ? `w-5 ${isSolarCutawayPhase ? 'bg-amber-500 dark:bg-amber-400' : 'bg-[#0F62FE] dark:bg-sky-400'}`
                          : 'w-2 bg-[#CBD5E1] dark:bg-[#334155]'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="font-display text-base sm:text-lg font-extrabold tracking-tight text-[#111214] dark:text-[#F3F4F6] flex items-baseline gap-2">
                <span
                  className={`font-mono-tabular text-xs font-bold ${
                    isSolarCutawayPhase
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-[#0F62FE] dark:text-sky-400'
                  }`}
                >
                  {cutawayStory.code} /
                </span>
                <span>{cutawayStory.title}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#52565E] dark:text-[#9CA3AF]">
                {cutawayStory.desc}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom HUD Row: Giant Kinetic Headline + Morph Switch & Launch Auditor (hidden during cutaway scroll) */}
        <div
          className={`relative flex flex-col lg:flex-row lg:flex-wrap xl:flex-nowrap lg:items-end justify-between gap-4 sm:gap-5 pb-12 sm:pb-10 transition-[opacity,transform] duration-200 ease-out ${
            dockCollapsed && !inScrollCutaway
              ? 'translate-y-0 opacity-100'
              : 'translate-y-3 opacity-0 pointer-events-none'
          }`}
        >
          <div className="hero-hud-stagger pointer-events-auto min-w-0 max-w-lg">
            <div className="font-mono-tabular text-[10px] sm:text-[11px] text-[#52565E] dark:text-[#9CA3AF] tracking-wider mb-1.5 flex flex-wrap items-center gap-2">
              <span>{t('hero_subhead')}</span>
              {activeChapterIdx > 0 && (
                <span className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/90 dark:bg-[#101216] px-1.5 py-0.5 text-[10px] text-[#0F62FE] dark:text-sky-400">
                  {activeChapter.formula}
                </span>
              )}
            </div>
            <h1 className="font-display text-[clamp(1.5rem,7.2vw,4.75rem)] font-extrabold leading-[0.94] tracking-[-0.03em] text-[#111214] dark:text-[#F3F4F6]">
              AEROCHECK
            </h1>
            <AnimatePresence mode="wait">
              <motion.p
                key={activeChapterIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="text-xs sm:text-sm text-[#111214]/90 dark:text-[#D1D5DB] mt-2 sm:mt-2.5 max-w-lg leading-relaxed"
              >
                {activeChapterIdx === 0
                  ? t('hero_desc_default')
                  : activeChapter.caption}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Persistent Interactive Architecture Switch + Stage Navigation Controls */}
          <div className="hero-hud-stagger pointer-events-auto flex flex-wrap items-center gap-2.5 max-w-full">
            <div
              className="inline-flex h-10 items-center border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/94 dark:bg-[#0A0B0D]/92 p-0.5"
              role="group"
              aria-label="Hero 3D turbine architecture switch"
            >
              <button
                type="button"
                onClick={() => onConfigChange({ turbineType: 'hawt', cutInSpeedMs: null })}
                aria-pressed={config.turbineType === 'hawt'}
                className={`h-full px-3 text-xs font-mono-tabular font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center ${
                  config.turbineType === 'hawt'
                    ? 'bg-[#0F62FE] text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 font-semibold'
                    : 'text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111214] dark:hover:text-[#F3F4F6]'
                }`}
              >
                {t('hawt_label')}
              </button>
              <button
                type="button"
                onClick={() => onConfigChange({ turbineType: 'vawt', cutInSpeedMs: null })}
                aria-pressed={config.turbineType !== 'hawt'}
                className={`h-full px-3 text-xs font-mono-tabular font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center ${
                  config.turbineType !== 'hawt'
                    ? 'bg-[#0F62FE] text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 font-semibold'
                    : 'text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111214] dark:hover:text-[#F3F4F6]'
                }`}
              >
                {t('vawt_label')}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (explodedAmount > 0.2) {
                  setExplodedAmount(0.0);
                  onJumpToChapter?.(0);
                } else {
                  setExplodedAmount(1.0);
                  onJumpToChapter?.(1);
                }
              }}
              className="inline-flex h-10 items-center justify-center px-4 text-xs font-mono-tabular border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/94 dark:bg-[#0A0B0D]/92 text-[#111214] dark:text-[#F3F4F6] hover:border-[#0F62FE] dark:hover:border-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {explodedAmount > 0.2 ? t('btn_reset_view') : t('btn_inspect_cutaway')}
            </button>

            <button
              type="button"
              onClick={onScrollToBento}
              className="inline-flex h-10 items-center justify-center gap-2 px-5 text-xs font-mono-tabular font-bold tracking-wider bg-[#0F62FE] text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t('btn_launch_auditor')}
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Minimal Scroll Sequence Telemetry Indicator (Right Margin) */}
      <div className="hero-hud-stagger hidden xl:flex flex-col items-center gap-2 absolute right-6 top-1/2 -translate-y-1/2 z-20 pointer-events-auto px-3 py-2.5 bg-sky-50/92 border border-sky-200/85 shadow-[0_4px_16px_rgba(14,165,233,0.1)] dark:bg-transparent dark:border-transparent dark:shadow-none">
        {inScrollCutaway ? (
          <>
            <span className="font-mono-tabular text-[10px] font-bold tracking-widest text-[#52565E] dark:text-[#9CA3AF]">
              IN
            </span>
            <div className="w-[2px] h-28 bg-[#D4D4CE] dark:bg-[#22252A] overflow-hidden">
              <div
                ref={scrollBarFillRef}
                className={`w-full origin-top ${
                  isSolarCutawayPhase
                    ? 'bg-amber-500 dark:bg-amber-400'
                    : 'bg-[#0F62FE] dark:bg-sky-400'
                }`}
                style={{ height: '100%', transform: `scaleY(${Math.max(0.05, cutawayPhaseRatio).toFixed(3)})` }}
              />
            </div>
            <span
              ref={cutawayPctRef}
              className="font-mono-tabular text-[10px] font-bold text-[#52565E] dark:text-[#9CA3AF]"
            >
              {cutawayPhasePct}%
            </span>
          </>
        ) : (
          <div className="flex flex-col items-end gap-2">
            <div className="w-[2px] h-24 bg-[#D4D4CE] dark:bg-[#22252A] overflow-hidden">
              <div
                ref={scrollBarFillRef}
                className="w-full origin-top bg-[#0F62FE] dark:bg-sky-400"
                style={{ height: '100%', transform: `scaleY(${Math.max(0.06, scrollProgress).toFixed(3)})` }}
              />
            </div>
            <button
              type="button"
              onClick={() => onJumpToChapter?.(0)}
              className={`font-mono-tabular text-[10px] tracking-wider cursor-pointer transition-colors ${
                activeChapterIdx === 0
                  ? 'text-[#0F62FE] dark:text-sky-400 font-semibold'
                  : 'text-[#52565E] dark:text-[#8E94A0] hover:text-[#111214] dark:hover:text-[#F3F4F6]'
              }`}
            >
              01 OVERVIEW
            </button>
            <button
              type="button"
              onClick={() => {
                setExplodedAmount(1.0);
                onJumpToChapter?.(1);
              }}
              className={`font-mono-tabular text-[10px] tracking-wider cursor-pointer transition-colors ${
                activeChapterIdx === 1 || activeChapterIdx === 2
                  ? 'text-[#0F62FE] dark:text-sky-400 font-semibold'
                  : 'text-[#52565E] dark:text-[#8E94A0] hover:text-[#111214] dark:hover:text-[#F3F4F6]'
              }`}
            >
              02 CUTAWAY
            </button>
            <button
              type="button"
              onClick={onScrollToBento}
              className={`font-mono-tabular text-[10px] tracking-wider cursor-pointer transition-colors ${
                activeChapterIdx === 3
                  ? 'text-[#0F62FE] dark:text-sky-400 font-semibold'
                  : 'text-[#52565E] dark:text-[#8E94A0] hover:text-[#111214] dark:hover:text-[#F3F4F6]'
              }`}
            >
              03 AUDITOR
            </button>
          </div>
        )}
      </div>

      {/* 5. Unified Collapsible Bottom 3D Control Dock */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 z-30 w-full max-w-[min(920px,94vw)] -translate-x-1/2 px-2">
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="hud-dock-surface pointer-events-auto mb-1.5 flex items-center gap-1.5 px-3.5 py-2 sm:py-1 min-h-[38px] sm:min-h-0 font-mono-tabular text-[11px] font-semibold text-[#111214] dark:text-[#F3F4F6] hover:border-[#0F62FE] dark:hover:border-sky-400 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="h-3.5 w-3.5 text-[#0F62FE] dark:text-sky-400" />
                <span>
                  {t('btn_controls_open')}<span className="hidden sm:inline"> (H)</span>
                </span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5 text-[#52565E] dark:text-[#9CA3AF]" />
                <span>
                  {t('btn_controls_hide')}<span className="hidden sm:inline"> (H)</span>
                </span>
              </>
            )}
          </button>

          <div
            className={`hud-dock-surface aero-adaptive-surface pointer-events-auto w-full overflow-y-auto transition-[opacity,transform] duration-200 ease-out ${
              dockCollapsed
                ? 'max-h-0 translate-y-6 opacity-0 pointer-events-none border-0 p-0'
                : 'max-h-[42vh] sm:max-h-[260px] translate-y-0 opacity-100 p-3 sm:px-5 sm:py-3.5'
            }`}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#D4D4CE] dark:border-[#22252A] pb-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDockTab('sliders')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono-tabular font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    dockTab === 'sliders'
                      ? 'bg-[#0F62FE] text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950'
                      : 'border border-[#D4D4CE] dark:border-[#22252A] text-[#52565E] dark:text-[#9CA3AF]'
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>{t('dock_sliders')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDockTab('camera')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono-tabular font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    dockTab === 'camera'
                      ? 'bg-[#0F62FE] text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950'
                      : 'border border-[#D4D4CE] dark:border-[#22252A] text-[#52565E] dark:text-[#9CA3AF]'
                  }`}
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>{t('dock_camera')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDockTab('presets')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono-tabular font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    dockTab === 'presets'
                      ? 'bg-[#0F62FE] text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950'
                      : 'border border-[#D4D4CE] dark:border-[#22252A] text-[#52565E] dark:text-[#9CA3AF]'
                  }`}
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>{t('dock_presets')}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {onToggleComparison && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleComparison();
                      onScrollToBento();
                    }}
                    className="flex items-center gap-1 border border-[#D4D4CE] dark:border-[#22252A] px-2.5 py-1 text-[11px] font-mono-tabular text-[#111214] dark:text-[#F3F4F6] hover:border-[#0F62FE] dark:hover:border-sky-400 cursor-pointer"
                  >
                    <GitCompare className="h-3 w-3" />
                    <span>{isComparing ? t('dock_comparing') : t('dock_compare')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setExplodedAmount(0.0);
                    setHoveredPart(null);
                    setPinnedPart(null);
                    setCameraPreset('corridor');
                    liveStateRef.current.userControllingCamera = false;
                    setIsCustomCameraView(false);
                    onResetConfig();
                  }}
                  className="flex items-center gap-1 border border-[#D4D4CE] dark:border-[#22252A] px-2.5 py-1 text-[11px] font-mono-tabular text-[#52565E] dark:text-[#9CA3AF] hover:border-[#0F62FE] dark:hover:border-sky-400 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>{t('dock_reset')}</span>
                </button>
              </div>
            </div>

            {dockTab === 'sliders' && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="font-mono-tabular text-[#52565E] dark:text-[#9CA3AF]">{t('ctrl_hub_height')}</span>
                    <span className="font-mono-tabular font-bold text-[#0F62FE] dark:text-sky-400">{config.hubHeightM} m</span>
                  </div>
                  <input
                    type="range"
                    min={6}
                    max={40}
                    step={1}
                    value={config.hubHeightM}
                    style={{ '--slider-pct': `${(((config.hubHeightM - 6) / 34) * 100).toFixed(1)}%` } as React.CSSProperties}
                    onChange={(e) => onConfigChange({ hubHeightM: Number(e.target.value) })}
                    className="aero-slider"
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="font-mono-tabular text-[#52565E] dark:text-[#9CA3AF]">{t('ctrl_rotor_diam')}</span>
                    <span className="font-mono-tabular font-bold text-[#0F62FE] dark:text-sky-400">{config.rotorDiameterM.toFixed(1)} m</span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={6.0}
                    step={0.1}
                    value={config.rotorDiameterM}
                    style={{ '--slider-pct': `${(((config.rotorDiameterM - 1.0) / 5.0) * 100).toFixed(1)}%` } as React.CSSProperties}
                    onChange={(e) => onConfigChange({ rotorDiameterM: Number(e.target.value) })}
                    className="aero-slider"
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="font-mono-tabular text-[#52565E] dark:text-[#9CA3AF]">{t('ctrl_budget')}</span>
                    <span className="font-mono-tabular font-bold text-[#0F62FE] dark:text-sky-400">
                      ₹{(config.budgetInr / 1000).toFixed(0)}k
                    </span>
                  </div>
                  <input
                    type="range"
                    min={50000}
                    max={500000}
                    step={10000}
                    value={config.budgetInr}
                    style={{ '--slider-pct': `${(((config.budgetInr - 50000) / 450000) * 100).toFixed(1)}%` } as React.CSSProperties}
                    onChange={(e) => onConfigChange({ budgetInr: Number(e.target.value) })}
                    className="aero-slider"
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="font-mono-tabular text-[#52565E] dark:text-[#9CA3AF]">Cutaway Explode</span>
                    <span className="font-mono-tabular font-bold text-[#0F62FE] dark:text-sky-400">
                      {Math.round((isTurbineHovered ? 1 : explodedAmount) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={explodedAmount}
                    style={{ '--slider-pct': `${(explodedAmount * 100).toFixed(1)}%` } as React.CSSProperties}
                    onChange={(e) => setExplodedAmount(Number(e.target.value))}
                    className="aero-slider"
                  />
                </div>
              </div>
            )}

            {dockTab === 'camera' && (
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: 'rotor', label: t('cam_rotor'), icon: Wind },
                    { id: 'overview', label: t('cam_overview'), icon: Layers },
                    { id: 'solar', label: t('cam_solar'), icon: Sun },
                    { id: 'corridor', label: t('cam_corridor'), icon: Activity }
                  ] as const
                ).map((cam) => {
                  const CamIcon = cam.icon;
                  const active = cameraPreset === cam.id;
                  return (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => handleSelectCameraPreset(cam.id)}
                      className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs font-mono-tabular transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'border-[#0F62FE] bg-[#0F62FE] text-white dark:border-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 font-bold'
                          : 'border-[#D4D4CE] dark:border-[#22252A] text-[#52565E] dark:text-[#9CA3AF] hover:border-[#0F62FE] dark:hover:border-sky-400'
                      }`}
                    >
                      <CamIcon className="h-3.5 w-3.5" />
                      <span>{cam.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {dockTab === 'presets' && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {presetList.map((preset) => {
                    const isActive = activePresetKey === preset.key;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => onSelectPreset(preset)}
                        className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs font-mono-tabular transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isActive
                            ? 'border-[#0F62FE] bg-[#0F62FE] text-white dark:border-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 font-bold'
                            : 'border-[#D4D4CE] dark:border-[#22252A] text-[#52565E] dark:text-[#9CA3AF] hover:border-[#0F62FE] dark:hover:border-sky-400'
                        }`}
                      >
                        <Compass className="h-3.5 w-3.5" />
                        <span>{preset.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono-tabular text-[#52565E] dark:text-[#9CA3AF]">Terrain α:</span>
                  <select
                    value={config.terrain}
                    onChange={(e) => onConfigChange({ terrain: e.target.value })}
                    className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#101216] px-2.5 py-1.5 text-xs font-mono-tabular text-[#111214] dark:text-[#F3F4F6] focus:border-[#0F62FE] dark:focus:border-sky-400 focus:outline-none"
                  >
                    {Object.values(TERRAIN_PROFILES).map((prof) => (
                      <option key={prof.id} value={prof.id}>
                        {prof.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
