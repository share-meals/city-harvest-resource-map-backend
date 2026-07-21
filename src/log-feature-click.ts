import {HttpFunction} from '@google-cloud/functions-framework';
import {BigQuery} from '@google-cloud/bigquery';
import {lookupGeo} from './geo';

const LOCAL = process.env.LOCAL === 'true';

interface FeatureClickRow {
  featureId: string | null;
  sessionId: string | null;
  lat: number | null;
  lng: number | null;
  language: string;
  osFamily: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  timestamp: Date;
}

export const logFeatureClick: HttpFunction = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const b = req.body || {};
  const geo = lookupGeo(req.headers['x-forwarded-for']);

  const row: FeatureClickRow = {
    featureId: b.id != null ? String(b.id) : null,
    sessionId: b.sessionId || null,
    // Full-precision — these are pantry locations, already public map data.
    lat: typeof b.lat === 'number' && isFinite(b.lat) ? parseFloat(b.lat.toFixed(8)) : null,
    lng: typeof b.lng === 'number' && isFinite(b.lng) ? parseFloat(b.lng.toFixed(8)) : null,
    language: b.language || 'en',
    osFamily: b.osFamily || null,
    city: geo.city,
    region: geo.region,
    country: geo.country,
    timestamp: new Date(),
  };

  if (LOCAL) {
    console.log('[LOCAL] featureClicks:', row);
    res.status(200).send('OK');
    return;
  }

  try {
    const bigquery = new BigQuery();
    await bigquery.dataset('resourceMap').table('featureClicks').insert(row);
  } catch (err: any) {
    console.error('[log-feature-click] BigQuery insert to "featureClicks" failed:', err?.errors?.[0] || err);
  }

  res.status(200).send('OK');
};
