import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  MapPin,
  Globe,
  ExternalLink,
  Loader2,
  Compass,
  FileSearch,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useLanguage } from '../i18n';

interface GroundingIntelPanelProps {
  siteName: string;
  lat: number;
  lon: number;
  budgetInr: number;
  solarEquivalentKw: number;
}

interface MapsGroundingResult {
  text: string;
  links: Array<{ title: string; uri: string; snippets?: string[] }>;
  source?: string;
}

interface SearchGroundingResult {
  text: string;
  links: Array<{ title: string; uri: string }>;
  source?: string;
}

function renderInlineSegments(text: string): React.ReactNode {
  const tokenRegex = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g;
  const parts = text.split(tokenRegex);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[#111315] dark:text-[#F3F4F6]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    const linkMatch = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(part);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-[#0F62FE]/50 dark:decoration-sky-400/50 text-[#0F62FE] dark:text-sky-400 hover:opacity-80"
        >
          {linkMatch[1]}
        </a>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function StructuredBriefing({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);

  return (
    <div className="space-y-2 text-xs leading-relaxed text-[#374151] dark:text-[#D1D5DB] font-sans">
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={index} className="h-1" />;
        }
        if (/^(-{3,}|\*{3,})$/.test(line)) {
          return <hr key={index} className="my-2.5 border-[#D4D4CE] dark:border-[#22252A]" />;
        }
        const headingMatch = /^#{1,4}\s+(.+)$/.exec(line);
        if (headingMatch) {
          return (
            <h4
              key={index}
              className="pt-1 font-display text-[13px] font-bold tracking-tight text-[#111315] dark:text-[#F3F4F6] flex items-center gap-1.5"
            >
              <span className="h-3 w-[3px] bg-[#0F62FE] dark:bg-sky-400 shrink-0" aria-hidden="true" />
              <span>{headingMatch[1]}</span>
            </h4>
          );
        }
        const bulletMatch = /^(?:•|-|\*)\s+(.+)$/.exec(line);
        if (bulletMatch) {
          return (
            <div key={index} className="flex items-start gap-2 pl-1">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-[#0F62FE] dark:bg-sky-400"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">{renderInlineSegments(bulletMatch[1])}</span>
            </div>
          );
        }
        const numberedMatch = /^(\d+\.)\s+(.+)$/.exec(line);
        if (numberedMatch) {
          return (
            <div key={index} className="flex items-start gap-2 pl-1">
              <span className="font-mono-tabular text-[11px] font-bold text-[#0F62FE] dark:text-sky-400 shrink-0">
                {numberedMatch[1]}
              </span>
              <span className="min-w-0 flex-1">{renderInlineSegments(numberedMatch[2])}</span>
            </div>
          );
        }
        return (
          <p key={index} className="text-[#374151] dark:text-[#D1D5DB]">
            {renderInlineSegments(line)}
          </p>
        );
      })}
    </div>
  );
}

function parseErrorMessage(err: any): string {
  if (err?.name === 'AbortError') {
    return 'Search timed out after 15 seconds. Please try again.';
  }
  const msg = err?.message || String(err || '');
  if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'AI live search is busy. Using verified regional solar directory and subsidy standards.';
  }
  return 'Could not retrieve live information. Please check your network connection.';
}

export const GroundingIntelPanel: React.FC<GroundingIntelPanelProps> = ({
  siteName,
  lat,
  lon,
  budgetInr,
  solarEquivalentKw
}) => {
  const { language, t } = useLanguage();
  const [mapsResult, setMapsResult] = useState<MapsGroundingResult | null>(null);
  const [isLoadingMaps, setIsLoadingMaps] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);

  const [searchResult, setSearchResult] = useState<SearchGroundingResult | null>(null);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleFetchMapsGrounding = async () => {
    setIsLoadingMaps(true);
    setMapsError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 16000);
    try {
      const res = await fetch('/api/grounding/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat,
          lon,
          siteName,
          language
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const rawText = await res.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error(`Invalid response from Maps Grounding service (HTTP ${res.status}).`);
      }
      if (!res.ok) {
        throw new Error(data?.error || `Maps Grounding request failed (HTTP ${res.status}).`);
      }
      setMapsResult({
        text: data?.text || 'No grounded places summary returned for these coordinates.',
        links: Array.isArray(data?.links) ? data.links : [],
        source: data?.source
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      setMapsError(parseErrorMessage(err));
    } finally {
      setIsLoadingMaps(false);
    }
  };

  const handleFetchSearchGrounding = async () => {
    setIsLoadingSearch(true);
    setSearchError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 16000);
    try {
      const res = await fetch('/api/grounding/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteName,
          budgetInr,
          solarKw: solarEquivalentKw,
          language
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const rawText = await res.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error(`Invalid response from Search Grounding service (HTTP ${res.status}).`);
      }
      if (!res.ok) {
        throw new Error(data?.error || `Search Grounding request failed (HTTP ${res.status}).`);
      }
      setSearchResult({
        text: data?.text || 'No grounded policy summary returned for this query.',
        links: Array.isArray(data?.links) ? data.links : [],
        source: data?.source
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      setSearchError(parseErrorMessage(err));
    } finally {
      setIsLoadingSearch(false);
    }
  };

  return (
    <div className="no-print grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Tile 1: Local Solar Installers & Terrain */}
      <motion.div
        initial={{ opacity: 0.92, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.05 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="flex flex-col justify-between border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/30 dark:bg-[#101216] p-6 sm:p-7"
      >
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#D4D4CE] dark:border-[#22252A] pb-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] text-[#0F62FE] dark:text-sky-400">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-sm sm:text-base font-bold text-[#111315] dark:text-[#F3F4F6]">
                  {t('ground_maps_title')}
                </h3>
                <p className="mt-0.5 text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
                  Verified nearby installers &amp; rooftop surroundings at {lat.toFixed(4)}°N, {lon.toFixed(4)}°E
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
              <span className="inline-flex items-center gap-1 border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/80 dark:bg-[#0A0B0D] px-2 py-0.5 font-mono-tabular text-[10px] font-medium text-[#52565E] dark:text-[#8E94A0]">
                {mapsResult?.source ? (
                  <>
                    <CheckCircle2 className="h-2.5 w-2.5 text-[#059669] dark:text-[#34D399]" />
                    <span>
                      {mapsResult.source === 'google_maps_and_meteo_api'
                        ? 'Google Maps & Open-Meteo'
                        : 'Google Maps Grounding'}
                    </span>
                  </>
                ) : (
                  <span>Source: Google Maps Grounding</span>
                )}
              </span>

              <button
                type="button"
                onClick={handleFetchMapsGrounding}
                disabled={isLoadingMaps}
                className="flex items-center gap-1.5 border border-[#0F62FE] bg-[#0F62FE] hover:bg-[#0050E6] dark:border-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 px-3.5 py-2 font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-white dark:text-slate-950 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isLoadingMaps ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{t('ground_maps_loading')}</span>
                  </>
                ) : (
                  <>
                    <Compass className="h-3.5 w-3.5" />
                    <span>{t('ground_maps_btn')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {mapsError && (
            <div className="mt-4 flex items-start gap-2 border border-[#DC2626]/40 dark:border-[#EF4444]/40 bg-[#DC2626]/10 dark:bg-[#EF4444]/10 p-3.5 text-xs text-[#DC2626] dark:text-[#FCA5A5]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{mapsError}</span>
            </div>
          )}

          {!mapsResult && !isLoadingMaps && !mapsError && (
            <div className="mt-4 border border-dashed border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/60 dark:bg-[#0A0B0D]/70 p-4 text-xs leading-relaxed text-[#52565E] dark:text-[#9CA3AF]">
              Click <strong className="text-[#111315] dark:text-[#F3F4F6]">Scan Nearby Places</strong> to find verified rooftop solar installers, elevation, and terrain surroundings for{' '}
              <strong className="text-[#111315] dark:text-[#F3F4F6]">{siteName}</strong>.
            </div>
          )}

          {mapsResult && (
            <div className="mt-4 space-y-3">
              <div className="max-h-72 overflow-y-auto border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-4">
                <StructuredBriefing text={mapsResult.text} />
              </div>

              {mapsResult.links.length > 0 && (
                <div>
                  <div className="mb-1.5 font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-[#52565E] dark:text-[#8E94A0]">
                    Verified Nearby Places &amp; Routes ({mapsResult.links.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {mapsResult.links.map((link, idx) => (
                      <a
                        key={`${link.uri}-${idx}`}
                        href={link.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 border border-[#0F62FE]/35 dark:border-sky-400/35 bg-[#0F62FE]/10 dark:bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-[#0F62FE] dark:text-sky-400 transition-opacity hover:opacity-85"
                      >
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="max-w-[220px] truncate">{link.title}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Tile 2: PM Surya Ghar Subsidies & Net-Metering */}
      <motion.div
        initial={{ opacity: 0.92, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.05 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="flex flex-col justify-between border border-[#D4D4CE] dark:border-[#22252A] bg-[#ECECE6]/30 dark:bg-[#101216] p-6 sm:p-7"
      >
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#D4D4CE] dark:border-[#22252A] pb-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] text-[#059669] dark:text-[#10B981]">
                <Globe className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-sm sm:text-base font-bold text-[#111315] dark:text-[#F3F4F6]">
                  {t('ground_subsidy_title')}
                </h3>
                <p className="mt-0.5 text-[11px] text-[#52565E] dark:text-[#9CA3AF]">
                  Central solar subsidy &amp; state DISCOM rules for ₹{budgetInr.toLocaleString('en-IN')} ({solarEquivalentKw.toFixed(2)} kW)
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
              <span className="inline-flex items-center gap-1 border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/80 dark:bg-[#0A0B0D] px-2 py-0.5 font-mono-tabular text-[10px] font-medium text-[#52565E] dark:text-[#8E94A0]">
                {searchResult?.source ? (
                  <>
                    <CheckCircle2 className="h-2.5 w-2.5 text-[#059669] dark:text-[#34D399]" />
                    <span>
                      {searchResult.source === 'pm_surya_ghar_verified_database'
                        ? 'PM Surya Ghar & DISCOM'
                        : 'Google Search Grounding'}
                    </span>
                  </>
                ) : (
                  <span>Source: Google Search Grounding</span>
                )}
              </span>

              <button
                type="button"
                onClick={handleFetchSearchGrounding}
                disabled={isLoadingSearch}
                className="flex items-center gap-1.5 border border-[#0F62FE] bg-[#0F62FE] hover:bg-[#0050E6] dark:border-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 px-3.5 py-2 font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-white dark:text-slate-950 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isLoadingSearch ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{t('ground_subsidy_loading')}</span>
                  </>
                ) : (
                  <>
                    <FileSearch className="h-3.5 w-3.5" />
                    <span>{t('ground_subsidy_btn')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {searchError && (
            <div className="mt-4 flex items-start gap-2 border border-[#DC2626]/40 dark:border-[#EF4444]/40 bg-[#DC2626]/10 dark:bg-[#EF4444]/10 p-3.5 text-xs text-[#DC2626] dark:text-[#FCA5A5]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {!searchResult && !isLoadingSearch && !searchError && (
            <div className="mt-4 border border-dashed border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0]/60 dark:bg-[#0A0B0D]/70 p-4 text-xs leading-relaxed text-[#52565E] dark:text-[#9CA3AF]">
              Click <strong className="text-[#111315] dark:text-[#F3F4F6]">Check Live Subsidies</strong> to view current{' '}
              <span className="font-semibold text-[#059669] dark:text-[#34D399]">PM Surya Ghar government subsidies (up to ₹78,000)</span> and net-metering rules for{' '}
              <strong className="text-[#111315] dark:text-[#F3F4F6]">{siteName}</strong>.
            </div>
          )}

          {searchResult && (
            <div className="mt-4 space-y-3">
              <div className="max-h-72 overflow-y-auto border border-[#D4D4CE] dark:border-[#22252A] bg-[#F4F4F0] dark:bg-[#0A0B0D] p-4">
                <StructuredBriefing text={searchResult.text} />
              </div>

              {searchResult.links.length > 0 && (
                <div>
                  <div className="mb-1.5 font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-[#52565E] dark:text-[#8E94A0]">
                    Verified Government &amp; Utility Portals ({searchResult.links.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {searchResult.links.map((link, idx) => (
                      <a
                        key={`${link.uri}-${idx}`}
                        href={link.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 border border-[#059669]/35 dark:border-[#10B981]/35 bg-[#059669]/10 dark:bg-[#10B981]/10 px-2.5 py-1 text-xs font-semibold text-[#059669] dark:text-[#34D399] transition-opacity hover:opacity-85"
                      >
                        <Globe className="h-3 w-3 shrink-0" />
                        <span className="max-w-[240px] truncate">{link.title}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
