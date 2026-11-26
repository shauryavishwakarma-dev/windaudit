/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  PRESETS,
  fetchSiteWeather,
  fetchLiveSurfaceTelemetry,
  LiveSurfaceTelemetry,
  LocationSearchResult,
  SitePreset,
  reverseGeocodeLocation,
  getAccurateLivePosition,
  inferTerrainFromLocation
} from './api';
import {
  AuditConfig,
  runWindAudit,
  runTeacherSanityCheck,
  sanitizeAuditConfig,
  WeatherData
} from './physics';
import { LanguageProvider, useLanguage, getInitialLanguage } from './i18n';
import { playThemeSwitchSound } from './utils/themeSound';
import { PageTransition } from './components/ui/PageTransition';
import { Header } from './components/Header';
import { IglooSpatialStage } from './components/IglooSpatialStage';
import { MapPanel } from './components/MapPanel';
import { ControlsPanel } from './components/ControlsPanel';
import { VerdictBanner } from './components/VerdictBanner';
import { RealityCheckPanel } from './components/RealityCheckPanel';
import { KpiGrid } from './components/KpiGrid';
import { ChartsPanel } from './components/ChartsPanel';
import {
  LocationComparisonPanel,
  SavedSiteInfo
} from './components/LocationComparisonPanel';
import { PdfAuditReportSummary } from './components/PdfAuditReportSummary';
import { GroundingIntelPanel } from './components/GroundingIntelPanel';
import { MethodologyTab } from './components/MethodologyTab';
import { NotFoundPage } from './components/NotFoundPage';
import { generateAndDownloadAuditPdf } from './utils/exportAuditPdf';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

declare global {
  interface Window {
    runTeacherSanityCheck: typeof runTeacherSanityCheck;
  }
}

// Expose globally so teacher can run runTeacherSanityCheck() directly in Chrome DevTools Console
if (typeof window !== 'undefined') {
  window.runTeacherSanityCheck = runTeacherSanityCheck;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const DEFAULT_CONFIG: AuditConfig = {
  hubHeightM: 15,
  rotorDiameterM: 2.5,
  ratedPowerW: 1000,
  budgetInr: 150000,
  tariffInr: 8.0,
  terrain: 'urban',
  shearModel: 'power_law',
  customAlpha: null,
  customZ0: null,
  turbineType: 'vawt',
  solarTiltDeg: null,
  solarAzimuthDeg: null
};

const scrollRevealTransition = {
  duration: 0.15,
  ease: 'easeOut' as const
};

interface SavedComparisonSnapshot extends SavedSiteInfo {
  terrain: string;
  weatherData: WeatherData;
}

function AppContent() {
  const { language, t } = useLanguage();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Synchronize Tailwind v4 dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Automatically detect real-time location for whichever user opens the app
  const initialPreset = PRESETS.varanasi;
  const [activePresetKey, setActivePresetKey] = useState<string | null>(initialPreset.key);
  const [siteName, setSiteName] = useState<string>('Akhari, Varanasi, Uttar Pradesh');
  const [coords, setCoords] = useState<{ lat: number; lon: number }>({
    lat: 25.2432,
    lon: 82.9528
  });
  const [config, setConfig] = useState<AuditConfig>({
    ...DEFAULT_CONFIG,
    terrain: initialPreset.defaultTerrain
  });

  const userSelectedLocationRef = useRef<boolean>(false);

  // Auto-locate user on initial load using multi-tiered GPS (Hardware -> Wi-Fi -> IP)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;
    const applyCoords = async (targetLat: number, targetLon: number) => {
      if (!isMounted || userSelectedLocationRef.current) return;
      setActivePresetKey(null);
      setCoords({ lat: targetLat, lon: targetLon });
      try {
        const resolvedName = await reverseGeocodeLocation(targetLat, targetLon, getInitialLanguage());
        if (isMounted && resolvedName && !userSelectedLocationRef.current) {
          setSiteName(resolvedName);
          setConfig((prev) =>
            sanitizeAuditConfig({
              ...prev,
              terrain: inferTerrainFromLocation(resolvedName, targetLat, targetLon)
            })
          );
        }
      } catch (e) {
        console.debug('Reverse geocode error on auto-locate:', e);
      }
    };

    getAccurateLivePosition()
      .then((fix) => {
        if (isMounted && fix && !userSelectedLocationRef.current) {
          applyCoords(fix.lat, fix.lon);
        }
      })
      .catch((err) => {
        console.debug('Auto-locate initial attempt deferred:', err?.message || err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [liveSurface, setLiveSurface] = useState<LiveSurfaceTelemetry | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState<boolean>(true);
  const [currentPath, setCurrentPath] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [activeTab, setActiveTab] = useState<'auditor' | 'methodology'>(() =>
    typeof window !== 'undefined' && window.location.pathname === '/methodology'
      ? 'methodology'
      : 'auditor'
  );
  const [activeNavSection, setActiveNavSection] = useState<'hero' | 'auditor' | 'analytics' | 'methodology'>('hero');
  const [skipAutoScrollReset, setSkipAutoScrollReset] = useState<boolean>(false);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState<boolean>(false);
  const [heroScrollProgress, setHeroScrollProgress] = useState<number>(0);

  // Toast Notification State (Success & Error feedback)
  const [toast, setToast] = useState<{
    id: number;
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const mapReverseGeoAbortRef = useRef<AbortController | null>(null);
  const liveWeatherAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      mapReverseGeoAbortRef.current?.abort();
      liveWeatherAbortRef.current?.abort();
    };
  }, []);

  const showToast = useCallback((type: 'success' | 'error', title: string, message: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), type, title, message });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  const isNotFoundRoute = useMemo(() => {
    const normalized = currentPath.replace(/\/+$/, '') || '/';
    return !['/', '/index.html', '/auditor', '/analytics', '/methodology'].includes(normalized);
  }, [currentPath]);

  useEffect(() => {
    const onPopState = () => {
      const nextPath = window.location.pathname;
      setCurrentPath(nextPath);
      if (nextPath === '/methodology') {
        setActiveTab('methodology');
      } else {
        setActiveTab('auditor');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Side-by-Side Location Comparison State
  const [savedComparisonSite, setSavedComparisonSite] =
    useState<SavedComparisonSnapshot | null>(null);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [showMathDrawer, setShowMathDrawer] = useState<boolean>(false);

  // PDF Report Modal & Generated Graph Data URLs State
  const [pdfModalOpen, setPdfModalOpen] = useState<boolean>(false);
  const [pdfDownloadMeta, setPdfDownloadMeta] = useState<{
    fileName: string;
    chart1Url: string;
    chart2Url: string;
  } | null>(null);

  const iglooTrackRef = useRef<HTMLDivElement>(null);
  const bentoSectionRef = useRef<HTMLDivElement>(null);
  const weatherReqIdRef = useRef<number>(0);
  const edgeCooldownUntilRef = useRef<number>(0);
  const hitEdgePauseRef = useRef<boolean>(false);

  // Page-wide scroll progress bar
  const { scrollYProgress } = useScroll();
  const smoothScrollBar = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 28,
    restDelta: 0.001
  });

  // Track normalized scroll progress across the 235vh sticky 3D Stage & highlight active top nav section
  useEffect(() => {
    let rafId = 0;
    let lastReportedProgress = -1;

    const updateScrollProgress = () => {
      rafId = 0;
      const trackEl = iglooTrackRef.current;
      if (trackEl) {
        const rect = trackEl.getBoundingClientRect();
        const scrollableDistance = Math.max(1, trackEl.offsetHeight - window.innerHeight);
        const scrolled = -rect.top;
        const progress = Math.min(1, Math.max(0, scrolled / scrollableDistance));

        // Only trigger App-level React updates at discrete phase boundaries (~16 updates total)
        // while IglooSpatialStage tracks 60fps smooth scroll directly via window.scrollY
        const getScrollPhaseBucket = (p: number) => {
          if (p < 0.08) return 0;
          if (p < 0.22) return 1;
          if (p < 0.36) return 2;
          if (p < 0.52) return 3;
          if (p < 0.66) return 4;
          if (p < 0.80) return 5;
          if (p <= 0.96) return 6;
          return 7;
        };
        if (
          getScrollPhaseBucket(progress) !== getScrollPhaseBucket(lastReportedProgress) ||
          (progress === 0 && lastReportedProgress !== 0) ||
          (progress === 1 && lastReportedProgress !== 1)
        ) {
          lastReportedProgress = progress;
          setHeroScrollProgress(progress);
        }
      }

      if (activeTab === 'methodology') {
        setActiveNavSection('methodology');
        return;
      }

      const analyticsEl = document.getElementById('analytics');
      const auditorEl = document.getElementById('auditor');
      if (analyticsEl && analyticsEl.getBoundingClientRect().top <= 160) {
        setActiveNavSection('analytics');
      } else if (auditorEl && auditorEl.getBoundingClientRect().top <= 160) {
        setActiveNavSection('auditor');
      } else {
        setActiveNavSection('hero');
      }
    };

    const handleScroll = () => {
      if (rafId === 0) {
        rafId = window.requestAnimationFrame(updateScrollProgress);
      }
    };

    // Clamped wheel handler for silky-smooth, rate-limited 3D Hero/Cutaway tour
    const handleHeroWheel = (e: WheelEvent) => {
      if (activeTab !== 'auditor' || isNotFoundRoute || e.ctrlKey) return;
      const targetEl = e.target as HTMLElement | null;
      if (targetEl?.closest('.hud-dock-surface, .leaflet-container, [role="dialog"]')) return;

      const trackEl = iglooTrackRef.current;
      if (!trackEl) return;

      const trackTop = trackEl.offsetTop;
      const scrollableDistance = Math.max(1, trackEl.offsetHeight - window.innerHeight);
      const trackEndY = trackTop + scrollableDistance;
      const currentY = window.scrollY;

      const rawDelta =
        e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight * 0.5 : e.deltaY;
      const clampedDelta = Math.max(-60, Math.min(60, rawDelta));
      if (clampedDelta === 0) return;

      const isScrollingDownInHero = clampedDelta > 0 && currentY < trackEndY - 2;
      const isScrollingUpInHero = clampedDelta < 0 && currentY > 0 && currentY <= trackEndY + 32;
      if (!isScrollingDownInHero && !isScrollingUpInHero) return;

      e.preventDefault();

      const p = Math.min(1, Math.max(0, (currentY - trackTop) / scrollableDistance));
      const progressStep = clampedDelta * 0.0014;
      const rawNextP = p + progressStep;
      if (rawNextP >= 1.0 && clampedDelta > 0) {
        window.scrollTo({ top: trackEndY + Math.max(2, clampedDelta * 0.5), behavior: 'auto' });
        return;
      }

      const clampedNextP = Math.min(1, Math.max(0, rawNextP));
      window.scrollTo({ top: trackTop + scrollableDistance * clampedNextP, behavior: 'auto' });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('wheel', handleHeroWheel, { passive: false });
    updateScrollProgress();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wheel', handleHeroWheel);
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [activeTab, isNotFoundRoute]);

  // Listen for Google Maps Platform Demo Key Quota Event (Case A defense)
  useEffect(() => {
    const handleQuotaExceeded = () => {
      setGmpQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  // Fetch 8,760 hours of ERA5 weather archive + real-time surface vector telemetry whenever coordinates change
  const loadWeatherForCoords = useCallback(async (lat: number, lon: number) => {
    const reqId = ++weatherReqIdRef.current;
    setIsLoadingWeather(true);

    liveWeatherAbortRef.current?.abort();
    const liveCtrl = new AbortController();
    liveWeatherAbortRef.current = liveCtrl;
    fetchLiveSurfaceTelemetry(lat, lon, liveCtrl.signal)
      .then((surface) => {
        if (reqId === weatherReqIdRef.current) {
          setLiveSurface(surface);
        }
      })
      .catch(() => {
        // Ignore cancelled live surface telemetry requests
      });

    try {
      const data = await fetchSiteWeather(lat, lon);
      if (reqId === weatherReqIdRef.current) {
        setWeatherData(data);
        if (data.apiWarning) {
          showToast('error', 'Telemetry Notice', data.apiWarning);
        }
      }
    } catch (err: any) {
      if (reqId === weatherReqIdRef.current) {
        showToast(
          'error',
          'Weather Fetch Error',
          err?.message || 'Unable to load meteorological telemetry for this site.'
        );
      }
    } finally {
      if (reqId === weatherReqIdRef.current) {
        setIsLoadingWeather(false);
      }
    }
  }, [showToast]);

  useEffect(() => {
    loadWeatherForCoords(coords.lat, coords.lon);
  }, [coords.lat, coords.lon, loadWeatherForCoords]);

  // Pre-populate a default comparison baseline (Kutch Wind Corridor) in the background so 1-click Compare works instantaneously
  useEffect(() => {
    let mounted = true;
    const preloadDefaultBaseline = async () => {
      try {
        const kutch = PRESETS.kutch;
        const data = await fetchSiteWeather(kutch.lat, kutch.lon);
        if (!mounted) return;
        setSavedComparisonSite((prev) => {
          if (prev) return prev;
          return {
            siteName: kutch.name,
            lat: kutch.lat,
            lon: kutch.lon,
            terrain: kutch.defaultTerrain,
            weatherData: data,
            savedAt: 'Preset Baseline'
          };
        });
      } catch {
        // Defer cleanly if offline
      }
    };
    preloadDefaultBaseline();
    return () => {
      mounted = false;
    };
  }, []);

  // Zero-network-call instant physics & financial recalculation on slider drag or terrain change
  const audit = useMemo(() => {
    return weatherData ? runWindAudit(weatherData, config) : null;
  }, [weatherData, config]);

  // Zero-network-call recalculation for the Saved Comparison Site using the same hardware/financial sliders
  const comparisonAudit = useMemo(() => {
    if (!savedComparisonSite) return null;
    return runWindAudit(savedComparisonSite.weatherData, config);
  }, [savedComparisonSite, config]);

  // Save current audited site as Baseline B for side-by-side comparison
  const handleSaveCurrentSiteForComparison = useCallback(() => {
    if (!weatherData) return;
    const nowTime = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
    setSavedComparisonSite({
      siteName,
      lat: coords.lat,
      lon: coords.lon,
      terrain: config.terrain,
      weatherData,
      savedAt: nowTime
    });
    showToast('success', 'Baseline Saved', `${siteName} saved as Comparison Baseline B.`);
  }, [weatherData, siteName, coords.lat, coords.lon, config.terrain, showToast]);

  // Quick-load any preset directly into Baseline B
  const handleQuickLoadComparisonPreset = useCallback(async (preset: SitePreset) => {
    try {
      const data = await fetchSiteWeather(preset.lat, preset.lon);
      setSavedComparisonSite({
        siteName: preset.name,
        lat: preset.lat,
        lon: preset.lon,
        terrain: preset.defaultTerrain,
        weatherData: data,
        savedAt: 'Quick Preset'
      });
      setIsComparing(true);
    } catch (err: any) {
      showToast('error', 'Comparison Load Failed', err?.message || 'Unable to load preset comparison telemetry.');
    }
  }, [showToast]);

  // Toggle Comparison View in Bento Grid (if Saved Site is identical to Active Site, automatically load a contrasting preset as Baseline B)
  const handleToggleComparison = useCallback(async () => {
    if (isComparing) {
      setIsComparing(false);
      return;
    }

    try {
      if (
        !savedComparisonSite ||
        (Math.abs(savedComparisonSite.lat - coords.lat) < 0.01 &&
          Math.abs(savedComparisonSite.lon - coords.lon) < 0.01)
      ) {
        const contrastPreset =
          activePresetKey === 'kutch' ? PRESETS.varanasi : PRESETS.kutch;
        const data = await fetchSiteWeather(contrastPreset.lat, contrastPreset.lon);
        setSavedComparisonSite({
          siteName: contrastPreset.name,
          lat: contrastPreset.lat,
          lon: contrastPreset.lon,
          terrain: contrastPreset.defaultTerrain,
          weatherData: data,
          savedAt: 'Auto-Contrast'
        });
      }

      setIsComparing(true);
    } catch (err: any) {
      showToast('error', 'Comparison Unavailable', err?.message || 'Could not initialize baseline comparison.');
    }
  }, [isComparing, savedComparisonSite, coords.lat, coords.lon, activePresetKey, showToast]);

  // Swap Location A (Active) and Location B (Saved Baseline) instantaneously with 0 network calls
  const handleSwapLocations = useCallback(() => {
    if (!savedComparisonSite || !weatherData) return;
    const currentSnapshot: SavedComparisonSnapshot = {
      siteName,
      lat: coords.lat,
      lon: coords.lon,
      terrain: config.terrain,
      weatherData,
      savedAt: new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    userSelectedLocationRef.current = true;
    setSiteName(savedComparisonSite.siteName);
    setCoords({ lat: savedComparisonSite.lat, lon: savedComparisonSite.lon });
    setWeatherData(savedComparisonSite.weatherData);
    setActivePresetKey(null);
    setSavedComparisonSite(currentSnapshot);
    showToast('success', 'Locations Swapped', `Now auditing ${savedComparisonSite.siteName}.`);
  }, [savedComparisonSite, weatherData, siteName, coords.lat, coords.lon, config.terrain, showToast]);

  const handleSelectPreset = (preset: SitePreset) => {
    userSelectedLocationRef.current = true;
    setActivePresetKey(preset.key);
    setSiteName(preset.name);
    setCoords({ lat: preset.lat, lon: preset.lon });
    setConfig((prev) =>
      sanitizeAuditConfig({
        ...prev,
        terrain: preset.defaultTerrain,
        customAlpha: null,
        customZ0: null,
        overrideMeanWind10mMs: null,
        overridePeakSunHoursDay: null,
        overrideElevationM: null,
        solarTiltDeg: null,
        solarAzimuthDeg: null
      })
    );
    setActiveTab('auditor');
    showToast('success', 'Site Preset Loaded', `Running 8,760-hour audit for ${preset.name}.`);
  };

  const handleSelectSearchResult = (loc: LocationSearchResult) => {
    if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) {
      showToast('error', 'Invalid Coordinates', 'The selected location has invalid latitude or longitude.');
      return;
    }
    userSelectedLocationRef.current = true;
    const safeLat = Math.min(90, Math.max(-90, loc.lat));
    const safeLon = Math.min(180, Math.max(-180, loc.lon));
    setActivePresetKey(null);
    const label =
      loc.fullLocation || (loc.admin1 ? `${loc.name}, ${loc.admin1}` : loc.name);
    const inferredTerrain = inferTerrainFromLocation(label, safeLat, safeLon);
    setSiteName(label);
    setCoords({ lat: safeLat, lon: safeLon });
    setConfig((prev) =>
      sanitizeAuditConfig({
        ...prev,
        terrain: inferredTerrain,
        customAlpha: null,
        customZ0: null,
        overrideMeanWind10mMs: null,
        overridePeakSunHoursDay: null,
        overrideElevationM: null,
        solarTiltDeg: null,
        solarAzimuthDeg: null
      })
    );
    setActiveTab('auditor');
    if (isNotFoundRoute) {
      window.history.pushState({}, '', '/');
      setCurrentPath('/');
    }
    showToast('success', 'Location Updated', `Auditing ${label} (${inferredTerrain} terrain).`);
  };

  const handleMapClick = (lat: number, lon: number, customName?: string) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    userSelectedLocationRef.current = true;
    const safeLat = Math.min(90, Math.max(-90, lat));
    const safeLon = Math.min(180, Math.max(-180, lon));
    setActivePresetKey(null);
    mapReverseGeoAbortRef.current?.abort();
    if (customName) {
      setSiteName(customName);
    } else {
      setSiteName(`Pinned Location (${safeLat.toFixed(4)}°N, ${safeLon.toFixed(4)}°E)`);
      const geoCtrl = new AbortController();
      mapReverseGeoAbortRef.current = geoCtrl;
      reverseGeocodeLocation(safeLat, safeLon, language, geoCtrl.signal).then((resolvedName) => {
        if (!geoCtrl.signal.aborted && resolvedName) {
          setSiteName(resolvedName);
        }
      });
    }
    const inferredTerrain = inferTerrainFromLocation(customName || '', safeLat, safeLon);
    setCoords({ lat: safeLat, lon: safeLon });
    setConfig((prev) =>
      sanitizeAuditConfig({
        ...prev,
        ...(customName || inferredTerrain === 'coastal' ? { terrain: inferredTerrain, customAlpha: null, customZ0: null } : {}),
        overrideMeanWind10mMs: null,
        overridePeakSunHoursDay: null,
        overrideElevationM: null,
        solarTiltDeg: null,
        solarAzimuthDeg: null
      })
    );
  };

  const handleConfigChange = (updated: Partial<AuditConfig>) => {
    setConfig((prev) => sanitizeAuditConfig({ ...prev, ...updated }));
  };

  const handleResetConfig = () => {
    setConfig(
      sanitizeAuditConfig({
        ...DEFAULT_CONFIG,
        terrain:
          activePresetKey && PRESETS[activePresetKey as keyof typeof PRESETS]
            ? PRESETS[activePresetKey as keyof typeof PRESETS].defaultTerrain
            : 'urban'
      })
    );
    showToast('success', 'Parameters Reset', 'Turbine and financial settings restored to defaults.');
  };

  const handleExportPdf = useCallback(() => {
    if (!audit) {
      showToast('error', 'Report Not Ready', 'Audit telemetry is still loading. Please wait a moment.');
      return;
    }
    try {
      const result = generateAndDownloadAuditPdf({
        siteName,
        lat: coords.lat,
        lon: coords.lon,
        config,
        audit,
        dataSource: weatherData?.source ?? 'live'
      });
      setPdfDownloadMeta({
        fileName: result.fileName,
        chart1Url: result.chart1Url,
        chart2Url: result.chart2Url
      });
      setPdfModalOpen(true);
      showToast('success', 'PDF Report Exported', `Downloaded ${result.fileName}.`);
    } catch (err: any) {
      showToast('error', 'PDF Export Failed', err?.message || 'Could not generate PDF report.');
    }
  }, [audit, siteName, coords.lat, coords.lon, config, weatherData?.source, showToast]);

  const scrollToBento = () => {
    bentoSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleJumpToChapter = (chapterIdx: number) => {
    const trackEl = iglooTrackRef.current;
    if (!trackEl) return;
    const trackTop = trackEl.offsetTop;
    const scrollableDistance = Math.max(1, trackEl.offsetHeight - window.innerHeight);
    const targetProgress = chapterIdx / 3;
    window.scrollTo({
      top: trackTop + scrollableDistance * targetProgress,
      behavior: 'smooth'
    });
  };

  const handleTriggerGps = async () => {
    userSelectedLocationRef.current = true;
    try {
      const fix = await getAccurateLivePosition();
      const resolvedName = await reverseGeocodeLocation(fix.lat, fix.lon, language);
      handleMapClick(fix.lat, fix.lon, resolvedName || undefined);
      scrollToBento();
      showToast(
        'success',
        fix.isExactRooftop ? 'Live GPS Locked' : 'Location Estimated',
        `${fix.sourceLabel} · ${resolvedName || `${fix.lat.toFixed(4)}°N, ${fix.lon.toFixed(4)}°E`}.`
      );
    } catch (err: any) {
      console.warn('GPS trigger notice:', err);
      showToast(
        'error',
        'GPS Unavailable',
        'Could not access device location. Allow location permission or search a city above.'
      );
      scrollToBento();
    }
  };

  const handleNavigateSection = (section: 'hero' | 'auditor' | 'analytics' | 'methodology') => {
    if (isNotFoundRoute) {
      window.history.pushState({}, '', section === 'methodology' ? '/methodology' : '/');
      setCurrentPath(section === 'methodology' ? '/methodology' : '/');
    }
    if (section === 'methodology') {
      setSkipAutoScrollReset(false);
      setActiveTab('methodology');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (section === 'hero') {
      setSkipAutoScrollReset(false);
      setActiveTab('auditor');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // Navigating to an anchor inside auditor tab (#auditor / #analytics): scroll to section after fade
    setSkipAutoScrollReset(true);
    setActiveTab('auditor');
    window.setTimeout(() => {
      document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' });
      setSkipAutoScrollReset(false);
    }, 80);
  };

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} region="IN" language={language}>
      <div className="ambient-canvas min-h-screen flex flex-col justify-between bg-[#F4F4F0] text-[#111214] dark:bg-[#0A0B0D] dark:text-[#F3F4F6] transition-colors duration-200">
        {/* Top Scroll Progress Ribbon */}
        <motion.div
          style={{ scaleX: smoothScrollBar }}
          className="no-print fixed left-0 right-0 top-0 z-50 h-0.5 origin-left bg-[#0F62FE] dark:bg-sky-400"
        />

        <div>
          {/* Non-intrusive Google Maps Platform Quota Notice (Case A GHP key requirement) */}
          {gmpQuotaExceeded && (
            <div className="border-b border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6] dark:bg-[#101216] text-[#111214] dark:text-[#F3F4F6] px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50">
              <span>
                Google Maps Platform quota reached. If you are the app owner, visit{' '}
                <a
                  href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold text-[#0F62FE] dark:text-sky-400"
                >
                  maps developer site
                </a>{' '}
                for instructions to update your account.
              </span>
            </div>
          )}

          <Header
            avgWindSpeedMs={audit?.avgWindSpeedMs ?? 2.1}
            cutInSpeedMs={audit?.cutInSpeedMs ?? 3.0}
            activePresetKey={activePresetKey}
            onSelectPreset={handleSelectPreset}
            onSelectSearchResult={handleSelectSearchResult}
            activeTab={activeTab}
            activeSection={activeNavSection}
            onTabChange={setActiveTab}
            onPrint={handleExportPdf}
            onTriggerGps={handleTriggerGps}
            theme={theme}
            onToggleTheme={() => {
              const nextTheme = theme === 'dark' ? 'light' : 'dark';
              playThemeSwitchSound(nextTheme);
              setTheme(nextTheme);
            }}
            onNavigateSection={handleNavigateSection}
            onSearchError={(msg) => showToast('error', 'Location Not Found', msg)}
          />

          {isNotFoundRoute ? (
            <NotFoundPage
              requestedPath={currentPath}
              onReturnHome={() => {
                window.history.pushState({}, '', '/');
                setCurrentPath('/');
                setActiveTab('auditor');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenMethodology={() => {
                window.history.pushState({}, '', '/methodology');
                setCurrentPath('/methodology');
                setActiveTab('methodology');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          ) : (
            <>
              {/* 380vh Sticky Multi-Stage 3D Cutaway Scroll Track — kept mounted across tab switches to preserve WebGL state */}
              <section
                id="hero"
                ref={iglooTrackRef}
                data-spatial-track="true"
                aria-hidden={activeTab !== 'auditor'}
                className={`no-print w-full transition-opacity duration-500 ${
                  activeTab === 'auditor'
                    ? 'relative h-[200vh] opacity-100 pointer-events-auto'
                    : 'fixed inset-0 -z-20 h-screen overflow-hidden opacity-0 pointer-events-none'
                }`}
              >
                <div className="sticky top-[92px] xl:top-[64px] h-[calc(100vh-92px)] xl:h-[calc(100vh-64px)] w-full overflow-hidden">
                  <IglooSpatialStage
                    theme={theme}
                    config={config}
                    audit={audit}
                    liveSurface={liveSurface}
                    siteName={siteName}
                    lat={coords.lat}
                    lon={coords.lon}
                    scrollProgress={heroScrollProgress}
                    activePresetKey={activePresetKey}
                    isComparing={isComparing}
                    onToggleComparison={handleToggleComparison}
                    onSelectPreset={handleSelectPreset}
                    onConfigChange={handleConfigChange}
                    onResetConfig={handleResetConfig}
                    onScrollToBento={scrollToBento}
                    onJumpToChapter={handleJumpToChapter}
                  />
                </div>
              </section>

          {/* AeroCheck Interactive Site Auditor & Analytics Workspace */}
          {/* Dedicated Executive Site Audit Report Summary Sheet & Interactive PDF Download Modal (kept outside dark adaptive overrides for clean white print rendering) */}
          {audit && (
            <PdfAuditReportSummary
              siteName={siteName}
              lat={coords.lat}
              lon={coords.lon}
              config={config}
              audit={audit}
              dataSource={weatherData?.source ?? 'live'}
              isModalOpen={pdfModalOpen}
              lastDownloadedFileName={pdfDownloadMeta?.fileName ?? null}
              chart1Url={pdfDownloadMeta?.chart1Url ?? null}
              chart2Url={pdfDownloadMeta?.chart2Url ?? null}
              onCloseModal={() => setPdfModalOpen(false)}
              onRedownloadPdf={handleExportPdf}
            />
          )}

          <main
            id="auditor"
            ref={bentoSectionRef}
            className="aero-adaptive-surface scroll-mt-24 xl:scroll-mt-16 mx-auto max-w-[1440px] px-4 py-8 sm:py-10 sm:px-8 lg:py-14"
          >
            <PageTransition activePage={activeTab} resetScrollOnChange={!skipAutoScrollReset}>
              {activeTab === 'auditor' ? (
                <div className="space-y-6">
                  <div className="no-print flex flex-wrap items-end justify-between gap-6 pb-8 mb-8 border-b border-[#D4D4CE] dark:border-[#22252A]">
                    <div className="max-w-2xl">
                      <div className="font-mono-tabular text-xs text-[#52565E] dark:text-[#8E94A0] tracking-wider">
                        {t('ws_tag')}
                      </div>
                      <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#111214] dark:text-[#F3F4F6] mt-1.5">
                        {t('ws_title')}
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleToggleComparison}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-mono-tabular border transition-colors cursor-pointer ${
                          isComparing
                            ? 'border-[#0F62FE] bg-[#0F62FE] text-white dark:border-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 font-bold'
                            : 'border-[#D4D4CE] dark:border-[#22252A] text-[#111214] dark:text-[#F3F4F6] hover:border-[#0F62FE] dark:hover:border-sky-400'
                        }`}
                      >
                        <span>{isComparing ? t('btn_close_comparison') : t('btn_compare_locations')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => loadWeatherForCoords(coords.lat, coords.lon)}
                        disabled={isLoadingWeather}
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-mono-tabular border border-[#D4D4CE] dark:border-[#22252A] text-[#111214] dark:text-[#F3F4F6] hover:border-[#0F62FE] dark:hover:border-sky-400 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <span>{isLoadingWeather ? t('btn_fetching_era5') : t('btn_refresh_era5')}</span>
                      </button>
                    </div>
                  </div>
                      {/* Side-by-Side Two-Location Comparison Bento Overlay (when toggled ON) */}
                      <AnimatePresence>
                        {isComparing && audit && savedComparisonSite && comparisonAudit && (
                          <LocationComparisonPanel
                            key="location-comparison-panel"
                            activeSiteName={siteName}
                            activeLat={coords.lat}
                            activeLon={coords.lon}
                            activeAudit={audit}
                            savedSite={savedComparisonSite}
                            comparisonAudit={comparisonAudit}
                            config={config}
                            onSaveCurrentAsBaseline={handleSaveCurrentSiteForComparison}
                            onSwapLocations={handleSwapLocations}
                            onQuickLoadComparisonPreset={handleQuickLoadComparisonPreset}
                            onCloseComparison={() => setIsComparing(false)}
                          />
                        )}
                      </AnimatePresence>

                      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-stretch">
                        {/* Left Bento Column (5 of 12 cols): Pin-to-Select Google Map Tile & Sticky Controls Tile */}
                        <div className="no-print flex flex-col gap-5 lg:col-span-5">
                          <motion.div
                            initial={{ opacity: 0.92, y: 8 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.05 }}
                            transition={scrollRevealTransition}
                          >
                            <MapPanel
                              lat={coords.lat}
                              lon={coords.lon}
                              siteName={siteName}
                              isLoading={isLoadingWeather}
                              onMapClick={handleMapClick}
                            />
                          </motion.div>

                          <div className="lg:sticky lg:top-[5.5rem] lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto">
                            <ControlsPanel
                              config={config}
                              onChange={handleConfigChange}
                              onReset={handleResetConfig}
                              sweptAreaM2={audit?.sweptAreaM2 ?? 4.91}
                              shearMultiplier={audit?.shearMultiplier ?? 1.13}
                              lat={coords.lat}
                              lon={coords.lon}
                              onApplyCoords={handleMapClick}
                              baselineWind10mMs={audit?.baselineWind10mMs ?? 2.45}
                              baselineSolarKwhM2Day={audit?.baselineSolarKwhM2Day ?? 5.15}
                              baselineElevationM={audit?.baselineElevationM ?? 80}
                              activeRatedWindSpeedMs={audit?.ratedWindSpeedMs ?? 11.2}
                              avgAmbientTempC={audit?.avgAmbientTempC ?? 26.5}
                            />
                          </div>
                        </div>

                        {/* Right Bento Column (7 of 12 cols): Verdict Hero Card -> KPI Grid -> Power Curve & Wind Distribution Chart -> Wind vs. Solar Comparison Table & Assumptions Drawer */}
                        <div className="print-full-col flex flex-col gap-5 lg:col-span-7">
                          {audit ? (
                            <>
                              <motion.div
                                initial={{ opacity: 0.92, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.05 }}
                                transition={scrollRevealTransition}
                              >
                                <VerdictBanner
                                  verdict={audit.verdict}
                                  audit={audit}
                                  config={config}
                                  siteName={siteName}
                                  lat={coords.lat}
                                  lon={coords.lon}
                                  activePresetKey={activePresetKey}
                                  onSelectPreset={handleSelectPreset}
                                  dataSource={weatherData?.source ?? 'live'}
                                  apiWarning={weatherData?.apiWarning ?? null}
                                  isOceanCoordinate={weatherData?.isOceanCoordinate ?? false}
                                  isLoadingWeather={isLoadingWeather}
                                  onRetryWeather={() => loadWeatherForCoords(coords.lat, coords.lon)}
                                  isComparing={isComparing}
                                  savedBaselineName={savedComparisonSite?.siteName ?? null}
                                  onSaveForComparison={handleSaveCurrentSiteForComparison}
                                  onToggleComparison={handleToggleComparison}
                                  showMathDrawer={showMathDrawer}
                                  onToggleMathDrawer={() => setShowMathDrawer((prev) => !prev)}
                                />
                              </motion.div>

                              <motion.div
                                initial={{ opacity: 0.92, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.05 }}
                                transition={scrollRevealTransition}
                              >
                                <KpiGrid
                                  audit={audit}
                                  config={config}
                                  isComparing={isComparing}
                                  comparisonAudit={comparisonAudit}
                                  comparisonSiteName={savedComparisonSite?.siteName ?? null}
                                />
                              </motion.div>

                              <motion.div
                                id="analytics"
                                initial={{ opacity: 0.92, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.05 }}
                                transition={scrollRevealTransition}
                                className="scroll-mt-28 xl:scroll-mt-24 pt-2"
                              >
                                <div className="mb-4 pb-3 border-b border-[#D4D4CE] dark:border-[#22252A]">
                                  <div className="font-mono-tabular text-xs text-[#52565E] dark:text-[#8E94A0] tracking-wider">
                                    {t('analytics_tag')}
                                  </div>
                                  <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#111214] dark:text-[#F3F4F6] mt-1">
                                    {t('analytics_title')}
                                  </h2>
                                </div>
                                <ChartsPanel
                                  theme={theme}
                                  audit={audit}
                                  hubHeightM={config.hubHeightM}
                                  siteName={siteName}
                                  isComparing={isComparing}
                                  comparisonAudit={comparisonAudit}
                                  comparisonSiteName={savedComparisonSite?.siteName ?? null}
                                />
                              </motion.div>

                              <motion.div
                                initial={{ opacity: 0.92, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.05 }}
                                transition={scrollRevealTransition}
                              >
                                <RealityCheckPanel
                                  audit={audit}
                                  config={config}
                                  siteName={siteName}
                                  lat={coords.lat}
                                  lon={coords.lon}
                                  onConfigChange={handleConfigChange}
                                  showMathDrawer={showMathDrawer}
                                  onToggleMathDrawer={() => setShowMathDrawer((prev) => !prev)}
                                  onExportPdf={handleExportPdf}
                                />
                              </motion.div>
                            </>
                          ) : (
                            <div className="bento-card flex h-[480px] flex-col items-center justify-center p-8 text-center">
                              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0F62FE] dark:border-sky-400 border-t-transparent" />
                              <p className="mt-3 text-sm font-bold text-[#111214] dark:text-[#F3F4F6]">
                                Running 8,760-hour aerodynamic &amp; solar simulation...
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Full-Width Bento Row: Google Maps Grounding & Government Subsidies */}
                      <GroundingIntelPanel
                        siteName={siteName}
                        lat={coords.lat}
                        lon={coords.lon}
                        budgetInr={config.budgetInr}
                        solarEquivalentKw={audit?.solarEquivalentKw ?? config.budgetInr / 60000}
                      />
                    </div>
                  ) : (
                    <MethodologyTab />
                  )}
                </PageTransition>
              </main>
            </>
          )}

              {/* Architectural Attribution & Navigation Footer */}
              <footer className="mt-10 border-t border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] py-6 text-xs font-mono-tabular text-[#52565E] dark:text-[#8E94A0]">
                <div className="mx-auto max-w-[1440px] px-4 sm:px-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-[#111214] dark:text-[#F3F4F6]">
                      AEROCHECK · {t('footer_subtitle')}
                    </span>
                    <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                      <a
                        href="https://open-meteo.com/en/docs/historical-weather-api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-[#D4D4CE] dark:decoration-[#22252A] hover:text-[#0F62FE] dark:hover:text-sky-400 transition-colors"
                      >
                        Open-Meteo ERA5 Archive
                      </a>
                      <a
                        href="https://en.wikipedia.org/wiki/International_Standard_Atmosphere"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-[#D4D4CE] dark:decoration-[#22252A] hover:text-[#0F62FE] dark:hover:text-sky-400 transition-colors"
                      >
                        ISA Atmosphere
                      </a>
                      <a
                        href="https://maps.google.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-[#D4D4CE] dark:decoration-[#22252A] hover:text-[#0F62FE] dark:hover:text-sky-400 transition-colors"
                      >
                        Google Satellite
                      </a>
                    </div>
                  </div>

                  <nav aria-label="Footer navigation" className="no-print flex flex-wrap items-center gap-4 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleNavigateSection('hero')}
                      className="hover:text-[#0F62FE] dark:hover:text-sky-400 transition-colors cursor-pointer"
                    >
                      {t('nav_overview')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigateSection('auditor')}
                      className="hover:text-[#0F62FE] dark:hover:text-sky-400 transition-colors cursor-pointer"
                    >
                      {t('nav_auditor')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigateSection('analytics')}
                      className="hover:text-[#0F62FE] dark:hover:text-sky-400 transition-colors cursor-pointer"
                    >
                      {t('nav_analytics')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigateSection('methodology')}
                      className="hover:text-[#0F62FE] dark:hover:text-sky-400 transition-colors cursor-pointer"
                    >
                      {t('nav_methodology')}
                    </button>
                  </nav>
                </div>
              </footer>

              {/* Success / Error Toast Notification */}
              <AnimatePresence>
                {toast && (
                  <motion.div
                    key={toast.id}
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 16 }}
                    transition={{ duration: 0.18 }}
                    className={`no-print fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-[90] border p-3.5 shadow-2xl ${
                      toast.type === 'success'
                        ? 'border-[#059669] bg-[#F4F4F0] text-[#111214] dark:border-emerald-400 dark:bg-[#101216] dark:text-[#F3F4F6]'
                        : 'border-[#DC2626] bg-[#F4F4F0] text-[#111214] dark:border-[#EF4444] dark:bg-[#101216] dark:text-[#F3F4F6]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {toast.type === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#059669] dark:text-emerald-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#DC2626] dark:text-[#EF4444]" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-mono-tabular text-[11px] font-bold uppercase tracking-wider">
                          {toast.title}
                        </div>
                        <p className="mt-0.5 text-xs text-[#52565E] dark:text-[#9CA3AF] break-words">
                          {toast.message}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setToast(null)}
                        aria-label="Dismiss notification"
                        className="p-1 text-[#52565E] dark:text-[#8E94A0] hover:text-[#111214] dark:hover:text-[#F3F4F6] cursor-pointer shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </APIProvider>
      );
    }

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
