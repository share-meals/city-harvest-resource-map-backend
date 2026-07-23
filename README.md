# city-harvest-resource-map-backend

Two Google Cloud Functions that log analytics events for the CH Map, writing to BigQuery.

- `log-geocode` — called when a user runs an address search. Writes one row to `geocodes` (with the coordinate) and one row to `searches` (with the derived classification). No raw address text is stored.
- `log-feature-click` — called when a user opens a pantry's details. Writes one row to `featureClicks`.

Companion repo: [share-meals/city-harvest-resource-map](https://github.com/share-meals/city-harvest-resource-map).

## Environments

| | Cloud Functions | BigQuery dataset | Front-end URL |
|---|---|---|---|
| **Production** | `log-geocode`, `log-feature-click` | `resourceMap` | `sm-ch-map.netlify.app` (+ iframe on cityharvest.org) |
| **Staging** | `log-geocode-staging`, `log-feature-click-staging` | `resourceMap_staging` | `sm-ch-map-staging.netlify.app` |

The functions pick the dataset by reading `process.env.ENV`. Staging deploys set `ENV=staging`; production leaves it unset and writes to `resourceMap`.

## Local dev

```bash
yarn install
yarn dev   # LOCAL=true — BigQuery calls are stubbed; rows just print
```

Dev server at `http://localhost:8080`. Send test payloads with `curl`.

## Deploy — production

```bash
yarn deploy   # both functions
```

Requires `gcloud` authed as an account with Cloud Functions deploy permission on the `city-harvest-423311` project.

## Deploy — staging

**One-time setup** (creates the staging dataset + tables):

```bash
bq --location=us mk --dataset city-harvest-423311:resourceMap_staging
# then apply schema/2026-07-privacy-refresh.sql to the new dataset,
# either via the BigQuery console or the bq CLI. See the file header.
```

**Deploy:**

```bash
yarn deploy:staging
```

Deploys `log-geocode-staging` and `log-feature-click-staging`, both with `ENV=staging`.

## Teardown — staging

The staging surface has a small but real cost tail if left running unattended (bot traffic → function invocations → API calls). To lock it down:

```bash
yarn teardown:staging   # deletes both staging Cloud Functions
```

For **complete** cost containment when staging is idle for a while, also disable the following in their respective dashboards (all one-click, reversible):

- **Google Maps API key** for staging — Google Cloud Console → APIs & Services → Credentials → click the key → **Disable key**. Prevents bot map/geocode traffic from consuming your $200/mo Google Maps credit.
- **Protomaps API key** for staging — Protomaps dashboard → the key → disable. Prevents bot tile fetches from burning your Protomaps quota.
- (Optional) **Netlify staging branch deploys** — Netlify → site → Site configuration → Build & deploy → Branches → pause the `staging` branch. Prevents accidental pushes from consuming build minutes.

What each teardown step does NOT touch:

- The `resourceMap_staging` **BigQuery dataset** — storage is a few cents per month at most and you may want the data. Remove manually with `bq rm -r -f -d city-harvest-423311:resourceMap_staging` if desired.
- The **Netlify site** itself — free, doesn't cost anything without traffic. Deleting it would lose env vars + build config.

## What each dataset table looks like

Post-privacy-refresh (see `schema/2026-07-privacy-refresh.sql`):

**`geocodes`** — one row per successful address search:
- `sessionId`, `lat` (truncated to 3 decimals, ~110m), `lng`, `language`, `osFamily`, `ipTruncated`, `locationType`, `timestamp`

**`featureClicks`** — one row per pantry-details open:
- `featureId`, `sessionId`, `lat`, `lng` (full precision — pantry data is public), `language`, `osFamily`, `ipTruncated`, `timestamp`

**`searches`** — one row per address search (including zero-result), separate from `geocodes` so search text patterns can't be joined to specific coordinates:
- `searchType`, `resultBucket`, `resolvedCity`, `resolvedRegion`, `resolvedBorough`, `resolvedCountry`, `language`, `osFamily`, `ipTruncated`, `timestamp`

`ipTruncated` is a CIDR string (`108.30.42.0/24` IPv4, `2001:db8:1234::/48` IPv6) matching Google Analytics' Universal Analytics anonymization convention. Analysts derive city/region/country from it on demand.

## Schema migration

New schema changes go in `schema/*.sql`. Run once against `resourceMap` for production and once against `resourceMap_staging` for staging (edit the dataset references or select the dataset in the BigQuery console before running).
