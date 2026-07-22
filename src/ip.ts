// Truncates the client IP to a network prefix, matching the convention
// Google Analytics (Universal Analytics) used with `_anonymizeIp`:
//   IPv4  →  /24  (last octet zeroed; ~256 addresses in the same block)
//   IPv6  →  /48  (last 80 bits zeroed; usually the ISP allocation)
//
// The truncated form is stored in BigQuery as a CIDR string, e.g.
//   "108.30.42.0/24"
//   "2001:db8:1::/48"
// Analysts derive geo (city/region/country) from these prefixes on
// demand — the Cloud Function itself never loads a GeoIP database.

function normalizeXff(raw: string | string[] | undefined): string | null {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (!first) return null;
  return first.split(',')[0].trim() || null;
}

function truncateIpv4(ip: string): string | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n < 0 || n > 255) return null;
  }
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

// Expand an IPv6 string with `::` shorthand into 8 hextets so we can
// truncate consistently. Returns null on invalid input.
function expandIpv6(ip: string): string[] | null {
  // Strip zone id (e.g. "fe80::1%eth0")
  const cleaned = ip.split('%')[0];
  const doubleColonHits = cleaned.split('::');
  if (doubleColonHits.length > 2) return null;
  const left = doubleColonHits[0] ? doubleColonHits[0].split(':') : [];
  const right = doubleColonHits.length === 2 && doubleColonHits[1]
    ? doubleColonHits[1].split(':')
    : [];
  const zerosNeeded = 8 - left.length - right.length;
  if (zerosNeeded < 0) return null;
  const middle = Array(zerosNeeded).fill('0');
  const groups = [...left, ...middle, ...right];
  if (groups.length !== 8) return null;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
  }
  return groups;
}

function truncateIpv6(ip: string): string | null {
  const groups = expandIpv6(ip);
  if (!groups) return null;
  // Keep first 3 groups (48 bits), zero the rest.
  return `${groups[0]}:${groups[1]}:${groups[2]}::/48`;
}

// Public entry: reads x-forwarded-for, returns the truncated CIDR string
// or null if the header is missing / malformed.
export function truncateIp(rawForwardedFor: string | string[] | undefined): string | null {
  const ip = normalizeXff(rawForwardedFor);
  if (!ip) return null;
  if (ip.includes('.') && !ip.includes(':')) return truncateIpv4(ip);
  if (ip.includes(':')) return truncateIpv6(ip);
  return null;
}
