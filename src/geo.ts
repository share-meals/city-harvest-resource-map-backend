import geoip from 'geoip-lite';

export interface GeoInfo {
  city: string | null;
  region: string | null;
  country: string | null;
}

const EMPTY: GeoInfo = {city: null, region: null, country: null};

// Normalize the potentially-multi-hop x-forwarded-for header down to
// the original client IP. When a request is proxied (Cloud Load Balancer
// in front of Cloud Functions), x-forwarded-for is a comma-separated
// list with the client's IP as the first entry.
function extractClientIp(raw: string | string[] | undefined): string | null {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (!first) return null;
  return first.split(',')[0].trim() || null;
}

// Look up city/region/country from an IP. Never surfaces the IP itself.
// Returns nulls when the IP is missing, private, or not in the DB.
export function lookupGeo(rawForwardedFor: string | string[] | undefined): GeoInfo {
  const ip = extractClientIp(rawForwardedFor);
  if (!ip) return EMPTY;
  const g = geoip.lookup(ip);
  if (!g) return EMPTY;
  return {
    city: g.city || null,
    region: g.region || null,
    country: g.country || null,
  };
}
