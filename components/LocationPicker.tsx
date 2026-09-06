'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Search,
  Navigation,
  X,
  ExternalLink,
  Compass,
  Check,
  Loader2,
  Building2,
  TreePine,
  Coffee,
  Home,
  BookOpen,
  Waves,
  Sparkles,
  SlidersHorizontal,
  ChevronRight,
  Crosshair,
  Layers,
  Map as MapIcon,
  Edit3
} from 'lucide-react';
import { EntryLocation } from '@/lib/types';
import { apiFetch } from '@/lib/api-client';
import { useLanguage } from '@/lib/i18n';

interface LocationPickerProps {
  location?: EntryLocation;
  onChange: (location?: EntryLocation) => void;
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'search' | 'gps' | 'sanctuaries' | 'custom';

interface SanctuaryPreset {
  name: string;
  address: string;
  category: string;
  ambientVibe: string;
  icon: React.ElementType;
  lat: number;
  lng: number;
  gradient: string;
}

const SANCTUARY_PRESETS: SanctuaryPreset[] = [
  {
    name: 'Quiet Home Sanctuary',
    address: 'Private Studio & Study Space',
    category: 'Sanctuary',
    ambientVibe: 'Tranquil & Introspective',
    icon: Home,
    lat: 37.7749,
    lng: -122.4194,
    gradient: 'from-amber-500/20 to-orange-500/10 text-amber-300',
  },
  {
    name: 'Artisan Coffee Haven',
    address: 'Acoustic Corner, Downtown Espresso Bar',
    category: 'Coffee & Tea',
    ambientVibe: 'Warm Acoustic & Focused',
    icon: Coffee,
    lat: 37.7892,
    lng: -122.4014,
    gradient: 'from-amber-600/20 to-yellow-600/10 text-amber-200',
  },
  {
    name: 'Pine Ridge Nature Trail',
    address: 'Scenic Overlook & Forest Grove',
    category: 'Nature & Parks',
    ambientVibe: 'Open Air & Rejuvenating',
    icon: TreePine,
    lat: 37.8651,
    lng: -122.2588,
    gradient: 'from-emerald-500/20 to-teal-500/10 text-emerald-300',
  },
  {
    name: 'Grand Memorial Library',
    address: 'Silent Reading Atrium, West Wing',
    category: 'Study & Library',
    ambientVibe: 'Deep Quiet & Contemplation',
    icon: BookOpen,
    lat: 37.7785,
    lng: -122.4158,
    gradient: 'from-blue-500/20 to-indigo-500/10 text-blue-300',
  },
  {
    name: 'Sunset Ocean Boardwalk',
    address: 'Pacific Coastal Trail & Waterfront',
    category: 'Waterfront',
    ambientVibe: 'Rhythmic Waves & Clarity',
    icon: Waves,
    lat: 37.7601,
    lng: -122.5098,
    gradient: 'from-cyan-500/20 to-sky-500/10 text-cyan-300',
  },
  {
    name: 'Innovation & Co-Working Lab',
    address: 'High-Ceiling Studio Loft, Floor 4',
    category: 'Work & Studio',
    ambientVibe: 'Kinetic & Breakthrough Focus',
    icon: Building2,
    lat: 37.7905,
    lng: -122.3989,
    gradient: 'from-purple-500/20 to-pink-500/10 text-purple-300',
  },
];

export function LocationPicker({ location, onChange, isOpen, onClose }: LocationPickerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [searchResults, setSearchResults] = useState<EntryLocation[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const { t, detectAndApplyGpsLanguage, isAutoGpsEnabled } = useLanguage();

  // Custom Place Form State
  const [customName, setCustomName] = useState(() => location?.name || '');
  const [customAddress, setCustomAddress] = useState(() => location?.formattedAddress || location?.address || '');
  const [customVibe, setCustomVibe] = useState(() => location?.ambientVibe || 'Focused & Inspiring');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Focus search on modal open if on search tab
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Real-time debounced search
  const performSearch = async (queryText: string) => {
    if (!queryText.trim()) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const res = await apiFetch('/api/maps/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText }),
      });

      if (!res.ok) {
        throw new Error('Location lookup service unavailable');
      }

      const data = await res.json();
      if (Array.isArray(data.places) && data.places.length > 0) {
        setSearchResults(data.places);
      } else {
        setSearchResults([]);
        setSearchError('No matching places found. Try a different city, landmark, or category.');
      }
    } catch (err: any) {
      setSearchError(err?.message || 'Error connecting to maps service');
    } finally {
      setIsSearching(false);
    }
  };

  const handleQueryChange = (val: string) => {
    setSearchQuery(val);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (val.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        performSearch(val);
      }, 350);
    } else {
      setSearchResults([]);
    }
  };

  const handleManualSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    performSearch(searchQuery);
  };

  // High-accuracy GPS detection with language syncing
  const handleDetectGPS = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setSearchError('Geolocation is not supported by your browser.');
      return;
    }

    setIsGeolocating(true);
    setSearchError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          // Auto-detect and switch language if coordinates match VN, ZH, KO
          await detectAndApplyGpsLanguage(lat, lng);

          const res = await apiFetch('/api/maps/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng }),
          });

          if (!res.ok) throw new Error('Reverse geocoding failed');

          const data = await res.json();
          if (data.location) {
            const loc: EntryLocation = {
              ...data.location,
              ambientVibe: 'Present Moment GPS',
              category: 'GPS Coordinate Pin',
            };
            onChange(loc);
            onClose();
          }
        } catch (err: any) {
          setSearchError('Could not resolve address from GPS coordinates.');
        } finally {
          setIsGeolocating(false);
        }
      },
      (err) => {
        setIsGeolocating(false);
        setSearchError('GPS permission denied or unavailable. You can search by name or select a sanctuary.');
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  };

  const handleSelectLocation = (loc: EntryLocation) => {
    onChange(loc);
    onClose();
  };

  const handleSaveCustomLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const newLoc: EntryLocation = {
      name: customName.trim(),
      address: customAddress.trim() || customName.trim(),
      formattedAddress: customAddress.trim() || customName.trim(),
      ambientVibe: customVibe,
      category: 'Custom Sanctuary',
      lat: location?.lat || 37.7749,
      lng: location?.lng || -122.4194,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customName.trim())}`,
    };

    onChange(newLoc);
    onClose();
  };

  const handleRemoveLocation = () => {
    onChange(undefined);
    onClose();
  };

  return (
    <div
      id="location-picker-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-md transition-all animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/15 bg-[#0b0d13] text-zinc-100 shadow-2xl shadow-black/90 flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS Sheet Grabber Bar */}
        <div className="pt-2.5 pb-1 flex justify-center">
          <div className="h-1.5 w-12 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500/20 via-amber-400/10 to-amber-500/30 border border-amber-400/30 text-amber-300 shadow-inner">
              <MapPin className="h-5 w-5 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
                <span>Location & Atmosphere</span>
                <span className="rounded-full bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  Google Maps
                </span>
              </h3>
              <p className="text-xs text-zinc-400">Ground your reflections with geographic context & surroundings</p>
            </div>
          </div>
          <button
            id="btn-close-location-modal"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* iOS-Style Segmented Tab Bar */}
        <div className="px-6 pt-3 pb-2 border-b border-white/5 bg-white/[0.02]">
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-white/[0.06] p-1 border border-white/5">
            <button
              id="tab-location-search"
              type="button"
              onClick={() => setActiveTab('search')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                activeTab === 'search'
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search</span>
            </button>

            <button
              id="tab-location-gps"
              type="button"
              onClick={() => {
                setActiveTab('gps');
                handleDetectGPS();
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                activeTab === 'gps'
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Navigation className="h-3.5 w-3.5" />
              <span>GPS Radar</span>
            </button>

            <button
              id="tab-location-sanctuaries"
              type="button"
              onClick={() => setActiveTab('sanctuaries')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                activeTab === 'sanctuaries'
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Sanctuaries</span>
            </button>

            <button
              id="tab-location-custom"
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                activeTab === 'custom'
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Custom</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Currently Active Pinned Location Card */}
          {location && (
            <div
              id="active-location-mini-map-card"
              className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-b from-amber-400/10 via-[#12151f] to-[#0c0e14] p-4 shadow-lg shadow-amber-950/20"
            >
              {/* Decorative Subtle Grid Lines & Radar Beacon */}
              <div className="absolute right-3 top-3 flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <span className="text-[10px] font-mono font-bold tracking-wider text-amber-300/90 uppercase">
                  Active Pin
                </span>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-300">
                  <MapPin className="h-5 w-5 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
                </div>
                <div className="min-w-0 flex-1 pr-16">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white truncate">{location.name}</h4>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-300 line-clamp-1">
                    {location.formattedAddress || location.address || 'Address registered'}
                  </p>

                  {/* Telemetry & Vibe Pills */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {location.category && (
                      <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-zinc-300 font-medium">
                        {location.category}
                      </span>
                    )}
                    {location.ambientVibe && (
                      <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-amber-300 font-medium">
                        ✨ {location.ambientVibe}
                      </span>
                    )}
                    {location.lat !== undefined && location.lng !== undefined && (
                      <span className="rounded-md border border-white/5 bg-black/40 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                        {location.lat >= 0 ? `${location.lat.toFixed(3)}°N` : `${Math.abs(location.lat).toFixed(3)}°S`},{' '}
                        {location.lng >= 0 ? `${location.lng.toFixed(3)}°E` : `${Math.abs(location.lng).toFixed(3)}°W`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Controls on Active Pin */}
              <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between">
                {location.mapsUrl ? (
                  <a
                    href={location.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 transition"
                  >
                    <span>Open in Google Maps</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <div />
                )}
                <button
                  id="btn-remove-location-pin"
                  type="button"
                  onClick={handleRemoveLocation}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition"
                >
                  Clear Location
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: Search Places */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              <form onSubmit={handleManualSearchSubmit} className="relative">
                <input
                  ref={searchInputRef}
                  id="input-location-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="Search city, coffee shop, park, landmark, library..."
                  className="w-full rounded-2xl border border-white/15 bg-slate-900/90 pl-11 pr-24 py-3 text-sm text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition shadow-inner"
                />
                <Search className="absolute left-4 top-3.5 h-4 w-4 text-zinc-400" />

                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="absolute right-16 top-3 text-zinc-500 hover:text-zinc-300 p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}

                <button
                  id="btn-submit-location-search"
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="absolute right-2 top-2 rounded-xl bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-zinc-950 hover:bg-amber-300 disabled:opacity-40 transition"
                >
                  {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
                </button>
              </form>

              {searchError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  {searchError}
                </div>
              )}

              {/* Autocomplete Results */}
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-medium px-1">
                    <span>Google Maps Results ({searchResults.length})</span>
                    <span>Tap to pin</span>
                  </div>
                  <div className="space-y-1.5">
                    {searchResults.map((place, idx) => (
                      <button
                        key={idx}
                        id={`btn-select-search-place-${idx}`}
                        type="button"
                        onClick={() => handleSelectLocation(place)}
                        className="w-full flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3 text-left transition hover:border-amber-400/40 hover:bg-white/[0.07] group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20 group-hover:bg-amber-400 group-hover:text-black transition">
                            <MapPin className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white group-hover:text-amber-200 transition truncate">
                              {place.name}
                            </div>
                            <div className="text-xs text-zinc-400 truncate">
                              {place.formattedAddress || place.address}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {place.category && (
                            <span className="hidden sm:inline rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400 font-medium">
                              {place.category}
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-white transition" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : !isSearching && searchQuery.length === 0 ? (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-1">
                    Suggested Exploration & Global Metropolises
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { name: 'Tokyo, Japan', q: 'Tokyo Japan' },
                      { name: 'Kyoto Sanctuaries', q: 'Kyoto Bamboo Grove' },
                      { name: 'Central Park, NYC', q: 'Central Park New York' },
                      { name: 'San Francisco Overlook', q: 'Golden Gate Bridge San Francisco' },
                      { name: 'London Parks', q: 'Hyde Park London' },
                      { name: 'Parisian Gardens', q: 'Jardin du Luxembourg Paris' },
                    ].map((item, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSearchQuery(item.q);
                          performSearch(item.q);
                        }}
                        className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-xs text-zinc-300 hover:border-amber-400/30 hover:bg-white/[0.06] hover:text-white transition text-left"
                      >
                        <Compass className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 2: GPS Radar */}
          {activeTab === 'gps' && (
            <div className="space-y-4 py-2 text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 relative">
                <span className="animate-ping absolute inline-flex h-20 w-20 rounded-full bg-sky-400 opacity-20"></span>
                <Navigation className={`h-10 w-10 ${isGeolocating ? 'animate-bounce' : ''}`} />
              </div>

              <div>
                <h4 className="text-base font-bold text-white">Live GPS Location Radar</h4>
                <p className="mt-1 text-xs text-zinc-400 max-w-sm mx-auto">
                  Automatically pin your exact latitude, longitude, and nearest geographic neighborhood for this reflection.
                </p>
              </div>

              <div className="pt-2">
                <button
                  id="btn-detect-gps-trigger"
                  type="button"
                  onClick={handleDetectGPS}
                  disabled={isGeolocating}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/25 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 transition"
                >
                  {isGeolocating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Detecting Coordinates...</span>
                    </>
                  ) : (
                    <>
                      <Crosshair className="h-4 w-4" />
                      <span>Pin My Current GPS Coordinates</span>
                    </>
                  )}
                </button>
              </div>

              {searchError && (
                <p className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 max-w-sm mx-auto">
                  {searchError}
                </p>
              )}
            </div>
          )}

          {/* TAB 3: Mindful Sanctuaries */}
          {activeTab === 'sanctuaries' && (
            <div className="space-y-3">
              <div className="text-xs text-zinc-400 px-1">
                Select from curated environments designed to establish your reflection atmosphere:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SANCTUARY_PRESETS.map((preset, idx) => {
                  const Icon = preset.icon;
                  return (
                    <button
                      key={idx}
                      id={`btn-sanctuary-${idx}`}
                      type="button"
                      onClick={() => handleSelectLocation({
                        name: preset.name,
                        address: preset.address,
                        formattedAddress: preset.address,
                        category: preset.category,
                        ambientVibe: preset.ambientVibe,
                        lat: preset.lat,
                        lng: preset.lng,
                        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${preset.lat},${preset.lng}`,
                      })}
                      className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3 text-left transition hover:border-amber-400/40 hover:bg-white/[0.07] group"
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${preset.gradient} border border-white/10 group-hover:scale-105 transition`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white group-hover:text-amber-200 transition truncate">
                          {preset.name}
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {preset.address}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-300/80 font-medium">
                          <Sparkles className="h-2.5 w-2.5" />
                          <span>{preset.ambientVibe}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: Custom Location & Labeling */}
          {activeTab === 'custom' && (
            <form onSubmit={handleSaveCustomLocation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Sanctuary or Place Name *
                </label>
                <input
                  id="input-custom-location-name"
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. My Balcony Lookout, Cabin by the Lake, Kyoto Teahouse"
                  required
                  className="w-full rounded-xl border border-white/15 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Address or Neighborhood Description
                </label>
                <input
                  id="input-custom-location-address"
                  type="text"
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  placeholder="e.g. 5th Floor Study, Downtown Arts Quarter, Kyoto Japan"
                  className="w-full rounded-xl border border-white/15 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Ambient Atmosphere / Vibe
                </label>
                <select
                  id="select-custom-location-vibe"
                  value={customVibe}
                  onChange={(e) => setCustomVibe(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="Tranquil & Introspective">Tranquil & Introspective</option>
                  <option value="Warm Acoustic & Focused">Warm Acoustic & Focused</option>
                  <option value="Open Air & Rejuvenating">Open Air & Rejuvenating</option>
                  <option value="Deep Quiet & Contemplation">Deep Quiet & Contemplation</option>
                  <option value="Rhythmic Waves & Clarity">Rhythmic Waves & Clarity</option>
                  <option value="Kinetic & High Energy">Kinetic & High Energy</option>
                </select>
              </div>

              <button
                id="btn-save-custom-location"
                type="submit"
                className="w-full rounded-2xl bg-amber-400 py-3 text-sm font-bold text-zinc-950 hover:bg-amber-300 transition shadow-md shadow-amber-950/40"
              >
                Apply Custom Location
              </button>
            </form>
          )}

        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-6 py-3.5 bg-black/40 flex items-center justify-between">
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-zinc-400" />
            <span>Google Maps Places (New) Platform Grounding</span>
          </div>
          <button
            id="btn-done-location-picker"
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 px-5 py-2 text-xs font-bold text-white hover:bg-white/20 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
