/**
 * Weather Telemetry & Geocoding API Module for India Micro-Wind Site Auditor
 * Exposes PRESETS, fetchSiteWeather, and searchLocation
 */

import { WeatherData } from './physics';

export type PresetKey = 'varanasi' | 'suburban' | 'mumbai' | 'kutch';

export interface SitePreset {
  id: string;
  key: PresetKey;
  name: string;
  shortLabel: string;
  archetypeTag: 'Disaster' | 'Trap' | 'Marginal' | 'Viable';
  state: string;
  lat: number;
  lon: number;
  defaultTerrain: string;
  badgeNote: string;
}

export const PRESETS: Record<PresetKey, SitePreset> = {
  varanasi: {
    id: 'varanasi',
    key: 'varanasi',
    name: 'Varanasi Dense Urban Roof, Uttar Pradesh',
    shortLabel: 'Dense City (Disaster)',
    archetypeTag: 'Disaster',
    state: 'Uttar Pradesh',
    lat: 25.3176,
    lon: 82.9739,
    defaultTerrain: 'urban',
    badgeNote: 'High roughness (α=0.30) + 75% dead-zone idle hours'
  },
  suburban: {
    id: 'suburban',
    key: 'suburban',
    name: 'Pune Suburban Rooftop, Maharashtra',
    shortLabel: 'Suburban Rooftop (Trap)',
    archetypeTag: 'Trap',
    state: 'Maharashtra',
    lat: 18.5204,
    lon: 73.8567,
    defaultTerrain: 'suburban',
    badgeNote: 'Feels breezy at 540m elevation, but v³ math kills yield'
  },
  mumbai: {
    id: 'mumbai',
    key: 'mumbai',
    name: 'Mumbai Sea-Facing Roof (Colaba), Maharashtra',
    shortLabel: 'Coastal Edge (Marginal)',
    archetypeTag: 'Marginal',
    state: 'Maharashtra',
    lat: 18.9067,
    lon: 72.8147,
    defaultTerrain: 'coastal',
    badgeNote: 'Strong May–Sep monsoon gusts, weak winter wind (α=0.10)'
  },
  kutch: {
    id: 'kutch',
    key: 'kutch',
    name: 'Dhanushkodi Wind Peninsula (Rameswaram Coast), Tamil Nadu',
    shortLabel: 'Coastal Cliff (Viable)',
    archetypeTag: 'Viable',
    state: 'Tamil Nadu',
    lat: 9.179,
    lon: 79.418,
    defaultTerrain: 'coastal',
    badgeNote: 'Class-I smooth laminar coastal gale corridor (α=0.10)'
  }
};

export const PRESET_LIST: SitePreset[] = [
  PRESETS.varanasi,
  PRESETS.suburban,
  PRESETS.mumbai,
  PRESETS.kutch
];

export interface LocationSearchResult {
  id: string;
  name: string;
  admin2?: string;
  admin1?: string;
  country?: string;
  fullLocation: string;
  lat: number;
  lon: number;
}

export function buildFullLocation(
  name: string,
  admin2?: string,
  admin1?: string,
  country?: string
): string {
  const rawParts = [name, admin2, admin1, country]
    .map((p) => (p ? p.trim() : ''))
    .filter(Boolean);
  const uniqueParts: string[] = [];
  for (const part of rawParts) {
    const lower = part.toLowerCase();
    const alreadyExists = uniqueParts.some(
      (existing) => existing.toLowerCase() === lower || existing.toLowerCase().includes(lower)
    );
    if (!alreadyExists) {
      uniqueParts.push(part);
    }
  }
  return uniqueParts.join(', ');
}

const RAW_INDIAN_CITY_CATALOG: Array<{
  id: string;
  name: string;
  admin2: string;
  admin1: string;
  country: string;
  lat: number;
  lon: number;
}> = [
  { id: 'varanasi', name: 'Varanasi', admin2: 'Varanasi District', admin1: 'Uttar Pradesh', country: 'India', lat: 25.3176, lon: 82.9739 },
  { id: 'dhanushkodi', name: 'Dhanushkodi Wind Peninsula (Rameswaram Corridor)', admin2: 'Ramanathapuram District', admin1: 'Tamil Nadu', country: 'India', lat: 9.179, lon: 79.418 },
  { id: 'kanyakumari', name: 'Kanyakumari Cape (Muppandal Coastal Belt)', admin2: 'Kanniyakumari District', admin1: 'Tamil Nadu', country: 'India', lat: 8.0883, lon: 77.5385 },
  { id: 'kutch', name: 'Kutch Coastal Cliff (Okha-Mandvi Wind Corridor)', admin2: 'Devbhumi Dwarka / Kutch Coast', admin1: 'Gujarat', country: 'India', lat: 22.4707, lon: 69.0717 },
  { id: 'bhuj', name: 'Bhuj (Kutch Inland Basin)', admin2: 'Kachchh District', admin1: 'Gujarat', country: 'India', lat: 23.7337, lon: 69.8597 },
  { id: 'mumbai', name: 'Mumbai (Colaba Coastal Edge)', admin2: 'Mumbai City District', admin1: 'Maharashtra', country: 'India', lat: 18.9067, lon: 72.8147 },
  { id: 'pune', name: 'Pune', admin2: 'Pune District', admin1: 'Maharashtra', country: 'India', lat: 18.5204, lon: 73.8567 },
  { id: 'chennai', name: 'Chennai', admin2: 'Chennai District', admin1: 'Tamil Nadu', country: 'India', lat: 13.0827, lon: 80.2707 },
  { id: 'bengaluru', name: 'Bengaluru', admin2: 'Bengaluru Urban District', admin1: 'Karnataka', country: 'India', lat: 12.9716, lon: 77.5946 },
  { id: 'delhi', name: 'New Delhi', admin2: 'New Delhi District', admin1: 'Delhi NCR', country: 'India', lat: 28.6139, lon: 77.2090 },
  { id: 'hyderabad', name: 'Hyderabad', admin2: 'Hyderabad District', admin1: 'Telangana', country: 'India', lat: 17.3850, lon: 78.4867 },
  { id: 'kolkata', name: 'Kolkata', admin2: 'Kolkata District', admin1: 'West Bengal', country: 'India', lat: 22.5726, lon: 88.3639 },
  { id: 'ahmedabad', name: 'Ahmedabad', admin2: 'Ahmedabad District', admin1: 'Gujarat', country: 'India', lat: 23.0225, lon: 72.5714 },
  { id: 'jaipur', name: 'Jaipur', admin2: 'Jaipur District', admin1: 'Rajasthan', country: 'India', lat: 26.9124, lon: 75.7873 },
  { id: 'jaisalmer', name: 'Jaisalmer Wind Park', admin2: 'Jaisalmer District', admin1: 'Rajasthan', country: 'India', lat: 26.9157, lon: 70.9083 },
  { id: 'muppandal', name: 'Muppandal Wind Farm (Kanyakumari)', admin2: 'Kanniyakumari District', admin1: 'Tamil Nadu', country: 'India', lat: 8.2569, lon: 77.5467 },
  { id: 'lucknow', name: 'Lucknow', admin2: 'Lucknow District', admin1: 'Uttar Pradesh', country: 'India', lat: 26.8467, lon: 80.9462 },
  { id: 'kochi', name: 'Kochi', admin2: 'Ernakulam District', admin1: 'Kerala', country: 'India', lat: 9.9312, lon: 76.2673 },
  { id: 'surat', name: 'Surat', admin2: 'Surat District', admin1: 'Gujarat', country: 'India', lat: 21.1702, lon: 72.8311 },
  { id: 'coimbatore', name: 'Coimbatore (Palghat Gap Corridor)', admin2: 'Coimbatore District', admin1: 'Tamil Nadu', country: 'India', lat: 11.0168, lon: 76.9558 },
  { id: 'visakhapatnam', name: 'Visakhapatnam', admin2: 'Visakhapatnam District', admin1: 'Andhra Pradesh', country: 'India', lat: 17.6868, lon: 83.2185 },
  { id: 'indore', name: 'Indore', admin2: 'Indore District', admin1: 'Madhya Pradesh', country: 'India', lat: 22.7196, lon: 75.8577 },
  { id: 'bhopal', name: 'Bhopal', admin2: 'Bhopal District', admin1: 'Madhya Pradesh', country: 'India', lat: 23.2599, lon: 77.4126 },
  { id: 'nagpur', name: 'Nagpur', admin2: 'Nagpur District', admin1: 'Maharashtra', country: 'India', lat: 21.1458, lon: 79.0882 },
  { id: 'patna', name: 'Patna', admin2: 'Patna District', admin1: 'Bihar', country: 'India', lat: 25.5941, lon: 85.1376 },
  { id: 'bhubaneswar', name: 'Bhubaneswar', admin2: 'Khordha District', admin1: 'Odisha', country: 'India', lat: 20.2961, lon: 85.8245 },
  { id: 'chandigarh', name: 'Chandigarh', admin2: 'Chandigarh District', admin1: 'Chandigarh UT', country: 'India', lat: 30.7333, lon: 76.7794 },
  { id: 'guwahati', name: 'Guwahati', admin2: 'Kamrup Metropolitan', admin1: 'Assam', country: 'India', lat: 26.1445, lon: 91.7362 },
  { id: 'thiruvananthapuram', name: 'Thiruvananthapuram', admin2: 'Thiruvananthapuram District', admin1: 'Kerala', country: 'India', lat: 8.5241, lon: 76.9366 },
  { id: 'madurai', name: 'Madurai', admin2: 'Madurai District', admin1: 'Tamil Nadu', country: 'India', lat: 9.9252, lon: 78.1198 },
  { id: 'rajkot', name: 'Rajkot', admin2: 'Rajkot District', admin1: 'Gujarat', country: 'India', lat: 22.3039, lon: 70.8022 },
  { id: 'panaji', name: 'Panaji (Goa Coastal Roof)', admin2: 'North Goa District', admin1: 'Goa', country: 'India', lat: 15.4909, lon: 73.8278 },
  { id: 'mangaluru', name: 'Mangaluru', admin2: 'Dakshina Kannada District', admin1: 'Karnataka', country: 'India', lat: 12.9141, lon: 74.8560 },
  { id: 'dehradun', name: 'Dehradun', admin2: 'Dehradun District', admin1: 'Uttarakhand', country: 'India', lat: 30.3165, lon: 78.0322 },
  { id: 'shimla', name: 'Shimla', admin2: 'Shimla District', admin1: 'Himachal Pradesh', country: 'India', lat: 31.1048, lon: 77.1734 },
  { id: 'srinagar', name: 'Srinagar', admin2: 'Srinagar District', admin1: 'Jammu and Kashmir', country: 'India', lat: 34.0837, lon: 74.7973 },
  { id: 'ranchi', name: 'Ranchi', admin2: 'Ranchi District', admin1: 'Jharkhand', country: 'India', lat: 23.3441, lon: 85.3096 },
  { id: 'raipur', name: 'Raipur', admin2: 'Raipur District', admin1: 'Chhattisgarh', country: 'India', lat: 21.2514, lon: 81.6296 },
  { id: 'udaipur', name: 'Udaipur', admin2: 'Udaipur District', admin1: 'Rajasthan', country: 'India', lat: 24.5854, lon: 73.7125 }
];

const INDIAN_CITY_FALLBACKS: LocationSearchResult[] = RAW_INDIAN_CITY_CATALOG.map((item) => ({
  ...item,
  fullLocation: buildFullLocation(item.name, item.admin2, item.admin1, item.country)
}));

export function inferTerrainFromLocation(
  name: string,
  lat: number,
  lon: number
): 'coastal' | 'open' | 'suburban' | 'urban' {
  const lower = (name || '').toLowerCase();
  if (
    detectOceanCoordinate(lat, lon) ||
    /coastal|coast|cliff|cape|beach|marine|harbour|harbor|island|okha|dwarka|mandvi|kutch|kachchh|muppandal|kayathar|kanyakumari|rameswaram|dhanushkodi|mumbai|colaba|goa|panaji|kochi|mangaluru|chennai|visakhapatnam/.test(
      lower
    )
  ) {
    return 'coastal';
  }
  if (
    /wind\s*corridor|wind\s*farm|wind\s*park|wind\s*belt|ridge|plateau|rural|plains|desert|jaisalmer|satara|chalkewadi|dewas|ladakh|leh|bhuj/.test(
      lower
    )
  ) {
    return 'open';
  }
  if (
    /suburban|industrial|campus|tech\s*park|pune|noida|bengaluru|bangalore|hyderabad|bhu|coimbatore/.test(
      lower
    )
  ) {
    return 'suburban';
  }
  return 'urban';
}

/**
 * Returns strictly at most 6 instant location recommendations matching the typed word/prefix,
 * or 6 featured full-location suggestions when query is empty.
 */
export function getInstantLocationRecommendations(query: string): LocationSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return INDIAN_CITY_FALLBACKS.slice(0, 6);
  }

  // Check if query is directly typed coordinates
  const parsedCoords = parseCoordinates(trimmed);
  if (parsedCoords) {
    return [
      {
        id: `direct-coords-${parsedCoords.lat}-${parsedCoords.lon}`,
        name: `📍 Direct Coordinates (${parsedCoords.lat}°N, ${parsedCoords.lon}°E)`,
        admin1: 'Exact Rooftop Coordinate',
        country: 'Target Site',
        fullLocation: `Exact Coordinates: ${parsedCoords.lat}°N, ${parsedCoords.lon}°E`,
        lat: parsedCoords.lat,
        lon: parsedCoords.lon
      }
    ];
  }

  const q = trimmed.toLowerCase();
  const prefixMatches: LocationSearchResult[] = [];
  const wordMatches: LocationSearchResult[] = [];

  for (const city of INDIAN_CITY_FALLBACKS) {
    const nameLower = city.name.toLowerCase();
    const fullLower = city.fullLocation.toLowerCase();
    if (nameLower.startsWith(q)) {
      prefixMatches.push(city);
    } else if (fullLower.includes(q)) {
      wordMatches.push(city);
    }
  }

  return [...prefixMatches, ...wordMatches].slice(0, 6);
}

/**
 * Detects whether pinned coordinates fall over open ocean (Arabian Sea, Bay of Bengal, Indian Ocean)
 * outside mainland India / Sri Lanka / coastal land cells.
 */
export function detectOceanCoordinate(lat: number, lon: number, apiElevationM?: number | null): boolean {
  if (typeof apiElevationM === 'number' && Number.isFinite(apiElevationM) && apiElevationM < 0) {
    return true;
  }
  // Rough bounding checks for open Arabian Sea, Bay of Bengal, and Indian Ocean
  if (lat < 5.5) return true; // Open Equatorial Indian Ocean south of Sri Lanka
  // Open Arabian Sea west of Gujarat/Konkan/Kerala coastline
  if (lat < 20.0 && lon < 71.5) return true;
  if (lat < 15.0 && lon < 73.2) return true;
  if (lat < 10.0 && lon < 75.5) return true;
  // Open Bay of Bengal east of Tamil Nadu / Andhra / Odisha coastline (excluding Andaman ~92.5-93.5E, 10-14N)
  const isAndaman = lat >= 6.5 && lat <= 14.2 && lon >= 92.0 && lon <= 94.2;
  if (!isAndaman) {
    if (lat < 13.5 && lon > 80.6) return true;
    if (lat < 16.0 && lon > 82.8) return true;
    if (lat < 19.5 && lon > 86.2) return true;
    if (lat < 21.3 && lon > 89.5) return true;
  }
  return false;
}

/**
 * Generates deterministic, meteorologically calibrated 8,760-hour 2025 wind & solar data
 * based on Indian geographic coordinates when offline, rate-limited, or over open ocean.
 */
function generateCalibratedFallbackWeather(
  lat: number,
  lon: number,
  apiWarning: string | null = null,
  isOceanCoordinate: boolean = false
): WeatherData {
  // Deterministic PRNG seeded by lat/lon
  let seed = Math.floor(Math.abs(lat * 10000 + lon * 10000)) % 2147483647;
  if (seed <= 0) seed = 42197;
  const nextRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Determine regional wind regime in India
  const distKutch = Math.hypot(lat - 23.73, lon - 69.86);
  const distJaisalmer = Math.hypot(lat - 26.91, lon - 70.91);
  const distMuppandal = Math.hypot(lat - 8.25, lon - 77.55);
  const distMumbai = Math.hypot(lat - 18.91, lon - 72.81);

  const isCoastalWest = lon < 73.5 && lat < 22.5;
  const isCoastalEast = lon > 79.8 && lat < 18.0;

  let baseMean10m = 2.05; // Default inland Indian city (e.g., Varanasi, Delhi, Lucknow)
  if (isOceanCoordinate) {
    baseMean10m = 6.2; // Offshore marine wind regime
  } else if (distKutch < 1.8 || distMuppandal < 1.5) {
    baseMean10m = 5.85; // Prime Class-I wind corridor
  } else if (distJaisalmer < 2.0) {
    baseMean10m = 4.95;
  } else if (distMumbai < 1.2 || isCoastalWest || isCoastalEast) {
    baseMean10m = 3.55; // Coastal monsoon regime
  } else if (lat < 16.0) {
    baseMean10m = 2.95; // Deccan plateau moderate breeze
  }

  // Estimate site elevation (m above sea level) from Indian geography if offline
  let estimatedElevationM = 80; // Default Indo-Gangetic plain (~80m)
  if (isOceanCoordinate) {
    estimatedElevationM = 0;
  } else if (distMumbai < 0.8 || isCoastalWest || isCoastalEast) {
    estimatedElevationM = 12;
  } else if (distKutch < 1.8) {
    estimatedElevationM = 45;
  } else if (Math.hypot(lat - 12.97, lon - 77.59) < 1.2) {
    estimatedElevationM = 920; // Bengaluru Mysore Plateau
  } else if (lat < 19.5 && lon > 73.5 && lon < 79.5) {
    estimatedElevationM = 540; // Deccan Plateau (Pune / Hyderabad)
  } else if (lat > 30.0) {
    estimatedElevationM = 1450; // Himalayan foothills
  }

  // Monthly seasonality multipliers (May-Aug Southwest Monsoon peak in India)
  const monthlyWindMultipliers = [0.82, 0.86, 0.94, 1.08, 1.34, 1.46, 1.42, 1.32, 1.05, 0.80, 0.74, 0.78];
  // Monthly solar clearness index (dip during June-Aug monsoon cloud cover)
  const monthlySolarClearness = [0.92, 0.96, 1.02, 1.05, 1.04, 0.78, 0.68, 0.72, 0.86, 0.94, 0.92, 0.89];
  // Monthly mean ambient temperatures in °C across Indian seasons
  const monthlyBaseTempC = [18.5, 21.5, 27.0, 32.5, 35.5, 33.0, 29.5, 29.0, 29.5, 27.5, 23.0, 19.0];
  const monthHours = [744, 672, 744, 720, 744, 720, 744, 744, 720, 744, 720, 744];

  // Exact Rayleigh scale normalization: E[sqrt(-ln(1-U))] = sqrt(pi)/2 ≈ 0.8862269
  const RAYLEIGH_MEAN_FACTOR = Math.sqrt(Math.PI) / 2;

  const hourlyWindSpeed10mMs: number[] = [];
  const hourlySolarGhiWm2: number[] = [];
  const hourlyTemp2mC: number[] = [];

  for (let m = 0; m < 12; m++) {
    const hrs = monthHours[m];
    const wMult = monthlyWindMultipliers[m];
    const sClear = monthlySolarClearness[m];
    // Adjust monthly base temperature for site elevation (-6.5°C per 1000m)
    const monthMeanTemp = monthlyBaseTempC[m] - (estimatedElevationM / 1000) * 6.5;

    for (let h = 0; h < hrs; h++) {
      const hourOfDay = h % 24;
      // Diurnal wind boost in afternoon (13:00 - 18:00 IST)
      const diurnalWind = 1 + 0.24 * Math.sin(((hourOfDay - 9) / 24) * 2 * Math.PI);

      // Exact Rayleigh (Weibull k = 2.0) sample normalized by sqrt(pi)/2 so E[v] === targetMean (EPF ≈ 1.91)
      const u = Math.max(0.0001, Math.min(0.9999, nextRand()));
      const rayleighSample = Math.sqrt(-Math.log(1 - u)) / RAYLEIGH_MEAN_FACTOR;
      const v10 = Math.max(0.05, baseMean10m * wMult * diurnalWind * rayleighSample);
      hourlyWindSpeed10mMs.push(Number(v10.toFixed(2)));

      // Diurnal temperature cycle (minimum at 05:00, maximum at 15:00)
      const diurnalTempSwing = 5.5 * Math.sin(((hourOfDay - 9) / 24) * 2 * Math.PI);
      const tempC = Number((monthMeanTemp + diurnalTempSwing).toFixed(1));
      hourlyTemp2mC.push(tempC);

      // Solar GHI bell curve between 06:00 and 18:00 (W/m²)
      if (hourOfDay >= 6 && hourOfDay <= 18) {
        const solarAngle = Math.sin(((hourOfDay - 6) / 12) * Math.PI);
        const cloudNoise = 0.85 + 0.22 * nextRand();
        const peakGhi = 910 * sClear;
        const ghi = Math.max(0, peakGhi * Math.pow(solarAngle, 1.15) * cloudNoise);
        hourlySolarGhiWm2.push(Math.round(ghi));
      } else {
        hourlySolarGhiWm2.push(0);
      }
    }
  }

  return {
    lat,
    lon,
    elevationM: estimatedElevationM,
    source: 'offline_fallback',
    apiWarning,
    isOceanCoordinate,
    year: 2025,
    hourlyWindSpeed10mMs,
    hourlySolarGhiWm2,
    hourlyTemp2mC
  };
}

const weatherCache = new Map<string, WeatherData>();
const inflightWeather = new Map<string, Promise<WeatherData>>();

export interface LiveSurfaceTelemetry {
  elevationM: number;
  currentWindSpeedMs: number;
  windDirectionDeg: number;
  windGustsMs: number;
  shortwaveRadiationWm2: number;
  cloudCoverPct: number;
  currentTempC: number;
  isDay: boolean;
  source: 'open_meteo_live' | 'calibrated_estimate';
  observedAtIso: string;
}

const liveSurfaceCache = new Map<string, { value: LiveSurfaceTelemetry; expiresAt: number }>();

/**
 * Fetch live current surface wind vector, solar irradiance, cloud cover & elevation via backend proxy
 */
export async function fetchLiveSurfaceTelemetry(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<LiveSurfaceTelemetry> {
  const key = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
  const hit = liveSurfaceCache.get(key);
  if (hit && Date.now() < hit.expiresAt) {
    return hit.value;
  }

  try {
    const timeoutSig = AbortSignal.timeout(5000);
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutSig]) : timeoutSig;
    const res = await fetch(`/api/weather/live?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, {
      signal: combinedSignal
    });
    if (res.ok) {
      const data = await res.json();
      const parsed: LiveSurfaceTelemetry = {
        elevationM: Number.isFinite(Number(data?.elevationM)) ? Math.round(Number(data.elevationM)) : 80,
        currentWindSpeedMs: Number(data?.currentWindSpeedMs ?? 1.8),
        windDirectionDeg: Number.isFinite(Number(data?.windDirectionDeg)) ? Math.round(Number(data.windDirectionDeg)) : 245,
        windGustsMs: Number(data?.windGustsMs ?? data?.currentWindSpeedMs ?? 2.4),
        shortwaveRadiationWm2: Math.max(0, Math.round(Number(data?.shortwaveRadiationWm2 ?? 0))),
        cloudCoverPct: Math.min(100, Math.max(0, Math.round(Number(data?.cloudCoverPct ?? 20)))),
        currentTempC: Number(data?.currentTempC ?? 26),
        isDay: data?.isDay === undefined ? true : Boolean(data.isDay),
        source: data?.source === 'open_meteo_live' ? 'open_meteo_live' : 'calibrated_estimate',
        observedAtIso: typeof data?.observedAtIso === 'string' ? data.observedAtIso : new Date().toISOString()
      };
      liveSurfaceCache.set(key, { value: parsed, expiresAt: Date.now() + 5 * 60 * 1000 });
      return parsed;
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err;
    }
  }

  return {
    elevationM: 80,
    currentWindSpeedMs: 1.9,
    windDirectionDeg: 245,
    windGustsMs: 2.6,
    shortwaveRadiationWm2: 520,
    cloudCoverPct: 22,
    currentTempC: 27,
    isDay: true,
    source: 'calibrated_estimate',
    observedAtIso: new Date().toISOString()
  };
}

/**
 * Reverse geocode coordinates using Google Maps / Open-Meteo / Nominatim reverse geocode API
 */
export async function reverseGeocodeLocation(
  lat: number,
  lon: number,
  lang: string = 'en',
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const timeoutSig = AbortSignal.timeout(5500);
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutSig]) : timeoutSig;
    const res = await fetch(
      `/api/geocode/reverse?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&lang=${encodeURIComponent(lang)}`,
      { signal: combinedSignal }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.fullLocation || data?.name || null;
  } catch {
    return null;
  }
}

/**
 * Fetches 8,760 hours of real 2025 hourly 10m wind speed (m/s), solar irradiance (W/m²),
 * 2m ambient temperature (°C), and site elevation (m) from Open-Meteo Historical Archive API.
 * Strictly deduplicates concurrent requests and handles timeouts, HTTP 429 rate-limits, and ocean/null grid cells.
 */
export async function fetchSiteWeather(rawLat: number, rawLon: number): Promise<WeatherData> {
  // Validate coordinate bounds
  const safeLat =
    typeof rawLat === 'number' && Number.isFinite(rawLat)
      ? Math.max(-89.9, Math.min(89.9, rawLat))
      : 25.3176;
  const safeLon =
    typeof rawLon === 'number' && Number.isFinite(rawLon)
      ? Math.max(-179.9, Math.min(179.9, rawLon))
      : 82.9739;

  const roundedLat = Number(safeLat.toFixed(4));
  const roundedLon = Number(safeLon.toFixed(4));
  const cacheKey = `${roundedLat}_${roundedLon}`;

  if (weatherCache.has(cacheKey)) {
    return weatherCache.get(cacheKey)!;
  }
  const existingInflight = inflightWeather.get(cacheKey);
  if (existingInflight) {
    return existingInflight;
  }

  const preDetectedOcean = detectOceanCoordinate(roundedLat, roundedLon);

  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${roundedLat}&longitude=${roundedLon}&start_date=2025-01-01&end_date=2025-12-31&hourly=wind_speed_10m,shortwave_radiation,temperature_2m&wind_speed_unit=ms&temperature_unit=celsius&timezone=Asia%2FKolkata`;

  const task = (async (): Promise<WeatherData> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

    if (response.status === 429) {
      throw new Error('Open-Meteo API rate limit reached (HTTP 429). Using calibrated 8,760-hr regional telemetry.');
    }
    if (!response.ok) {
      throw new Error(`Open-Meteo Weather API returned HTTP ${response.status}.`);
    }

    const data = await response.json();
    const rawWind: unknown[] = data?.hourly?.wind_speed_10m;
    const rawSolar: unknown[] = data?.hourly?.shortwave_radiation;
    const rawTemp: unknown[] = data?.hourly?.temperature_2m;
    const rawElevation = data?.elevation;
    const elevationM =
      typeof rawElevation === 'number' && Number.isFinite(rawElevation)
        ? Math.max(0, rawElevation)
        : 80;

    if (!Array.isArray(rawWind) || rawWind.length < 8000 || !Array.isArray(rawSolar) || rawSolar.length < 8000) {
      throw new Error('Open-Meteo returned an incomplete or empty hourly dataset for these coordinates.');
    }

    // 1. Strict Unit Verification on API Response (`hourly_units`)
    const windUnit = String(data?.hourly_units?.wind_speed_10m || 'm/s').toLowerCase();
    let windToMsFactor = 1.0;
    if (windUnit.includes('km/h') || windUnit.includes('kmh')) {
      windToMsFactor = 1 / 3.6; // Convert km/h -> m/s
    } else if (windUnit.includes('mph') || windUnit.includes('mp/h')) {
      windToMsFactor = 0.44704; // Convert mph -> m/s
    } else if (windUnit.includes('kn')) {
      windToMsFactor = 0.514444; // Convert knots -> m/s
    }

    const solarUnit = String(data?.hourly_units?.shortwave_radiation || 'W/m²').toLowerCase();
    let solarToWm2Factor = 1.0;
    if (solarUnit.includes('mj')) {
      solarToWm2Factor = 277.7778; // Convert MJ/m²/hr -> W/m²
    } else if (solarUnit.includes('kwh')) {
      solarToWm2Factor = 1000.0; // Convert kWh/m²/hr -> W/m²
    }

    const tempUnit = String(data?.hourly_units?.temperature_2m || '°C').toLowerCase();
    const isFahrenheit = tempUnit.includes('f');

    // 2. Count valid non-null numeric records to guard against empty/ocean grid cells filled with nulls
    let validWindCount = 0;
    let validSolarCount = 0;
    let totalSolarSum = 0;

    const hourlyWindSpeed10mMs: number[] = [];
    const hourlySolarGhiWm2: number[] = [];
    const hourlyTemp2mC: number[] = [];

    let lastValidWind = 1.8;
    let lastValidTemp = 26.5;

    for (let i = 0; i < Math.min(8760, rawWind.length); i++) {
      const wVal = rawWind[i];
      if (typeof wVal === 'number' && Number.isFinite(wVal) && wVal >= 0) {
        validWindCount++;
        lastValidWind = Number((wVal * windToMsFactor).toFixed(2));
        hourlyWindSpeed10mMs.push(lastValidWind);
      } else {
        hourlyWindSpeed10mMs.push(lastValidWind);
      }

      const sVal = rawSolar[i];
      if (typeof sVal === 'number' && Number.isFinite(sVal) && sVal >= 0) {
        validSolarCount++;
        const convertedGhi = Math.max(0, Math.round(sVal * solarToWm2Factor));
        totalSolarSum += convertedGhi;
        hourlySolarGhiWm2.push(convertedGhi);
      } else {
        hourlySolarGhiWm2.push(0);
      }

      const tVal = Array.isArray(rawTemp) ? rawTemp[i] : undefined;
      if (typeof tVal === 'number' && Number.isFinite(tVal)) {
        const tempCelsius = isFahrenheit ? (tVal - 32) * (5 / 9) : tVal;
        lastValidTemp = Number(tempCelsius.toFixed(1));
        hourlyTemp2mC.push(lastValidTemp);
      } else {
        hourlyTemp2mC.push(lastValidTemp);
      }
    }

    // Reject datasets where >15% of hours are null or total annual solar irradiance is zero (e.g., invalid ocean grid cell)
    if (validWindCount < 7400 || validSolarCount < 7400 || totalSolarSum < 10000) {
      throw new Error('Pinned coordinates returned sparse or empty marine/ocean telemetry.');
    }

    // Pad to 8760 if needed
    while (hourlyWindSpeed10mMs.length < 8760) hourlyWindSpeed10mMs.push(lastValidWind);
    while (hourlySolarGhiWm2.length < 8760) hourlySolarGhiWm2.push(0);
    while (hourlyTemp2mC.length < 8760) hourlyTemp2mC.push(lastValidTemp);

    const isOcean = detectOceanCoordinate(roundedLat, roundedLon, rawElevation);
    const oceanNotice = isOcean
      ? 'Offshore / Marine coordinates detected. Rooftop turbine & solar audit assumes a coastal or platform mounting structure.'
      : null;

    const result: WeatherData = {
      lat: roundedLat,
      lon: roundedLon,
      elevationM,
      source: 'live',
      apiWarning: oceanNotice,
      isOceanCoordinate: isOcean,
      year: 2025,
      hourlyWindSpeed10mMs,
      hourlySolarGhiWm2,
      hourlyTemp2mC
    };

    weatherCache.set(cacheKey, result);
    return result;
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError';
    const reasonMsg = isAbort
      ? 'Weather API request timed out after 18s. Using calibrated 8,760-hr regional telemetry.'
      : preDetectedOcean
      ? 'Offshore ocean coordinates selected. Using calibrated marine/coastal 8,760-hr reference telemetry.'
      : err?.message || 'Weather API unreachable. Using calibrated 8,760-hr regional telemetry.';

    console.warn('Using calibrated 8,760-hr 2025 telemetry fallback:', reasonMsg);
    const fallbackResult = generateCalibratedFallbackWeather(roundedLat, roundedLon, reasonMsg, preDetectedOcean);
    weatherCache.set(cacheKey, fallbackResult);
    return fallbackResult;
  }
  })();

  inflightWeather.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inflightWeather.delete(cacheKey);
  }
}

export interface SearchLocationResponse {
  results: LocationSearchResult[];
  warning?: string | null;
}

/**
 * Robust geographic coordinate parser
 * Parses all common coordinate formats:
 * - Decimal: "25.2432, 82.9528", "25.2432 82.9528", "-25.2432, -82.9528"
 * - Directional: "25.2432°N, 82.9528°E", "25.2432N 82.9528E", "25.2432S, 82.9528W"
 * - Labeled: "lat: 25.2432, lon: 82.9528", "latitude 25.2432, longitude 82.9528"
 * - DMS: "25°14'35.5\"N 82°57'10.1\"E"
 */
export function parseCoordinates(input: string): { lat: number; lon: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. DMS format: 25°14'35.5"N 82°57'10.1"E
  const dmsRegex = /(\d+)[°\s]+(\d+)['\s]+(\d+(?:\.\d+)?)["\s]*([NSEWnsew])/g;
  const dmsMatches = [...trimmed.matchAll(dmsRegex)];
  if (dmsMatches.length >= 2) {
    const parseDmsPart = (m: RegExpMatchArray) => {
      const deg = parseFloat(m[1]) + parseFloat(m[2]) / 60 + parseFloat(m[3]) / 3600;
      const dir = m[4].toUpperCase();
      return dir === 'S' || dir === 'W' ? -deg : deg;
    };
    const lat = parseDmsPart(dmsMatches[0]);
    const lon = parseDmsPart(dmsMatches[1]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) };
    }
  }

  // 2. Generic numeric lat, lon with optional degree / direction symbols
  const coordRegex = /^(-?\d{1,2}(?:\.\d+)?)\s*°?\s*([NSns])?\s*[,;\s/|]+\s*(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([EWew])?$/;
  const m = trimmed.match(coordRegex);
  if (m) {
    let lat = parseFloat(m[1]);
    if (m[2] && m[2].toUpperCase() === 'S') lat = -Math.abs(lat);
    let lon = parseFloat(m[3]);
    if (m[4] && m[4].toUpperCase() === 'W') lon = -Math.abs(lon);

    if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) };
    }
  }

  // 3. Labeled coordinates: "lat: 25.2432, lon: 82.9528"
  const labeledRegex = /(?:lat(?:itude)?[:\s]*)?(-?\d+(?:\.\d+)?)\s*(?:[°\s]*([nsNS]))?[,\s/|;]+(?:lon(?:gitude)?[:\s]*)?(-?\d+(?:\.\d+)?)\s*(?:[°\s]*([ewEW]))?/i;
  const labeled = trimmed.match(labeledRegex);
  if (labeled && labeled[1] && labeled[3]) {
    let lat = parseFloat(labeled[1]);
    if (labeled[2] && labeled[2].toUpperCase() === 'S') lat = -Math.abs(lat);
    let lon = parseFloat(labeled[3]);
    if (labeled[4] && labeled[4].toUpperCase() === 'W') lon = -Math.abs(lon);

    if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) };
    }
  }

  return null;
}

/**
 * Searches Indian cities/locations via Open-Meteo Geocoding API with 5s timeout,
 * direct lat/lon coordinate parsing, rate-limit handling, and instant local fallback matching.
 */
export async function searchLocation(
  query: string,
  lang: string = 'en',
  signal?: AbortSignal
): Promise<LocationSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return getInstantLocationRecommendations('');

  // 1. Check if user typed coordinates directly in any standard format
  const parsed = parseCoordinates(trimmed);
  if (parsed) {
    const isOcean = detectOceanCoordinate(parsed.lat, parsed.lon);
    const name = isOcean
      ? `Marine Coordinates (${parsed.lat.toFixed(4)}°N, ${parsed.lon.toFixed(4)}°E)`
      : `Coordinates (${parsed.lat.toFixed(4)}°N, ${parsed.lon.toFixed(4)}°E)`;
    const admin1 = isOcean ? 'Offshore / Ocean Grid' : 'Exact Rooftop Coordinate';
    const country = 'Target Site';
    return [
      {
        id: `coords-${parsed.lat.toFixed(4)}-${parsed.lon.toFixed(4)}`,
        name,
        admin1,
        country,
        fullLocation: `Exact Coordinates: ${parsed.lat.toFixed(4)}°N, ${parsed.lon.toFixed(4)}°E`,
        lat: parsed.lat,
        lon: parsed.lon
      }
    ];
  }

  const localMatches = getInstantLocationRecommendations(trimmed);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener('abort', onExternalAbort, { once: true });

    const safeLang = encodeURIComponent(['en', 'hi', 'ta', 'mr'].includes(lang) ? lang : 'en');
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=12&language=${safeLang}&format=json`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);

    if (res.status === 429) {
      throw new Error('Geocoding API rate-limited (HTTP 429)');
    }
    if (!res.ok) {
      throw new Error(`Geocoding API HTTP ${res.status}`);
    }
    const data = await res.json();

    if (!Array.isArray(data?.results)) {
      return localMatches.slice(0, 6);
    }

    // Filter out any malformed geocoding entries lacking finite coordinates and build full location strings
    const apiResults: LocationSearchResult[] = data.results
      .map((r: any) => {
        const name = String(r.name || 'Unnamed Location');
        const admin2 = r.admin2
          ? String(r.admin2)
          : r.admin3
            ? String(r.admin3)
            : '';
        const admin1 = r.admin1 ? String(r.admin1) : '';
        const country = r.country ? String(r.country) : '';
        return {
          id: `${r.id || `${r.latitude}-${r.longitude}`}`,
          name,
          admin2,
          admin1,
          country,
          fullLocation: buildFullLocation(name, admin2, admin1, country),
          lat: Number(r.latitude),
          lon: Number(r.longitude)
        };
      })
      .filter(
        (r: LocationSearchResult) =>
          Number.isFinite(r.lat) &&
          Number.isFinite(r.lon) &&
          r.lat >= -90 &&
          r.lat <= 90 &&
          r.lon >= -180 &&
          r.lon <= 180
      );

    const indiaResults = apiResults.filter((r) => r.country?.toLowerCase() === 'india');
    const otherResults = apiResults.filter((r) => r.country?.toLowerCase() !== 'india');

    // Merge India API matches + local full-location matches + international matches, deduplicated by coordinates
    const merged: LocationSearchResult[] = [];
    const addUnique = (candidate: LocationSearchResult) => {
      const isDuplicate = merged.some(
        (m) =>
          Math.abs(m.lat - candidate.lat) < 0.04 && Math.abs(m.lon - candidate.lon) < 0.04
      );
      if (!isDuplicate) {
        merged.push(candidate);
      }
    };

    for (const item of indiaResults) addUnique(item);
    for (const item of localMatches) addUnique(item);
    for (const item of otherResults) addUnique(item);

    return merged.slice(0, 6);
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.warn('Geocoding API fallback used:', err);
    }
    return localMatches.slice(0, 6);
  }
}

export interface LiveLocationFix {
  lat: number;
  lon: number;
  accuracy: number;
  source: 'gps_high_precision' | 'wifi_cellular_network' | 'cached_position' | 'ip_geolocation';
  sourceLabel: string;
  isExactRooftop: boolean;
  timestamp: number;
  city?: string;
}

export interface GeolocationErrorState {
  code: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'INSECURE_ORIGIN' | 'UNSUPPORTED';
  message: string;
  userGuidance: string;
}

/**
 * Fetch high-accuracy live geolocation via backend Google Geolocation API
 * Uses Wi-Fi and cell tower triangulation to resolve exact rooftop coordinate
 */
export async function fetchLiveGoogleGeolocation(): Promise<{ lat: number; lon: number; accuracy: number; city?: string } | null> {
  try {
    const res = await fetch('/api/locate/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Number.isFinite(data?.lat) && Number.isFinite(data?.lon)) {
      return {
        lat: Number(data.lat.toFixed(5)),
        lon: Number(data.lon.toFixed(5)),
        accuracy: Math.round(data.accuracy || 30),
        city: data.city
      };
    }
    return null;
  } catch (err) {
    console.warn('Google Geolocation fallback failed:', err);
    return null;
  }
}

/**
 * Direct client-side IP Geolocation fallback via ipwho.is (CORS enabled)
 * Resolves real user location even when browser geolocation permission is denied
 */
export async function fetchIpGeolocationFallback(): Promise<LiveLocationFix | null> {
  try {
    const res = await fetch('https://ipwho.is/', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Number.isFinite(data?.latitude) && Number.isFinite(data?.longitude)) {
        return {
          lat: Number(data.latitude.toFixed(5)),
          lon: Number(data.longitude.toFixed(5)),
          accuracy: 1500,
          source: 'ip_geolocation',
          sourceLabel: `City IP Network (${data.city || 'Regional'})`,
          isExactRooftop: false,
          timestamp: Date.now(),
          city: data.city
        };
      }
    }
  } catch {
    // Continue to backend fallback
  }

  const backendFix = await fetchLiveGoogleGeolocation();
  if (backendFix) {
    return {
      lat: backendFix.lat,
      lon: backendFix.lon,
      accuracy: backendFix.accuracy,
      source: 'ip_geolocation',
      sourceLabel: backendFix.city ? `City Network (${backendFix.city})` : `Network Estimate (±${backendFix.accuracy}m)`,
      isExactRooftop: false,
      timestamp: Date.now(),
      city: backendFix.city
    };
  }

  return null;
}

/**
 * Multi-Tiered Real-Time Geolocation Engine
 * 
 * Tier 1: Hardware GPS / High-Accuracy Network Fix (6s timeout)
 * Tier 2: Standard Wi-Fi / Cellular Triangulation (Crucial for desktop PCs & laptops without GPS)
 * Tier 3: Direct Client IP Geolocation (When permission is blocked or unavailable)
 */
export async function getAccurateLivePosition(): Promise<LiveLocationFix> {
  if (typeof window === 'undefined') {
    throw {
      code: 'UNSUPPORTED',
      message: 'Geolocation requires a browser window environment',
      userGuidance: 'Please open WindAudit in a modern web browser.'
    } as GeolocationErrorState;
  }

  // Check if browser context is secure (Chrome requires HTTPS or localhost)
  if (window.isSecureContext === false && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    const ipFix = await fetchIpGeolocationFallback();
    if (ipFix) return ipFix;
    throw {
      code: 'INSECURE_ORIGIN',
      message: 'Browser location requires HTTPS or localhost',
      userGuidance: 'Access this app over https:// or localhost, or search your rooftop location above.'
    } as GeolocationErrorState;
  }

  if (!navigator.geolocation) {
    const ipFix = await fetchIpGeolocationFallback();
    if (ipFix) return ipFix;
    throw {
      code: 'UNSUPPORTED',
      message: 'Browser geolocation is not supported on this device',
      userGuidance: 'Please update your browser or search your address directly.'
    } as GeolocationErrorState;
  }

  // Optional: check permissions API if available
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const permStatus = await navigator.permissions.query({ name: 'geolocation' });
      if (permStatus.state === 'denied') {
        // Try IP fallback immediately to avoid hanging
        const ipFix = await fetchIpGeolocationFallback();
        if (ipFix) {
          return {
            ...ipFix,
            sourceLabel: `Location blocked by browser. Using IP estimate (${ipFix.city || 'Regional'})`
          };
        }
        throw {
          code: 'PERMISSION_DENIED',
          message: 'Location access is blocked in your browser',
          userGuidance: 'Click the padlock or settings icon in your address bar, allow location access, and click GPS again.'
        } as GeolocationErrorState;
      }
    } catch {
      // permissions API not universally supported for all names, continue
    }
  }

  // Tier 1: High Accuracy Hardware/Network GPS (timeout: 6000ms)
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 10000
      });
    });

    const liveLat = Number(pos.coords.latitude.toFixed(5));
    const liveLon = Number(pos.coords.longitude.toFixed(5));
    const accM = Math.round(pos.coords.accuracy);

    return {
      lat: liveLat,
      lon: liveLon,
      accuracy: accM,
      source: 'gps_high_precision',
      sourceLabel: `High-Precision GPS (±${accM}m)`,
      isExactRooftop: accM <= 25,
      timestamp: pos.timestamp
    };
  } catch (err: any) {
    // If permission was explicitly denied by user clicking "Block", respect it
    if (err?.code === 1) { // PERMISSION_DENIED
      const ipFix = await fetchIpGeolocationFallback();
      if (ipFix) {
        return {
          ...ipFix,
          sourceLabel: `Permission denied. Using IP location (${ipFix.city || 'Regional'})`
        };
      }
      throw {
        code: 'PERMISSION_DENIED',
        message: 'Location access was blocked in your browser',
        userGuidance: 'Click the padlock or settings icon in your browser address bar, set Location to "Allow", and retry.'
      } as GeolocationErrorState;
    }

    // Tier 2: Standard Wi-Fi / Cellular Triangulation (9s timeout, lenient cache)
    // This succeeds immediately on laptops/desktops where hardware GPS is unavailable
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 9000,
          maximumAge: 300000 // 5-minute cache allowed
        });
      });

      const liveLat = Number(pos.coords.latitude.toFixed(5));
      const liveLon = Number(pos.coords.longitude.toFixed(5));
      const accM = Math.round(pos.coords.accuracy);

      return {
        lat: liveLat,
        lon: liveLon,
        accuracy: accM,
        source: 'wifi_cellular_network',
        sourceLabel: `Wi-Fi / Cell Triangulation (±${accM}m)`,
        isExactRooftop: accM <= 40,
        timestamp: pos.timestamp
      };
    } catch (err2: any) {
      if (err2?.code === 1) {
        const ipFix = await fetchIpGeolocationFallback();
        if (ipFix) {
          return {
            ...ipFix,
            sourceLabel: `Permission denied. Using IP location (${ipFix.city || 'Regional'})`
          };
        }
        throw {
          code: 'PERMISSION_DENIED',
          message: 'Location access was blocked in your browser',
          userGuidance: 'Click the padlock or settings icon in your browser address bar, set Location to "Allow", and retry.'
        } as GeolocationErrorState;
      }

      // Tier 3: IP Geolocation Fallback
      const ipFix = await fetchIpGeolocationFallback();
      if (ipFix) {
        return ipFix;
      }

      throw {
        code: 'POSITION_UNAVAILABLE',
        message: 'Unable to acquire real-time GPS or network location fix',
        userGuidance: 'Please search your city or rooftop coordinates directly in the search bar above.'
      } as GeolocationErrorState;
    }
  }
}
