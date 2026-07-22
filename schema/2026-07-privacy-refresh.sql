-- BigQuery migration for the privacy refresh.
--
-- This file operates on the `resourceMap` dataset. Run it once against
-- production, and once against `resourceMap_staging` (creating the
-- staging dataset first if it does not yet exist).
--
-- Create the staging dataset with:
--   bq --location=us mk --dataset city-harvest-423311:resourceMap_staging
--
-- Deploy order for either environment:
--   1. Run this file (adds columns + creates the new table).
--   2. Deploy the new Cloud Function code — it starts writing the new
--      columns and to the searches table. Legacy `address` and
--      `ipAddress` columns are left untouched; new rows have NULL there.
--   3. Confirm new rows look right, no `console.error` alerts firing.
--   4. Optionally: drop the legacy columns once you're sure. (Commented
--      out below.)
--
-- No rows are altered by this file. Legacy data preserved for archive.
--
-- To apply to staging, edit `resourceMap` → `resourceMap_staging` in
-- every reference below, or run each statement in the BQ console with
-- the staging dataset selected.

-- geocodes: relax `address` (new code no longer sends it), add the
-- session/language columns that were missing from the live schema (BigQuery
-- has been silently dropping them from writes), and add the new columns
-- the privacy-refresh code writes.
--
-- Note: we store `ipTruncated` — a CIDR string like "108.30.42.0/24"
-- (IPv4) or "2001:db8:1234::/48" (IPv6), matching Google Analytics'
-- Universal Analytics `_anonymizeIp` convention. Geo (city / region /
-- country) is derived by analysts on demand from the truncated prefix.
ALTER TABLE `resourceMap.geocodes`
  ALTER COLUMN address DROP NOT NULL;

ALTER TABLE `resourceMap.geocodes`
  ADD COLUMN IF NOT EXISTS sessionId     STRING,
  ADD COLUMN IF NOT EXISTS language      STRING,
  ADD COLUMN IF NOT EXISTS osFamily      STRING,
  ADD COLUMN IF NOT EXISTS ipTruncated   STRING,
  ADD COLUMN IF NOT EXISTS locationType  STRING;

-- featureClicks: same missing columns + ipTruncated (no locationType —
-- pantry data is public).
ALTER TABLE `resourceMap.featureClicks`
  ADD COLUMN IF NOT EXISTS sessionId    STRING,
  ADD COLUMN IF NOT EXISTS language     STRING,
  ADD COLUMN IF NOT EXISTS osFamily     STRING,
  ADD COLUMN IF NOT EXISTS ipTruncated  STRING;

-- searches: new table. Sparse by design — no sessionId, no coord,
-- no raw text. Populated on every /log-geocode call including zero-result
-- searches (where searchType = 'unknown' and resultBucket = 'NONE').
CREATE TABLE IF NOT EXISTS `resourceMap.searches` (
  searchType        STRING    NOT NULL,
  resultBucket      STRING    NOT NULL,   -- 'NONE' | 'UNIQUE' | 'AMBIGUOUS'
  resolvedCity      STRING,
  resolvedRegion    STRING,
  resolvedBorough   STRING,
  resolvedCountry   STRING,
  language          STRING    NOT NULL,
  osFamily          STRING,
  ipTruncated       STRING,                -- /24 IPv4 or /48 IPv6 CIDR
  timestamp         TIMESTAMP NOT NULL
)
PARTITION BY DATE(timestamp);

-- Optional cleanup step (run AFTER verifying new code writes correctly
-- and you're ready to stop retaining raw address / IP in these tables).
-- Uncomment when ready:
--
-- ALTER TABLE `resourceMap.geocodes`       DROP COLUMN IF EXISTS address, DROP COLUMN IF EXISTS ipAddress;
-- ALTER TABLE `resourceMap.featureClicks`  DROP COLUMN IF EXISTS ipAddress;
