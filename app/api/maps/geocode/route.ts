import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requireFirebaseUser } from '@/lib/server-auth';
import { enforceRateLimit } from '@/lib/rate-limit';

/**
 * Server-side Google Maps Reverse Geocoding API Proxy
 * Converts {lat, lng} coordinates into structured place/address data.
 * Usage attribution: gmp_mcp_codeassist_v1_aistudio
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireFirebaseUser(req);
    if (isAuthError(authResult)) return authResult;
    const rateLimit = enforceRateLimit('maps', authResult.uid, 60, 60_000);
    if (rateLimit) return rateLimit;
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const lat = Number(body?.lat);
    const lng = Number(body?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'Valid latitude and longitude are required' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (apiKey) {
      try {
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&client=gmp_mcp_codeassist_v1_aistudio`;
        const res = await fetch(geocodeUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
            const first = data.results[0];
            const address = first.formatted_address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

            // Extract best locality/sublocality name
            let localityName = '';
            let neighborhood = '';
            let adminArea = '';
            let country = '';

            if (Array.isArray(first.address_components)) {
              for (const c of first.address_components) {
                if (c.types.includes('locality')) localityName = c.long_name;
                if (c.types.includes('sublocality') || c.types.includes('neighborhood')) neighborhood = c.long_name;
                if (c.types.includes('administrative_area_level_1')) adminArea = c.short_name;
                if (c.types.includes('country')) country = c.long_name;
              }
            }

            let detectedLanguage: 'vi' | 'zh' | 'ko' | 'en' = 'en';
            const countryLower = country.toLowerCase();
            if (countryLower.includes('vietnam') || countryLower.includes('việt nam') || (lat >= 8.0 && lat <= 24.0 && lng >= 102.0 && lng <= 110.0)) {
              detectedLanguage = 'vi';
            } else if (countryLower.includes('korea') || countryLower.includes('한국') || (lat >= 33.0 && lat <= 39.0 && lng >= 124.5 && lng <= 131.5)) {
              detectedLanguage = 'ko';
            } else if (countryLower.includes('china') || countryLower.includes('taiwan') || countryLower.includes('hong kong') || countryLower.includes('macau') || countryLower.includes('中国') || (lat >= 18.0 && lat <= 53.6 && lng >= 73.5 && lng <= 135.0 && !(lat >= 33.0 && lat <= 39.0 && lng >= 124.5 && lng <= 131.5) && !(lat <= 24.0 && lng <= 110.0))) {
              detectedLanguage = 'zh';
            }

            const title = neighborhood || localityName || (adminArea ? `${adminArea}, ${country}` : 'Current Coordinates');

            return NextResponse.json({
              location: {
                name: title,
                address: address,
                formattedAddress: address,
                lat,
                lng,
                placeId: first.place_id || `place_${Date.now()}`,
                mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
                category: 'GPS Coordinate Pin',
                ambientVibe: 'Present Moment',
              },
              detectedLanguage,
              detectedCountry: country || 'Detected Region',
            });
          }
        }
      } catch (err) {
        console.warn('Google Maps Geocoding API error:', err);
      }
    }

    // Contextual GPS coordinate formatting
    const latStr = lat >= 0 ? `${lat.toFixed(4)}°N` : `${Math.abs(lat).toFixed(4)}°S`;
    const lngStr = lng >= 0 ? `${lng.toFixed(4)}°E` : `${Math.abs(lng).toFixed(4)}°W`;
    const formattedAddress = `${latStr}, ${lngStr}`;

    let fallbackLang: 'vi' | 'zh' | 'ko' | 'en' = 'en';
    let fallbackRegion = 'Global';
    if (lat >= 8.0 && lat <= 24.0 && lng >= 102.0 && lng <= 110.0) {
      fallbackLang = 'vi';
      fallbackRegion = 'Việt Nam (Vietnam)';
    } else if (lat >= 33.0 && lat <= 39.0 && lng >= 124.5 && lng <= 131.5) {
      fallbackLang = 'ko';
      fallbackRegion = '대한민국 (South Korea)';
    } else if (lat >= 18.0 && lat <= 53.6 && lng >= 73.5 && lng <= 135.0) {
      fallbackLang = 'zh';
      fallbackRegion = '中国 / 华人地区 (China / Region)';
    }

    return NextResponse.json({
      location: {
        name: `${fallbackRegion} Coordinates`,
        address: formattedAddress,
        formattedAddress,
        lat,
        lng,
        placeId: `geo_${Date.now()}`,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
        category: 'GPS Coordinate Pin',
        ambientVibe: 'Present Moment',
      },
      detectedLanguage: fallbackLang,
      detectedCountry: fallbackRegion,
    });
  } catch (error: unknown) {
    console.error('Maps geocode failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Failed to geocode location' }, { status: 500 });
  }
}
