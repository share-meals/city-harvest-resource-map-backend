import {HttpFunction} from '@google-cloud/functions-framework';
import {BigQuery} from '@google-cloud/bigquery';
import {lookupGeo} from './geo';

const LOCAL = process.env.LOCAL === 'true';
const DATASET = 'resourceMap';

// Truncate coord to a ~110m grid so we never persist a home-precise
// location for a user's search.
function truncateCoord(n: number | null | undefined): number | null {
  if (typeof n !== 'number' || !isFinite(n)) return null;
  return Math.round(n * 1000) / 1000;
}

// Rows never carry the raw IP, the typed search text, or any join key
// linking the geocodes row to the searches row.

interface GeocodeRow {
  sessionId: string | null;
  lat: number | null;
  lng: number | null;
  language: string;
  osFamily: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  locationType: string | null;
  timestamp: Date;
}

interface SearchRow {
  searchType: string;
  resultBucket: 'NONE' | 'UNIQUE' | 'AMBIGUOUS';
  resolvedCity: string | null;
  resolvedRegion: string | null;
  resolvedBorough: string | null;
  resolvedCountry: string | null;
  language: string;
  osFamily: string | null;
  country: string | null;
  timestamp: Date;
}

export const logGeocode: HttpFunction = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const b = req.body || {};
  const geo = lookupGeo(req.headers['x-forwarded-for']);
  const language = b.language || 'en';
  const osFamily = b.osFamily || null;
  const timestamp = new Date();

  const searchRow: SearchRow = {
    searchType: typeof b.searchType === 'string' ? b.searchType : 'unknown',
    resultBucket: normalizeResultBucket(b.resultBucket),
    resolvedCity: b.resolvedCity || null,
    resolvedRegion: b.resolvedRegion || null,
    resolvedBorough: b.resolvedBorough || null,
    resolvedCountry: b.resolvedCountry || null,
    language,
    osFamily,
    country: geo.country,
    timestamp,
  };

  const rowsToInsert: Array<{table: string; row: GeocodeRow | SearchRow}> = [
    {table: 'searches', row: searchRow},
  ];

  // Zero-result searches skip the geocodes table (there's no coord to log).
  if (b.resultsFound !== false && typeof b.lat === 'number' && typeof b.lng === 'number') {
    const geocodeRow: GeocodeRow = {
      sessionId: b.sessionId || null,
      lat: truncateCoord(b.lat),
      lng: truncateCoord(b.lng),
      language,
      osFamily,
      city: geo.city,
      region: geo.region,
      country: geo.country,
      locationType: b.resolvedLocationType || null,
      timestamp,
    };
    rowsToInsert.push({table: 'geocodes', row: geocodeRow});
  }

  if (LOCAL) {
    for (const {table, row} of rowsToInsert) {
      console.log(`[LOCAL] ${table}:`, row);
    }
    res.status(200).send('OK');
    return;
  }

  const bigquery = new BigQuery();
  const ds = bigquery.dataset(DATASET);
  const inserts = await Promise.allSettled(
    rowsToInsert.map(({table, row}) => ds.table(table).insert(row))
  );

  for (let i = 0; i < inserts.length; i++) {
    const outcome = inserts[i];
    if (outcome.status === 'rejected') {
      // console.error so Cloud Logging picks these up at severity ERROR.
      // A log-based metric + alert policy on this will page us on real
      // insert failures.
      const table = rowsToInsert[i].table;
      const err: any = outcome.reason;
      console.error(`[log-geocode] BigQuery insert to "${table}" failed:`, err?.errors?.[0] || err);
    }
  }

  res.status(200).send('OK');
};

function normalizeResultBucket(v: unknown): 'NONE' | 'UNIQUE' | 'AMBIGUOUS' {
  if (v === 'NONE' || v === 'UNIQUE' || v === 'AMBIGUOUS') return v;
  return 'NONE';
}
