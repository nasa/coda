# Artemis 2 IO Data Processing

Scripts for correcting and enriching Imagery Online (IO) metadata for Artemis 2.

## Subdirectories

### [videos/](videos/)

Video channel assignment. Maps each video to a CODA channel number using Mission Video Notes scraped from IO, source codes, and per-asset overrides.

- `scrape-io-notes.mjs` — scrapes Mission Video Notes from IO info pages → `video-notes.json`
- `generate-channel-overrides.mjs` — classifies recovery/aircraft feeds → `channel-overrides.json`
- `video-notes.json`, `channel-overrides.json` — generator output (gitignored)

### [photos/](photos/)

Photo timezone corrections. IO stores camera-local timestamps as UTC; these tools determine the actual timezone per camera body and generate per-photo overrides.

- `scrape-io-photo-metadata.mjs` — scrapes EXIF from IO info pages → `photo-exif-metadata.json`
- `generate-photo-time-overrides.mjs` — generates `{ nasa_id: ±hh:mm:ss }` map → `photo-time-overrides.json`
- `photo-exif-metadata.json`, `photo-time-overrides.json` — generator output (gitignored)
- `seed-photo-timeshifts-api.mjs` — seeds default per-prefix timezone rules via API (legacy)

## How Overrides Reach Production

The generator scripts produce JSON files locally. Those files are **not committed** — they're loaded into Postgres via the [Per-Asset Overrides admin page](/admin/assetOverrides) (`asset_override_db` table) by pasting the JSON into the upsert form. At runtime, [io-photos.ts](../io-photos.ts) and [io-videos.ts](../io-videos.ts) call `getAssetOverridesForDate(mediaType, source, requestedDate)` from [routes/db/assetOverrides.ts](../../express/routes/db/assetOverrides.ts) to fetch the merged map for the request's `mediaType` (`photo-time` or `video-channel`), `source`, and date. Whatever date range the DB row covers is the only gate — there is no hard-coded mission window in code.

## Running the Generators

```bash
# Video channel overrides (~2 min for the scrape, instant generate)
node src/server/processing/artemis2/videos/scrape-io-notes.mjs
node src/server/processing/artemis2/videos/generate-channel-overrides.mjs

# Photo timezone overrides (~5 min for the scrape, instant generate)
node src/server/processing/artemis2/photos/scrape-io-photo-metadata.mjs
node src/server/processing/artemis2/photos/generate-photo-time-overrides.mjs

# Photo default rules — legacy, seeds the older PhotoTimeShifts_db table.
# Not used for the new per-asset override flow.
node src/server/processing/artemis2/photos/seed-photo-timeshifts-api.mjs
```

After running a generator, open [/admin/assetOverrides](/admin/assetOverrides) → **Create** (or **Edit** the existing row), paste the JSON output into the **Override JSON** field, set:

- `mediaType` = `video-channel` or `photo-time`
- `source` = `ARTEMIS`
- `startDate` = `2026-04-01`, `endDate` = `2026-04-13` (Artemis 2 mission window)

…then **Save**. Re-run a generator and re-paste only when the underlying IO metadata changes (new videos/photos added, camera assignments revised).
