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

### [pcd_audio/](pcd_audio/)

Crew PCD (Personal Crew Device) audio recordings. The PCD laptops (PLT, MS2, PCD3) run a Voice Recorder app that saves M4A files. IO stores these as photo-type assets with an attached MP3. The script enriches each recording with a computed start time: `startTime = creation_time − duration` (the M4A `creation_time` tag is set at save time, i.e. the end of the recording).

- `fetch-audio-metadata.mjs` — fetches recordings from IO collections, probes timing via ffprobe → `pcd-audio.json`
- `pcd-audio.json` — generator output (gitignored)

## How Data Reaches Production

### Photo & video overrides (`asset_override_db`)

The generator scripts produce JSON files locally. Those files are **not committed** — they're loaded into Postgres via the [Per-Asset Overrides admin page](/admin/assetOverrides) (`asset_override_db` table) by pasting the JSON into the upsert form. At runtime, [io-photos.ts](../io-photos.ts) and [io-videos.ts](../io-videos.ts) call `getAssetOverridesForDate(mediaType, source, requestedDate)` from [routes/db/assetOverrides.ts](../../express/routes/db/assetOverrides.ts) to fetch the merged map for the request's `mediaType` (`photo-time` or `video-channel`), `source`, and date. Whatever date range the DB row covers is the only gate — there is no hard-coded mission window in code.

### PCD audio (`pcd_audio_db`)

`pcd-audio.json` is loaded into Postgres via the [PCD Audio admin page](/admin/pcdAudio) (`pcd_audio_db` table) by pasting the full JSON output into the form. At runtime, the socket server fetches the most recent record for the `ARTEMIS` source and emits it to connected clients. The PCD Audio pane date gate is derived dynamically from the earliest and latest `startTime` values across all recordings — there is no hard-coded date range in code.

## Running the Generators

```bash
# Video channel overrides (~2 min for the scrape, instant generate)
node src/server/processing/artemis2/videos/scrape-io-notes.mjs
node src/server/processing/artemis2/videos/generate-channel-overrides.mjs

# Photo timezone overrides (~5 min for the scrape, instant generate)
node src/server/processing/artemis2/photos/scrape-io-photo-metadata.mjs
node src/server/processing/artemis2/photos/generate-photo-time-overrides.mjs

# PCD audio metadata (requires ffprobe; fast if local M4A files are present)
node src/server/processing/artemis2/pcd_audio/fetch-audio-metadata.mjs

# Photo default rules — legacy, seeds the older PhotoTimeShifts_db table.
# Not used for the new per-asset override flow.
node src/server/processing/artemis2/photos/seed-photo-timeshifts-api.mjs
```

After running a generator:

**Photo/video overrides** — open [/admin/assetOverrides](/admin/assetOverrides) → **Create** (or **Edit** the existing row), paste the JSON output into the **Override JSON** field, set:

- `mediaType` = `video-channel` or `photo-time`
- `source` = `ARTEMIS`
- `startDate` = `2026-04-01`, `endDate` = `2026-04-13` (Artemis 2 mission window)

**PCD audio** — open [/admin/pcdAudio](/admin/pcdAudio) → **Add PCD Audio** (or **Edit** the existing record), paste the full `pcd-audio.json` output into the **Audio JSON** field, set `source` = `ARTEMIS`.

Re-run a generator and re-paste only when the underlying IO metadata changes (new recordings added, timing corrections applied).
