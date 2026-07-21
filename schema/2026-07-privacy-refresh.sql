-- BigQuery migration for the privacy refresh.
-- Run against the `resourceMap` dataset.
--
-- Deploy order:
--   1. Run this file (adds columns + creates the new table).
--   2. Deploy the new Cloud Function code — it starts writing to the
--      new columns and to the searches table. Legacy columns
--      (address, ipAddress) are left untouched; new rows have NULL there.
--   3. Confirm new rows look right, no `console.error` alerts firing.
--   4. Optionally: drop the legacy columns once you're sure. (Commented
--      out below.)
--
-- No rows are altered by this file. Legacy data preserved for archive.

-- geocodes: add osFamily, IP-derived location, and Google's location_type.
ALTER TABLE `resourceMap.geocodes`
  ADD COLUMN IF NOT EXISTS osFamily      STRING,
  ADD COLUMN IF NOT EXISTS city          STRING,
  ADD COLUMN IF NOT EXISTS region        STRING,
  ADD COLUMN IF NOT EXISTS country       STRING,
  ADD COLUMN IF NOT EXISTS locationType  STRING;

-- featureClicks: same enrichment (no locationType — pantry data is public).
ALTER TABLE `resourceMap.featureClicks`
  ADD COLUMN IF NOT EXISTS osFamily  STRING,
  ADD COLUMN IF NOT EXISTS city      STRING,
  ADD COLUMN IF NOT EXISTS region    STRING,
  ADD COLUMN IF NOT EXISTS country   STRING;

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
  country           STRING,                -- derived from client IP
  timestamp         TIMESTAMP NOT NULL
);

-- Optional cleanup step (run AFTER verifying new code writes correctly
-- and you're ready to stop retaining raw address / IP in these tables).
-- Uncomment when ready:
--
-- ALTER TABLE `resourceMap.geocodes`       DROP COLUMN IF EXISTS address, DROP COLUMN IF EXISTS ipAddress;
-- ALTER TABLE `resourceMap.featureClicks`  DROP COLUMN IF EXISTS ipAddress;
