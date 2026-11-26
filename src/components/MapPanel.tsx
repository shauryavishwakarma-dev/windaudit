import React, { useEffect, useState, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Crosshair,
  Navigation,
  Check,
  Radar,
  Sparkles,
  Layers,
  Globe,
  Wind,
  Sun,
  X,
  ChevronRight,
  Orbit,
  Compass,
  Play,
  Pause,
  RotateCw,
  Satellite,
  Maximize2,
  ExternalLink,
  ShieldCheck,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import {
  getAccurateLivePosition,
  reverseGeocodeLocation,
  LiveLocationFix,
  GeolocationErrorState
} from '../api';
import { useLanguage } from '../i18n';

export interface LocationPresetItem {
  name: string;
  lat: number;
  lon: number;
  state: string;
  category: 'featured' | 'up' | 'metros' | 'wind' | 'coastal' | 'global';
  tag: string;
  badge?: string;
}

export const ALL_LOCATION_PRESETS: LocationPresetItem[] = [
  // --- ⭐ FEATURED / TOP BENCHMARKS ---
  { name: 'Akhari (Varanasi)', lat: 25.2432, lon: 82.9528, state: 'Uttar Pradesh', category: 'featured', tag: 'Active Rooftop', badge: 'Active Roof' },
  { name: 'Varanasi Cantt', lat: 25.3176, lon: 82.9739, state: 'Uttar Pradesh', category: 'featured', tag: 'City Center' },
  { name: 'BHU Campus', lat: 25.2677, lon: 82.9913, state: 'Uttar Pradesh', category: 'featured', tag: 'Campus Roof' },
  { name: 'Dhanushkodi Peninsula', lat: 9.179, lon: 79.418, state: 'Tamil Nadu', category: 'featured', tag: '40% CF Gale', badge: 'Viable' },
  { name: 'Muppandal Pass', lat: 8.2569, lon: 77.5467, state: 'Tamil Nadu', category: 'featured', tag: 'Asia #1 Gale', badge: 'Viable' },
  { name: 'Kanyakumari Cape', lat: 8.0883, lon: 77.5385, state: 'Tamil Nadu', category: 'featured', tag: 'Cape Gale', badge: 'Viable' },
  { name: 'Kutch Coastal Cliff', lat: 22.4707, lon: 69.0717, state: 'Gujarat', category: 'featured', tag: 'Wind Corridor', badge: 'Marginal' },
  { name: 'Leh Ladakh', lat: 34.1526, lon: 77.5771, state: 'Ladakh', category: 'featured', tag: '1000 W/m² DNI', badge: 'Top Solar' },
  { name: 'Mumbai Coast', lat: 18.9067, lon: 72.8147, state: 'Maharashtra', category: 'featured', tag: 'Marine Drive' },
  { name: 'New Delhi (NCR)', lat: 28.6139, lon: 77.2090, state: 'Delhi NCR', category: 'featured', tag: 'Urban NCR' },
  { name: 'Bengaluru Tech Park', lat: 12.9716, lon: 77.5946, state: 'Karnataka', category: 'featured', tag: 'Tech Hub' },

  // --- 🏛️ UTTAR PRADESH DISTRICTS ---
  { name: 'Akhari, Varanasi', lat: 25.2432, lon: 82.9528, state: 'Uttar Pradesh', category: 'up', tag: 'Rooftop Site', badge: 'Rooftop' },
  { name: 'Varanasi Cantt', lat: 25.3176, lon: 82.9739, state: 'Uttar Pradesh', category: 'up', tag: 'Dense Urban' },
  { name: 'BHU Campus, Varanasi', lat: 25.2677, lon: 82.9913, state: 'Uttar Pradesh', category: 'up', tag: 'Campus Roof' },
  { name: 'Lucknow (Hazratganj)', lat: 26.8467, lon: 80.9462, state: 'Uttar Pradesh', category: 'up', tag: 'State Capital' },
  { name: 'Prayagraj (Civil Lines)', lat: 25.4358, lon: 81.8463, state: 'Uttar Pradesh', category: 'up', tag: 'Sangam City' },
  { name: 'Kanpur', lat: 26.4499, lon: 80.3319, state: 'Uttar Pradesh', category: 'up', tag: 'Industrial Hub' },
  { name: 'Ayodhya', lat: 26.7922, lon: 82.1998, state: 'Uttar Pradesh', category: 'up', tag: 'Solar City' },
  { name: 'Noida (Sector 62)', lat: 28.5355, lon: 77.3910, state: 'Uttar Pradesh', category: 'up', tag: 'NCR Tech' },
  { name: 'Greater Noida', lat: 28.4744, lon: 77.5040, state: 'Uttar Pradesh', category: 'up', tag: 'Knowledge Park' },
  { name: 'Ghaziabad', lat: 28.6692, lon: 77.4538, state: 'Uttar Pradesh', category: 'up', tag: 'NCR Industrial' },
  { name: 'Agra', lat: 27.1767, lon: 78.0081, state: 'Uttar Pradesh', category: 'up', tag: 'Heritage Zone' },
  { name: 'Gorakhpur', lat: 26.7606, lon: 83.3732, state: 'Uttar Pradesh', category: 'up', tag: 'Eastern UP' },
  { name: 'Meerut', lat: 28.9845, lon: 77.7064, state: 'Uttar Pradesh', category: 'up', tag: 'Western UP' },
  { name: 'Bareilly', lat: 28.3670, lon: 79.4304, state: 'Uttar Pradesh', category: 'up', tag: 'Rohilkhand' },
  { name: 'Aligarh', lat: 27.8974, lon: 78.0880, state: 'Uttar Pradesh', category: 'up', tag: 'Lock City' },
  { name: 'Jhansi', lat: 25.4484, lon: 78.5685, state: 'Uttar Pradesh', category: 'up', tag: 'Bundelkhand' },
  { name: 'Mathura', lat: 27.4924, lon: 77.6737, state: 'Uttar Pradesh', category: 'up', tag: 'Braj Corridor' },
  { name: 'Moradabad', lat: 28.8386, lon: 78.7733, state: 'Uttar Pradesh', category: 'up', tag: 'Brass City' },
  { name: 'Mirzapur', lat: 25.1337, lon: 82.5644, state: 'Uttar Pradesh', category: 'up', tag: 'Vindhyachal' },
  { name: 'Gyanpur / Bhadohi', lat: 25.3456, lon: 82.5714, state: 'Uttar Pradesh', category: 'up', tag: 'Carpet City' },
  { name: 'Jaunpur', lat: 25.7464, lon: 82.6837, state: 'Uttar Pradesh', category: 'up', tag: 'Shahi Bridge' },

  // --- 🏢 METROS ---
  { name: 'New Delhi', lat: 28.6139, lon: 77.2090, state: 'Delhi NCR', category: 'metros', tag: 'National Capital' },
  { name: 'Mumbai (Colaba)', lat: 18.9067, lon: 72.8147, state: 'Maharashtra', category: 'metros', tag: 'Financial Capital' },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946, state: 'Karnataka', category: 'metros', tag: 'Silicon Valley' },
  { name: 'Hyderabad', lat: 17.3850, lon: 78.4867, state: 'Telangana', category: 'metros', tag: 'Cyberabad' },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707, state: 'Tamil Nadu', category: 'metros', tag: 'Auto Hub' },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639, state: 'West Bengal', category: 'metros', tag: 'City of Joy' },
  { name: 'Pune', lat: 18.5204, lon: 73.8567, state: 'Maharashtra', category: 'metros', tag: 'Suburban Trap' },
  { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714, state: 'Gujarat', category: 'metros', tag: 'Mega City' },
  { name: 'Chandigarh', lat: 30.7333, lon: 76.7794, state: 'Chandigarh', category: 'metros', tag: 'Planned City' },
  { name: 'Bhopal', lat: 23.2599, lon: 77.4126, state: 'Madhya Pradesh', category: 'metros', tag: 'Lake City' },
  { name: 'Indore', lat: 22.7196, lon: 75.8577, state: 'Madhya Pradesh', category: 'metros', tag: 'Cleanest City' },
  { name: 'Patna', lat: 25.5941, lon: 85.1376, state: 'Bihar', category: 'metros', tag: 'State Capital' },
  { name: 'Kochi', lat: 9.9312, lon: 76.2673, state: 'Kerala', category: 'metros', tag: 'Port City' },
  { name: 'Visakhapatnam', lat: 17.6868, lon: 83.2185, state: 'Andhra Pradesh', category: 'metros', tag: 'Steel City' },

  // --- 🌬️ PRIME WIND CORRIDORS ---
  { name: 'Muppandal', lat: 8.2569, lon: 77.5467, state: 'Tamil Nadu', category: 'wind', tag: 'Asia #1 Wind Gap', badge: 'Viable' },
  { name: 'Bhuj / Kutch', lat: 23.7337, lon: 69.8597, state: 'Gujarat', category: 'wind', tag: 'Coastal Corridor', badge: 'Viable' },
  { name: 'Jaisalmer Ridge', lat: 26.9157, lon: 70.9083, state: 'Rajasthan', category: 'wind', tag: 'Desert Gale', badge: 'Viable' },
  { name: 'Satara (Chalkewadi)', lat: 17.6805, lon: 73.8340, state: 'Maharashtra', category: 'wind', tag: 'Plateau Wind', badge: 'Viable' },
  { name: 'Dewas Wind Farm', lat: 22.9676, lon: 76.0534, state: 'Madhya Pradesh', category: 'wind', tag: 'Highland Ridge', badge: 'Marginal' },
  { name: 'Kayathar Wind Belt', lat: 8.9567, lon: 77.7717, state: 'Tamil Nadu', category: 'wind', tag: 'Tirunelveli Gale', badge: 'Viable' },

  // --- ☀️ SOLAR & HILLS ---
  { name: 'Leh Ladakh', lat: 34.1526, lon: 77.5771, state: 'Ladakh', category: 'coastal', tag: '1000 W/m² DNI', badge: 'Top Solar' },
  { name: 'Jodhpur (Bhadla)', lat: 26.2389, lon: 73.0243, state: 'Rajasthan', category: 'coastal', tag: 'Solar Capital', badge: 'Top Solar' },
  { name: 'Goa (Panaji)', lat: 15.4909, lon: 73.8278, state: 'Goa', category: 'coastal', tag: 'Coastal Solar' },
  { name: 'Shimla', lat: 31.1048, lon: 77.1734, state: 'Himachal Pradesh', category: 'coastal', tag: 'Himalayan Ridge' },
  { name: 'Srinagar', lat: 34.0837, lon: 74.7973, state: 'Jammu & Kashmir', category: 'coastal', tag: 'Kashmir Valley' },

  // --- 🌍 GLOBAL SITES ---
  { name: 'Dubai (Downtown)', lat: 25.2048, lon: 55.2708, state: 'UAE', category: 'global', tag: 'Desert Solar', badge: 'Global' },
  { name: 'London (Westminster)', lat: 51.5074, lon: -0.1278, state: 'United Kingdom', category: 'global', tag: 'Maritime Urban', badge: 'Global' },
  { name: 'San Francisco', lat: 37.7749, lon: -122.4194, state: 'USA', category: 'global', tag: 'Pacific Coastal', badge: 'Global' },
  { name: 'Singapore (Marina Bay)', lat: 1.3521, lon: 103.8198, state: 'Singapore', category: 'global', tag: 'Equatorial Calm', badge: 'Global' },
  { name: 'Tokyo (Shinjuku)', lat: 35.6762, lon: 139.6503, state: 'Japan', category: 'global', tag: 'Megacity', badge: 'Global' },
  { name: 'Sydney (Harbour)', lat: -33.8688, lon: 151.2093, state: 'Australia', category: 'global', tag: 'Harbour Maritime', badge: 'Global' }
];

export type SatelliteLayerId = 'google-hybrid' | 'esri-clarity' | 'street' | 'dark';

interface MapPanelProps {
  lat: number;
  lon: number;
  siteName: string;
  isLoading: boolean;
  onMapClick: (lat: number, lon: number, customName?: string) => void;
}

// Safely resolve Leaflet library instance in ESM/CJS environments
const LeafletLib: any = (L as any).default || L;

// Helper to determine cardinal heading label
function getCardinalDirection(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return 'N';
  if (normalized < 67.5) return 'NE';
  if (normalized < 112.5) return 'E';
  if (normalized < 157.5) return 'SE';
  if (normalized < 202.5) return 'S';
  if (normalized < 247.5) return 'SW';
  if (normalized < 292.5) return 'W';
  return 'NW';
}

export const MapPanel: React.FC<MapPanelProps> = ({
  lat,
  lon,
  siteName,
  isLoading,
  onMapClick
}) => {
  const { language, t } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const coordsRef = useRef<{ lat: number; lon: number }>({ lat, lon });
  coordsRef.current = { lat, lon };

  // Satellite layer toggle: Google Hybrid HD (newest) | Esri Clarity Ultra-HD | OpenStreetMap
  const [layerMode, setLayerMode] = useState<SatelliteLayerId>('google-hybrid');

  // 3D Perspective & 360° Orbit states
  const [is3DView, setIs3DView] = useState<boolean>(false); // clean crisp 2D overhead by default, 1-click 3D Orbit
  const [isOrbiting, setIsOrbiting] = useState<boolean>(false);
  const [heading, setHeading] = useState<number>(36);
  const [tilt, setTilt] = useState<number>(46); // 46° natural perspective angle

  // Live GPS Tracking states
  const [isLiveTracking, setIsLiveTracking] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsStatusMessage, setGpsStatusMessage] = useState<string | null>(null);
  const [gpsErrorState, setGpsErrorState] = useState<GeolocationErrorState | null>(null);
  const [gpsSourceLabel, setGpsSourceLabel] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // 360° Surround View Modal
  const [showSurroundModal, setShowSurroundModal] = useState<boolean>(false);

  // Location Presets modal
  const [showPresetsModal, setShowPresetsModal] = useState<boolean>(false);
  const [presetSearch, setPresetSearch] = useState<string>('');
  const [presetCategory, setPresetCategory] = useState<string>('all');

  // 1. Initialize Leaflet Map once on mount with high-resolution rooftop zoom (level 18)
  useEffect(() => {
    if (!mapContainerRef.current || typeof window === 'undefined') return;
    if (mapInstanceRef.current) return;

    const map = LeafletLib.map(mapContainerRef.current, {
      center: [lat, lon],
      zoom: 18,
      zoomControl: false, // Clean custom HUD replaces default zoom
      attributionControl: true
    });
    map.attributionControl?.setPrefix?.(false);
    mapInstanceRef.current = map;

    // Build Tile Layer based on layerMode
    const tileConfig = getTileLayerConfig(layerMode);
    tileLayerRef.current = LeafletLib.tileLayer(tileConfig.url, tileConfig.options).addTo(map);

    // Classic 3D Billboard Pin with counter-rotation support
    const customPinIcon = LeafletLib.divIcon({
      className: 'leaflet-3d-billboard-marker',
      html: `
        <div class="custom-pin-wrapper" style="position: relative; width: 26px; height: 42px; cursor: grab; transform-origin: 13px 42px;">
          <div style="position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%); width: 14px; height: 5px; background: rgba(0,0,0,0.45); border-radius: 50%; filter: blur(2px);"></div>
          <svg width="26" height="42" viewBox="0 0 25 41" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));">
            <path d="M12.5 0C5.59644 0 0 5.59644 0 12.5C0 21.875 12.5 41 12.5 41C12.5 41 25 21.875 25 12.5C25 5.59644 19.4036 0 12.5 0Z" fill="#0284C7" stroke="#FFFFFF" stroke-width="1.6"/>
            <circle cx="12.5" cy="12.5" r="4.5" fill="#FFFFFF"/>
            <circle cx="12.5" cy="12.5" r="2.2" fill="#0284C7"/>
          </svg>
        </div>
      `,
      iconSize: [26, 42],
      iconAnchor: [13, 42]
    });

    const marker = LeafletLib.marker([lat, lon], {
      draggable: true,
      icon: customPinIcon,
      title: `${siteName} (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`
    }).addTo(map);
    markerRef.current = marker;

    marker.on('dragend', (e: any) => {
      const pos = e.target.getLatLng();
      const newLat = Number(pos.lat.toFixed(5));
      const newLon = Number(pos.lng.toFixed(5));
      onMapClick(newLat, newLon);
    });

    map.on('click', (e: any) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      const newLat = Number(clickLat.toFixed(5));
      const newLon = Number(clickLng.toFixed(5));
      marker.setLatLng([newLat, newLon]);
      onMapClick(newLat, newLon);
    });

    // Invalidate size smoothly across micro-frames
    const timers = [
      setTimeout(() => map.invalidateSize(), 50),
      setTimeout(() => map.invalidateSize(), 200),
      setTimeout(() => map.invalidateSize(), 450)
    ];

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', handleResize);
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Tile layer configuration factory
  // Disables poi.business (33), poi.attraction (37), and general commercial POIs (2) across Satellite, Street, Dark, and 3D Orbit
  function getTileLayerConfig(mode: SatelliteLayerId) {
    const poiHideStyle = 's.t:2|p.v:off,s.t:33|p.v:off,s.t:37|p.v:off';
    const darkVectorStyle = [
      's.t:0|s.e:g|p.c:%2312161c',
      's.t:81|s.e:g.f|p.c:%231e2430',
      's.t:81|s.e:g.s|p.c:%23334155',
      's.t:3|s.e:g.f|p.c:%232a313c',
      's.t:3|s.e:g.s|p.c:%231a2029',
      's.t:6|s.e:g|p.c:%230b0f17',
      's.t:1|s.e:l.t.f|p.c:%2394a3b8',
      's.t:3|s.e:l.t.f|p.c:%2394a3b8',
      's.t:0|s.e:l.t.s|p.c:%230b0e13',
      poiHideStyle
    ].join(',');

    if (mode === 'google-hybrid') {
      return {
        url: `https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=en&apistyle=${poiHideStyle}`,
        options: {
          subdomains: ['0', '1', '2', '3'],
          maxNativeZoom: 20,
          maxZoom: 22,
          attribution: '&copy; Google Satellite'
        }
      };
    }
    if (mode === 'esri-clarity') {
      return {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        options: {
          maxNativeZoom: 18,
          maxZoom: 21,
          attribution: '&copy; Esri World Imagery'
        }
      };
    }
    if (mode === 'dark') {
      return {
        url: `https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=en&apistyle=${darkVectorStyle}`,
        options: {
          subdomains: ['0', '1', '2', '3'],
          maxNativeZoom: 20,
          maxZoom: 22,
          attribution: '&copy; Google Maps Dark'
        }
      };
    }
    return {
      url: `https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=en&apistyle=${poiHideStyle}`,
      options: {
        subdomains: ['0', '1', '2', '3'],
        maxNativeZoom: 20,
        maxZoom: 22,
        attribution: '&copy; Google Maps'
      }
    };
  }

  // 2. Seamlessly swap Tile Layer when provider changes without resetting center/zoom
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }
    const tileConfig = getTileLayerConfig(layerMode);
    tileLayerRef.current = LeafletLib.tileLayer(tileConfig.url, tileConfig.options).addTo(mapInstanceRef.current);
  }, [layerMode]);

  // 3. Keep Map Position and Marker in sync with external props
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    if (mapInstanceRef.current && markerRef.current) {
      const currentZoom = Math.max(16, mapInstanceRef.current.getZoom() || 18);
      mapInstanceRef.current.setView([lat, lon], currentZoom, { animate: true });
      markerRef.current.setLatLng([lat, lon]);
      resizeTimer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 50);
    }
    return () => {
      if (resizeTimer !== undefined) clearTimeout(resizeTimer);
    };
  }, [lat, lon]);

  // 4. Smooth 60fps-capped 360° Orbit Animation Loop around the pinned location
  useEffect(() => {
    if (!isOrbiting) return;
    let animId = 0;
    const TARGET_FRAME_MS = 1000 / 60;
    let lastTime = performance.now();

    const orbitStep = (now: number) => {
      animId = requestAnimationFrame(orbitStep);
      if (document.hidden) {
        lastTime = now;
        return;
      }
      const elapsed = now - lastTime;
      if (elapsed < TARGET_FRAME_MS - 2.5) return;
      lastTime = now;
      setHeading((prev) => (prev + 0.32) % 360);
    };

    animId = requestAnimationFrame(orbitStep);
    return () => cancelAnimationFrame(animId);
  }, [isOrbiting]);

  // 5. Counter-rotate Marker Pin in 3D so it always stands upright facing the viewer
  useEffect(() => {
    if (!markerRef.current) return;
    const markerEl = markerRef.current.getElement();
    if (!markerEl) return;
    const pinInner = markerEl.querySelector('.custom-pin-wrapper') as HTMLElement | null;
    if (pinInner) {
      if (is3DView) {
        pinInner.style.transform = `rotateZ(${-heading}deg) rotateX(${-tilt}deg)`;
      } else {
        pinInner.style.transform = 'none';
      }
    }
  }, [heading, is3DView, tilt]);

  // Invalidate map size and keep pinned coordinate dead-center when switching 2D/3D Orbit mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const syncCenter = () => {
      const m = mapInstanceRef.current;
      if (!m) return;
      const z = m.getZoom() || 18;
      m.invalidateSize({ pan: false });
      m.setView([coordsRef.current.lat, coordsRef.current.lon], z, { animate: false });
    };
    const raf = requestAnimationFrame(syncCenter);
    const t1 = setTimeout(syncCenter, 60);
    const t2 = setTimeout(syncCenter, 360);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [is3DView]);

  // 6. Real-Time High-Accuracy Live GPS Tracker with Multi-Tiered Fallbacks
  const toggleLiveGpsTracking = async () => {
    if (isLiveTracking) {
      // Turn off live tracking
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.remove();
        accuracyCircleRef.current = null;
      }
      setIsLiveTracking(false);
      setIsLocating(false);
      setGpsStatusMessage('Live tracking paused');
      setGpsErrorState(null);
      return;
    }

    setIsLocating(true);
    setIsLiveTracking(true);
    setGpsErrorState(null);
    setGpsStatusMessage('Acquiring real-time GPS lock...');

    try {
      const fix = await getAccurateLivePosition();
      setIsLocating(false);
      setGpsAccuracy(fix.accuracy);
      setGpsSourceLabel(fix.sourceLabel);
      setGpsStatusMessage(`🎯 ${fix.sourceLabel}`);

      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([fix.lat, fix.lon], 18, { animate: true, duration: 1.0 });

        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.remove();
        }
        const circle = LeafletLib.circle([fix.lat, fix.lon], {
          radius: Math.max(8, Math.min(1000, fix.accuracy)),
          color: '#0284c7',
          fillColor: '#38bdf8',
          fillOpacity: 0.18,
          weight: 1.5,
          className: 'radar-pulse-circle'
        }).addTo(mapInstanceRef.current);
        accuracyCircleRef.current = circle;
      }

      if (markerRef.current) {
        markerRef.current.setLatLng([fix.lat, fix.lon]);
      }

      // Reverse geocode to human-readable site address
      reverseGeocodeLocation(fix.lat, fix.lon, language).then((resolvedName) => {
        onMapClick(fix.lat, fix.lon, resolvedName || undefined);
      });

      // Continuous tracking via watchPosition with automatic fallback
      if (navigator.geolocation) {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const liveLat = Number(pos.coords.latitude.toFixed(5));
            const liveLon = Number(pos.coords.longitude.toFixed(5));
            const accM = Math.round(pos.coords.accuracy);

            setGpsAccuracy(accM);
            setGpsStatusMessage(`🎯 Live GPS Active: ±${accM}m`);

            if (markerRef.current) {
              markerRef.current.setLatLng([liveLat, liveLon]);
            }
            if (accuracyCircleRef.current) {
              accuracyCircleRef.current.setLatLng([liveLat, liveLon]);
              accuracyCircleRef.current.setRadius(Math.max(8, Math.min(1000, accM)));
            }

            if (mapInstanceRef.current) {
              const currentCenter = mapInstanceRef.current.getCenter();
              const dist = currentCenter.distanceTo([liveLat, liveLon]);
              if (dist > 20) {
                mapInstanceRef.current.panTo([liveLat, liveLon], { animate: true, duration: 0.8 });
              }
            }
            onMapClick(liveLat, liveLon);
          },
          (err) => {
            console.debug('watchPosition telemetry notice:', err.message);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000
          }
        );
        watchIdRef.current = watchId;
      }
    } catch (err: any) {
      setIsLocating(false);
      setIsLiveTracking(false);
      const errorObj: GeolocationErrorState = {
        code: err?.code || 'POSITION_UNAVAILABLE',
        message: err?.message || 'Unable to acquire live location',
        userGuidance: err?.userGuidance || 'Please select your site from presets or search above.'
      };
      setGpsErrorState(errorObj);
      setGpsStatusMessage(errorObj.message);
    }
  };

  // Zoom controls centered directly on the pinned site so 3D Orbit never drifts
  const handleZoomIn = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const nextZoom = Math.min(map.getMaxZoom() || 21, (map.getZoom() || 18) + 1);
    map.setView([coordsRef.current.lat, coordsRef.current.lon], nextZoom, { animate: true });
  };
  const handleZoomOut = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const nextZoom = Math.max(map.getMinZoom() || 3, (map.getZoom() || 18) - 1);
    map.setView([coordsRef.current.lat, coordsRef.current.lon], nextZoom, { animate: true });
  };

  // Cardinal direction snap
  const snapToHeading = (targetHeading: number) => {
    setIsOrbiting(false);
    setHeading(targetHeading);
  };

  // Preset selection handler
  const handleSelectPreset = (preset: LocationPresetItem) => {
    const fullTitle = `${preset.name}, ${preset.state}`;
    onMapClick(preset.lat, preset.lon, fullTitle);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([preset.lat, preset.lon], 18, { animate: true, duration: 1.2 });
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([preset.lat, preset.lon]);
    }
    setShowPresetsModal(false);
  };

  // Filtered list for "Browse All Locations" modal
  const modalFilteredLocations = useMemo(() => {
    const q = presetSearch.trim().toLowerCase();
    return ALL_LOCATION_PRESETS.filter((item) => {
      const matchesCat = presetCategory === 'all' || item.category === presetCategory;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.state.toLowerCase().includes(q) ||
        item.tag.toLowerCase().includes(q)
      );
    });
  }, [presetSearch, presetCategory]);

  const cardinalName = getCardinalDirection(heading);

  return (
    <div className="relative flex flex-col justify-between overflow-hidden border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/35 dark:bg-[#101216] p-5 sm:p-6">
      {/* 1. Sleek Top Header Toolbar */}
      <div>
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5 border-b border-[#D4D4CE] dark:border-[#22252A] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] text-[#0F62FE] dark:text-sky-400">
              <Satellite className="h-4 w-4" />
            </div>
            <div>
              <div className="font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0F62FE] dark:text-sky-400">
                {t('map_kicker')}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-sm font-bold tracking-tight text-[#111315] dark:text-[#F3F4F6]">
                  {t('map_title')}
                </h2>
                <span className="flex items-center gap-1 border border-[#0F62FE]/30 dark:border-sky-400/30 bg-[#0F62FE]/10 dark:bg-sky-500/10 px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-[#0F62FE] dark:text-sky-400">
                  <span className="h-1.5 w-1.5 bg-[#0F62FE] dark:bg-sky-400 animate-pulse"></span>
                  {layerMode === 'google-hybrid'
                    ? 'Google Hybrid HD'
                    : layerMode === 'esri-clarity'
                    ? 'Esri Maxar 30cm'
                    : layerMode === 'dark'
                    ? 'Dark Vector'
                    : 'Street Vector'}
                </span>
              </div>
              <p className="text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
                {t('map_subtitle')}
              </p>
            </div>
          </div>

          {/* Action Toolbar: Feeds, 3D Orbit, Live GPS */}
          <div className="no-print flex flex-wrap items-center gap-1.5 py-0.5 w-full sm:w-auto">
            {/* Satellite Imagery & Vector Provider Switcher */}
            <div className="flex items-center border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-0.5 font-mono-tabular text-[10px] font-bold shrink-0">
              <button
                type="button"
                onClick={() => setLayerMode('google-hybrid')}
                className={`flex items-center gap-1 px-2 py-1.5 sm:py-1 transition-colors cursor-pointer ${
                  layerMode === 'google-hybrid'
                    ? 'bg-[#0F62FE] text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950'
                    : 'text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111315] dark:hover:text-white'
                }`}
                title="Latest Google Satellite Hybrid without commercial POI clutter"
              >
                <span>Satellite</span>
              </button>
              <button
                type="button"
                onClick={() => setLayerMode('esri-clarity')}
                className={`flex items-center gap-1 px-2 py-1.5 sm:py-1 transition-colors cursor-pointer ${
                  layerMode === 'esri-clarity'
                    ? 'bg-[#0F62FE] text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950'
                    : 'text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111315] dark:hover:text-white'
                }`}
                title="Esri World Imagery 30cm Maxar optical satellite"
              >
                <span>Esri</span>
              </button>
              <button
                type="button"
                onClick={() => setLayerMode('street')}
                className={`flex items-center gap-1 px-2 py-1.5 sm:py-1 transition-colors cursor-pointer ${
                  layerMode === 'street'
                    ? 'bg-[#0F62FE] text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950'
                    : 'text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111315] dark:hover:text-white'
                }`}
                title="Clean building footprint & street map (POIs hidden)"
              >
                <span>Street</span>
              </button>
              <button
                type="button"
                onClick={() => setLayerMode('dark')}
                className={`flex items-center gap-1 px-2 py-1.5 sm:py-1 transition-colors cursor-pointer ${
                  layerMode === 'dark'
                    ? 'bg-[#0F62FE] text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950'
                    : 'text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111315] dark:hover:text-white'
                }`}
                title="High-contrast dark vector theme with building footprints (POIs hidden)"
              >
                <span>Dark</span>
              </button>
            </div>

            {/* 3D Orbit Toggle */}
            <button
              type="button"
              onClick={() => {
                if (!is3DView) {
                  setIs3DView(true);
                  setIsOrbiting(true);
                } else {
                  setIs3DView(false);
                  setIsOrbiting(false);
                }
              }}
              className={`flex items-center gap-1 border px-2.5 py-1.5 font-mono-tabular text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 ${
                is3DView
                  ? 'border-[#0F62FE] bg-[#0F62FE] text-white dark:border-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950'
                  : 'border-[#D4D4CE] dark:border-[#2E333C] bg-[#F4F4F0] dark:bg-[#0A0B0D] text-[#111315] dark:text-[#F3F4F6] hover:border-[#0F62FE] dark:hover:border-sky-400'
              }`}
              title="Toggle 3D Perspective and 360° Site Orbit"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>{is3DView ? t('map_orbit_stop') : t('map_orbit_start')}</span>
            </button>

            {/* Live GPS Button */}
            <button
              type="button"
              onClick={toggleLiveGpsTracking}
              disabled={isLocating}
              className={`flex items-center gap-1.5 border px-2.5 py-1.5 font-mono-tabular text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 ${
                isLiveTracking
                  ? 'border-[#059669] bg-[#059669] text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950'
                  : isLocating
                  ? 'border-[#0F62FE] bg-[#0F62FE]/15 text-[#0F62FE] dark:border-sky-400 dark:bg-sky-500/15 dark:text-sky-400 animate-pulse'
                  : 'border-[#D4D4CE] dark:border-[#2E333C] bg-[#F4F4F0] dark:bg-[#0A0B0D] text-[#0F62FE] dark:text-sky-400 hover:border-[#0F62FE] dark:hover:border-sky-400'
              }`}
              title="Acquire and track your real-time exact rooftop position using high-precision GPS"
            >
              {isLocating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Crosshair className="h-3.5 w-3.5" />
              )}
              <span>{isLocating ? t('map_locating') : isLiveTracking ? t('map_gps_live') : t('map_locate')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Map Viewport Stage (Zero Black Gaps in 3D Mode) */}
      <div
        className="relative w-full h-[320px] sm:h-[420px] overflow-hidden border border-[#D4D4CE] dark:border-[#22252A] bg-[#12161c] group"
        style={{
          perspective: '1200px'
        }}
      >
        {/* Transform Stage Wrapper: expands to 230% + scale(1.12) in 3D Orbit so tiles cover edge-to-edge without corner gaps */}
        <div
          className="absolute will-change-transform"
          style={{
            width: is3DView ? '230%' : '100%',
            height: is3DView ? '230%' : '100%',
            left: is3DView ? '-65%' : '0%',
            top: is3DView ? '-65%' : '0%',
            transform: is3DView
              ? `rotateX(${tilt}deg) rotateZ(${heading}deg) scale(1.12)`
              : 'none',
            transformOrigin: '50% 50%',
            transition: isOrbiting ? 'none' : 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div
            ref={mapContainerRef}
            className="w-full h-full leaflet-3d-stage"
            style={{ height: '100%', width: '100%' }}
          />
        </div>

        {/* Floating Site HUD Pill (Top-Left) */}
        <div className="pointer-events-none absolute top-3 left-3 z-[1000] max-w-[56%] border border-[#D4D4CE] dark:border-[#2E333C] bg-[#F4F4F0]/95 dark:bg-[#0A0B0D]/92 px-3 py-2 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping bg-[#0F62FE] dark:bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 bg-[#0F62FE] dark:bg-sky-400"></span>
            </span>
            <span className="truncate text-xs font-bold text-[#111315] dark:text-[#F3F4F6]">{siteName}</span>
          </div>
          <div className="font-mono-tabular mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-[#0F62FE] dark:text-sky-400">
            <span>PINNED: {lat.toFixed(4)}°N, {lon.toFixed(4)}°E</span>
            {isLiveTracking && gpsAccuracy !== null && (
              <span className="border border-[#059669]/40 bg-[#059669]/15 px-1.5 py-0.2 text-[9px] font-bold text-[#059669] dark:text-[#34D399]">
                GPS ±{gpsAccuracy}m
              </span>
            )}
          </div>
        </div>

        {/* Floating Live GPS Status & Recenter Banner */}
        {isLocating && (
          <div className="absolute top-[4.5rem] left-3 z-[1000] flex items-center gap-2 border border-[#0F62FE]/40 dark:border-sky-400/40 bg-[#F4F4F0]/95 dark:bg-[#101216]/95 px-3 py-1.5 font-mono-tabular text-xs font-semibold text-[#0F62FE] dark:text-sky-400 shadow-lg backdrop-blur-md animate-pulse">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            <span className="truncate max-w-[240px] sm:max-w-xs">{gpsStatusMessage || 'Acquiring satellite & Wi-Fi GPS fix...'}</span>
          </div>
        )}

        {isLiveTracking && !isLocating && (
          <div className="absolute top-[4.5rem] left-3 z-[1000] flex items-center gap-2 border border-[#059669]/50 dark:border-emerald-400/50 bg-[#F4F4F0]/95 dark:bg-[#101216]/95 px-3 py-1.5 font-mono-tabular text-xs font-semibold text-[#059669] dark:text-emerald-400 shadow-lg backdrop-blur-md">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping bg-[#059669] dark:bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 bg-[#059669] dark:bg-emerald-400"></span>
            </span>
            <span className="truncate max-w-[200px] sm:max-w-xs text-[#111214] dark:text-[#F3F4F6]">{gpsStatusMessage || `Live GPS Locked (±${gpsAccuracy}m)`}</span>
            <button
              type="button"
              onClick={() => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.flyTo([lat, lon], 18, { animate: true, duration: 0.8 });
                }
              }}
              className="ml-1 text-[11px] underline font-bold text-[#0F62FE] dark:text-sky-400 hover:opacity-80 cursor-pointer pointer-events-auto shrink-0"
              title="Center map on your location"
            >
              Recenter
            </button>
            <button
              type="button"
              onClick={toggleLiveGpsTracking}
              className="text-[11px] text-[#52565E] dark:text-[#9CA3AF] hover:text-[#111214] dark:hover:text-[#F3F4F6] cursor-pointer pointer-events-auto ml-1 font-bold shrink-0"
              title="Pause live GPS"
            >
              ✕
            </button>
          </div>
        )}

        {gpsErrorState && (
          <div className="absolute top-[4.5rem] left-3 right-3 sm:right-auto sm:max-w-md z-[1000] border border-[#DC2626]/40 dark:border-[#EF4444]/40 bg-[#F4F4F0]/95 dark:bg-[#101216]/95 p-3 text-xs text-[#DC2626] dark:text-[#EF4444] shadow-xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-[#DC2626] dark:text-[#EF4444] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#DC2626] dark:text-[#EF4444]">{gpsErrorState.message}</p>
                  <p className="text-[11px] text-[#52565E] dark:text-[#9CA3AF] mt-0.5 leading-relaxed">{gpsErrorState.userGuidance}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGpsErrorState(null)}
                className="text-[#52565E] dark:text-[#9CA3AF] hover:text-[#DC2626] dark:hover:text-[#EF4444] p-0.5 cursor-pointer"
                title="Dismiss warning"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleLiveGpsTracking}
                className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6] dark:bg-[#161A20] px-3 py-1 font-mono-tabular text-[11px] font-bold text-[#111214] dark:text-[#F3F4F6] hover:border-[#0F62FE] dark:hover:border-sky-400 transition-colors cursor-pointer"
              >
                ↺ Retry GPS
              </button>
              <button
                type="button"
                onClick={() => {
                  setGpsErrorState(null);
                  setShowPresetsModal(true);
                }}
                className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] px-2.5 py-1 font-mono-tabular text-[11px] font-semibold text-[#111214] dark:text-[#F3F4F6] hover:border-[#0F62FE] dark:hover:border-sky-400 transition-colors cursor-pointer"
              >
                Pick from Presets
              </button>
            </div>
          </div>
        )}

        {/* 360° Surround View Button (Clear of native zoom controls and bottom attribution bar) */}
        <div className="absolute bottom-8 left-3.5 z-[1000]">
          <button
            type="button"
            onClick={() => setShowSurroundModal(true)}
            className="flex items-center gap-1.5 border border-[#D4D4CE] dark:border-[#2E333C] bg-[#F4F4F0]/95 dark:bg-[#0A0B0D]/92 px-3 py-1.5 font-mono-tabular text-[11px] font-bold text-[#0F62FE] dark:text-sky-400 shadow-md backdrop-blur-md hover:border-[#0F62FE] dark:hover:border-sky-400 transition-all cursor-pointer"
            title="Open Google Maps 3D & Street View 360° surround preview"
          >
            <Maximize2 className="h-3.5 w-3.5 text-[#0F62FE] dark:text-sky-400" />
            <span>{t('map_surround')}</span>
          </button>
        </div>

        {/* Stacked Compass & Zoom Controls (Bottom-Right inside map, lifted clear of attribution text) */}
        <div className="absolute bottom-8 right-3.5 z-[1000] flex flex-col items-end gap-1.5">
          {is3DView && (
            <div className="flex items-center gap-1.5 border border-[#D4D4CE] dark:border-[#2E333C] bg-[#F4F4F0]/95 dark:bg-[#0A0B0D]/92 px-2.5 py-1 text-[11px] font-bold text-[#111315] dark:text-[#F3F4F6] shadow-xl backdrop-blur-md">
              <button
                type="button"
                onClick={() => snapToHeading(0)}
                className="flex items-center gap-1 text-[#0F62FE] dark:text-sky-400 hover:opacity-80 transition-opacity cursor-pointer"
                title="Click to align North (0°)"
              >
                <Compass className="h-3.5 w-3.5" />
                <span className="font-mono-tabular">{Math.round(heading)}° {cardinalName}</span>
              </button>
              <span className="text-[#52565E] dark:text-[#6B7280]">|</span>
              <button
                type="button"
                onClick={() => setTilt((prev) => (prev === 46 ? 58 : prev === 58 ? 32 : 46))}
                className="text-[#111315] dark:text-[#D1D5DB] hover:text-[#0F62FE] dark:hover:text-sky-400 transition-colors cursor-pointer text-[10px]"
                title="Adjust tilt angle"
              >
                {tilt}°
              </button>
            </div>
          )}

          <div className="flex items-center border border-[#D4D4CE] dark:border-[#2E333C] bg-[#F4F4F0]/95 dark:bg-[#0A0B0D]/92 p-0.5 shadow-md backdrop-blur-md">
            <button
              type="button"
              onClick={handleZoomIn}
              className="flex h-7 w-7 items-center justify-center font-mono-tabular font-bold text-[#111315] dark:text-[#F3F4F6] hover:bg-[#0F62FE] hover:text-white dark:hover:bg-sky-500 dark:hover:text-slate-950 transition-colors cursor-pointer"
              title="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="flex h-7 w-7 items-center justify-center font-mono-tabular font-bold text-[#111315] dark:text-[#F3F4F6] hover:bg-[#0F62FE] hover:text-white dark:hover:bg-sky-500 dark:hover:text-slate-950 transition-colors cursor-pointer"
              title="Zoom out"
            >
              &minus;
            </button>
          </div>
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-[1001] flex flex-col items-center justify-center bg-[#0A0B0D]/50 backdrop-blur-sm">
            <div className="flex h-12 w-12 items-center justify-center bg-[#F4F4F0] dark:bg-[#0A0B0D] border border-[#0F62FE]/40 dark:border-sky-400/40 shadow-xl">
              <Radar className="h-6 w-6 animate-spin text-[#0F62FE] dark:text-sky-400" />
            </div>
            <p className="mt-2.5 text-xs font-extrabold text-white drop-shadow-md">
              Updating high-res atmospheric &amp; solar data...
            </p>
          </div>
        )}
      </div>

      {/* 3. Streamlined Quick Benchmark Rooftops */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#D4D4CE] dark:border-[#22252A] pt-2.5">
        <div className="flex min-w-0 flex-wrap sm:flex-nowrap items-center gap-1.5 text-[11px] overflow-hidden">
          <span className="mr-0.5 font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-[#52565E] dark:text-[#8E94A0] shrink-0">
            Quick Sites:
          </span>
          {ALL_LOCATION_PRESETS.slice(0, 2).map((preset) => (
            <button
              key={`${preset.name}-${preset.lat}`}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className="flex shrink-0 items-center gap-1 border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] px-2 py-1 text-[10px] font-medium text-[#111315] dark:text-[#F3F4F6] hover:border-[#0F62FE] dark:hover:border-sky-400 transition-colors cursor-pointer"
            >
              <span className="font-bold truncate max-w-[100px]">{preset.name}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowPresetsModal(true)}
          className="flex shrink-0 items-center gap-1.5 border border-[#0F62FE] bg-[#0F62FE] hover:bg-[#0050E6] dark:border-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 px-2.5 py-1 font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-white dark:text-slate-950 transition-colors cursor-pointer"
        >
          <Globe className="h-3 w-3" />
          <span>{t('map_all_sites')} ({ALL_LOCATION_PRESETS.length})</span>
        </button>
      </div>

      {/* 4. 360° Surround & Google Earth 3D Modal */}
      {showSurroundModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-[#0A0B0D]/75 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[85vh] w-full max-w-xl flex-col border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#101216] p-5 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#D4D4CE] dark:border-[#22252A] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6] dark:bg-[#0A0B0D] text-[#0F62FE] dark:text-sky-400">
                  <Maximize2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-[#111214] dark:text-[#F3F4F6]">
                    360° Surround &amp; 3D Site Perspective
                  </h3>
                  <p className="text-[11px] font-mono-tabular text-[#52565E] dark:text-[#9CA3AF]">
                    {siteName} · {lat.toFixed(4)}°N, {lon.toFixed(4)}°E
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSurroundModal(false)}
                className="flex h-7 w-7 items-center justify-center border border-[#D4D4CE] dark:border-[#22252A] text-[#52565E] dark:text-[#9CA3AF] hover:border-[#0F62FE] dark:hover:border-sky-400 hover:text-[#0F62FE] dark:hover:text-sky-400 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="mt-4 space-y-3">
              <div className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/45 dark:bg-[#0A0B0D] p-4 text-xs">
                <h4 className="font-mono-tabular font-bold text-[11px] uppercase tracking-wider text-[#111214] dark:text-[#F3F4F6] flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#0F62FE] dark:text-sky-400" />
                  <span>3D Aerial &amp; Ground Surround View Options</span>
                </h4>
                <p className="mt-1.5 text-[#52565E] dark:text-[#9CA3AF] leading-relaxed">
                  Explore full 3D photorealistic buildings, terrain elevation, surrounding tree canopies, and rooftop parapet wake obstacles for this pinned site.
                </p>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Google Maps 3D View */}
                  <a
                    href={`https://www.google.com/maps/@${lat},${lon},220m/data=!3m1!1e3`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#101216] p-3 hover:border-[#0F62FE] dark:hover:border-sky-400 transition-colors group"
                  >
                    <div>
                      <div className="font-semibold text-[#111214] dark:text-[#F3F4F6] group-hover:text-[#0F62FE] dark:group-hover:text-sky-400 transition-colors">
                        Google Maps 3D View
                      </div>
                      <div className="text-[10px] text-[#52565E] dark:text-[#9CA3AF]">
                        Photorealistic 3D Tilt &amp; Orbit
                      </div>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-[#0F62FE] dark:text-sky-400 shrink-0" />
                  </a>

                  {/* Google Earth 3D Web */}
                  <a
                    href={`https://earth.google.com/web/@${lat},${lon},150a,800d,35y,0h,60t,0r`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#101216] p-3 hover:border-[#0F62FE] dark:hover:border-sky-400 transition-colors group"
                  >
                    <div>
                      <div className="font-semibold text-[#111214] dark:text-[#F3F4F6] group-hover:text-[#0F62FE] dark:group-hover:text-sky-400 transition-colors">
                        Google Earth 3D Web
                      </div>
                      <div className="text-[10px] text-[#52565E] dark:text-[#9CA3AF]">
                        Atmospheric 3D Elevation &amp; Terrain
                      </div>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-[#0F62FE] dark:text-sky-400 shrink-0" />
                  </a>

                  {/* Google Street View 360° */}
                  <a
                    href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#101216] p-3 hover:border-[#0F62FE] dark:hover:border-sky-400 transition-colors group sm:col-span-2"
                  >
                    <div>
                      <div className="font-semibold text-[#111214] dark:text-[#F3F4F6] group-hover:text-[#0F62FE] dark:group-hover:text-sky-400 transition-colors">
                        Google Street View 360° Panorama
                      </div>
                      <div className="text-[10px] text-[#52565E] dark:text-[#9CA3AF]">
                        Ground-level 360-degree street panorama around this parcel
                      </div>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-[#0F62FE] dark:text-sky-400 shrink-0" />
                  </a>
                </div>
              </div>

              {/* In-App 3D Orbit Quick Preset */}
              <div className="flex items-center justify-between border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/45 dark:bg-[#0A0B0D] p-3 text-xs">
                <div>
                  <div className="font-mono-tabular font-bold text-[11px] uppercase tracking-wider text-[#111214] dark:text-[#F3F4F6]">In-App 360° Continuous Orbit</div>
                  <div className="text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
                    Smoothly circles the rooftop camera at 60fps on this canvas
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIs3DView(true);
                    setIsOrbiting(true);
                    setShowSurroundModal(false);
                  }}
                  className="border border-[#0F62FE] bg-[#0F62FE] hover:bg-[#0050E6] dark:border-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 px-3.5 py-2 font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-white dark:text-slate-950 transition-colors whitespace-nowrap cursor-pointer ml-3"
                >
                  Start Orbit
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-4 flex justify-end border-t border-[#D4D4CE] dark:border-[#22252A] pt-3">
              <button
                type="button"
                onClick={() => setShowSurroundModal(false)}
                className="border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6] dark:bg-[#161A20] px-4 py-1.5 font-mono-tabular text-xs font-bold text-[#111214] dark:text-[#F3F4F6] hover:border-[#0F62FE] dark:hover:border-sky-400 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. "Browse All Locations" Modal Directory (83 Sites) */}
      {showPresetsModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-[#0A0B0D]/75 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#101216] p-5 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#D4D4CE] dark:border-[#22252A] pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6] dark:bg-[#0A0B0D] text-[#0F62FE] dark:text-sky-400">
                  <Globe className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-[#111214] dark:text-[#F3F4F6]">
                    Benchmark Sites Directory ({ALL_LOCATION_PRESETS.length} Sites)
                  </h3>
                  <p className="text-[11px] font-mono-tabular text-[#52565E] dark:text-[#9CA3AF]">
                    Click any site to begin high-resolution satellite audit
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPresetsModal(false)}
                className="flex h-7 w-7 items-center justify-center border border-[#D4D4CE] dark:border-[#22252A] text-[#52565E] dark:text-[#9CA3AF] hover:border-[#0F62FE] dark:hover:border-sky-400 hover:text-[#0F62FE] dark:hover:text-sky-400 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Modal Search & Filter */}
            <div className="mt-3 space-y-2">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder="Filter by city, state, or tag..."
                  className="w-full border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] py-2 pl-3.5 pr-14 font-mono-tabular text-xs text-[#111214] dark:text-[#F3F4F6] placeholder-[#52565E] dark:placeholder-[#6B7280] focus:outline-none focus:border-[#0F62FE] dark:focus:border-sky-400"
                  autoFocus
                />
                {presetSearch && (
                  <button
                    type="button"
                    onClick={() => setPresetSearch('')}
                    className="absolute right-2.5 font-mono-tabular text-[10px] text-[#52565E] dark:text-[#9CA3AF] hover:text-[#0F62FE] dark:hover:text-sky-400 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1 font-mono-tabular text-[10px]">
                {['all', 'featured', 'up', 'metros', 'wind', 'coastal', 'global'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setPresetCategory(cat)}
                    className={`px-2.5 py-1 font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                      presetCategory === cat
                        ? 'bg-[#0F62FE] text-white dark:bg-sky-500 dark:text-slate-950'
                        : 'border border-[#D4D4CE] dark:border-[#22252A] text-[#52565E] dark:text-[#9CA3AF] hover:border-[#0F62FE] dark:hover:border-sky-400'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Scrollable Grid */}
            <div className="mt-3 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {modalFilteredLocations.map((preset, idx) => (
                  <button
                    key={`modal-${preset.name}-${preset.lat}-${preset.lon}-${idx}`}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className="flex items-center justify-between border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-2.5 text-left hover:border-[#0F62FE] dark:hover:border-sky-400 transition-colors group cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-bold text-[#111214] dark:text-[#F3F4F6] group-hover:text-[#0F62FE] dark:group-hover:text-sky-400 transition-colors">
                          {preset.name}
                        </span>
                        {preset.badge && (
                          <span className="border border-[#0F62FE]/30 dark:border-sky-400/30 bg-[#0F62FE]/10 dark:bg-sky-500/10 px-1 font-mono-tabular text-[9px] font-bold text-[#0F62FE] dark:text-sky-400 shrink-0">
                            {preset.badge}
                          </span>
                        )}
                      </div>
                      <div className="truncate font-mono-tabular text-[10px] text-[#52565E] dark:text-[#9CA3AF]">
                        {preset.state} · {preset.lat.toFixed(2)}°N, {preset.lon.toFixed(2)}°E
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-[#52565E] dark:text-[#9CA3AF] group-hover:text-[#0F62FE] dark:group-hover:text-sky-400 shrink-0 ml-2 transition-colors" />
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-3 flex items-center justify-between border-t border-[#D4D4CE] dark:border-[#22252A] pt-2.5 font-mono-tabular text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
              <span>{modalFilteredLocations.length} location{modalFilteredLocations.length !== 1 ? 's' : ''} shown</span>
              <button
                type="button"
                onClick={() => setShowPresetsModal(false)}
                className="border border-[#D4D4CE] dark:border-[#22252A] px-3 py-1 font-bold text-[#111214] dark:text-[#F3F4F6] hover:border-[#0F62FE] dark:hover:border-sky-400 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
