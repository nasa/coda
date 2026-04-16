# Artemis 2 IO Data Processing

Scripts and data for correcting and enriching Imagery Online (IO) metadata for Artemis 2.

## Subdirectories

### [videos/](videos/)

Video channel assignment. Maps each video to a CODA channel number using Mission Video Notes scraped from IO, source codes, and static overrides.

- `channel-overrides.json` — runtime, imported by `io-api.ts`
- `generate-channel-overrides.mjs` — generates overrides from scraped notes
- `scrape-io-notes.mjs` — scrapes Mission Video Notes from IO info pages
- `video-notes.json` — scraped video metadata (1,149 videos)

### [photos/](photos/)

Photo timezone corrections. IO stores camera-local timestamps as UTC; these tools determine the actual timezone per camera body and generate per-photo overrides.

- `photo-time-overrides.json` — runtime, imported by `io-photos.ts`
- `generate-photo-time-overrides.mjs` — generates overrides from scraped EXIF data
- `scrape-io-photo-metadata.mjs` — scrapes EXIF from IO info pages
- `photo-exif-metadata.json` — scraped EXIF data (3,066 ground photos)
- `seed-photo-timeshifts-api.mjs` — seeds default per-prefix timezone rules via API

See each subdirectory's README for detailed documentation.

## Quick Start

```bash
# Video channel overrides
node src/server/processing/artemis2/videos/scrape-io-notes.mjs
node src/server/processing/artemis2/videos/generate-channel-overrides.mjs

# Photo timezone overrides
node src/server/processing/artemis2/photos/scrape-io-photo-metadata.mjs
node src/server/processing/artemis2/photos/generate-photo-time-overrides.mjs

# Photo default rules (database seeding, requires running API)
node src/server/processing/artemis2/photos/seed-photo-timeshifts-api.mjs
```
