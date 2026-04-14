# Artemis 2 Video Channel Mapping

## Quick Start

```bash
# Step 1: Scrape video metadata + Mission Video Notes from IO (requires IO_KEY in .env)
node src/server/processing/artemis2/scrape-io-notes.mjs

# Step 2: Generate channel-overrides.json from the scraped notes
node src/server/processing/artemis2/generate-channel-overrides.mjs
```

Step 1 hits the IO API and then scrapes each video's info page (~2 minutes for 1,149 videos).
Step 2 is instant — it reads `video-notes.json` and writes `channel-overrides.json`.

Re-run both if IO data changes. `channel-overrides.json` is imported at runtime by `io-api.ts`.

## Files

| File | Purpose | Runtime? |
|------|---------|----------|
| `channel-overrides.json` | Per-video channel assignments for recovery/aircraft feeds | Yes (imported by io-api.ts) |
| `video-notes.json` | All 1,149 videos with scraped Mission Video Notes | No (input for generate script) |
| `scrape-io-notes.mjs` | Fetches video list from IO API + scrapes notes from info pages | Script |
| `generate-channel-overrides.mjs` | Reads video-notes.json, classifies feeds, writes channel-overrides.json | Script |

## How Channel Assignment Works

Most videos are assigned a CODA channel programmatically in `io-api.ts` (`getArtemisChannel`):

1. **Static overrides** — look up `nasa_id` in `channel-overrides.json`
2. **Collection string** — if `Downlink|Channel XX` exists, use that channel (channels 1-4)
3. **Source code fallback** — parse the 3-digit source from the nasa_id:
   - 101-104 → channels 1-4
   - 150 → channel 5
   - 120 → channel 6
   - 136-138 → channel 7

The static overrides handle videos that can't be resolved by steps 2-3 — primarily
recovery-phase source 150 feeds that share a source code but are different cameras.

## Channel Map

### Main Flight (FD02-FD09)

| Channel | Source | How Identified |
|---------|--------|----------------|
| 1 | Downlink Channel 01 | `Downlink\|Channel 01` in collection_string or source 101 |
| 2 | Downlink Channel 02 | `Downlink\|Channel 02` in collection_string or source 102 |
| 3 | Downlink Channel 03 | `Downlink\|Channel 03` in collection_string or source 103 |
| 4 | Downlink Channel 04 | `Downlink\|Channel 04` in collection_string or source 104 |
| 5 | NASA TV | Source code 150 |
| 6 | Onboard camera clips | Source code 120 |
| 7 | FCR Cameras | Source codes 136-138 |

### Launch Phase (April 1, 16:59 - April 2, 06:00 UTC)

| Channel | Source | Content |
|---------|--------|---------|
| 1 | Source 101 | Downlink Ch01 (categorized as Prelaunch/Launch in IO) |
| 2 | Source 102 | Downlink Ch02 (categorized as Prelaunch/Launch in IO) |
| 3 | Source 103 | Downlink Ch03 (categorized as Prelaunch/Launch in IO) |
| 4 | Source 104 | Downlink Ch04 (starts at 00:53 UTC Apr 2) |
| 5 | Source 150 | NASA TV continuous coverage |
| 6 | Source 120 | Onboard camera clips (up to 10 concurrent during launch) |
| 7 | Source 200 | WB-57 aircraft footage (static override) |
| 8 | Sources 136-138 | FCR Cameras (only during TLI burn window) |

### Recovery Phase (April 10, 20:00 - April 11, 04:00 UTC)

Recovery is the most complex phase. Downlink Ch01-02 end around 22:11 UTC, after
which multiple broadcast and aircraft feeds begin. All channel assignments below come
from static overrides (generated from Mission Video Notes).

| Channel | Feed Type | Source | Notes |
|---------|-----------|--------|-------|
| 1 | Downlink Ch01 | 101 | Active until ~22:11 UTC |
| 2 | Downlink Ch02 | 102 | Active until ~22:11 UTC |
| 3 | SCIFLI aircraft | 160 | Gulfstream GV, reuses empty Ch03 |
| 4 | WB-57 aircraft | 201 | High-altitude footage, reuses empty Ch04 |
| 5 | NASA broadcast | 150 | Continuous Coverage / PAO / News Conference |
| 6 | Quad Feed from Carrier | 150 | Multi-camera quad view from USS Portland |
| 7 | Helo feed 1 | 150 | Helicopter camera 1 |
| 8 | Helo feed 2 | 150 | Helicopter camera 2 |

## Override Generation Rules

`generate-channel-overrides.mjs` uses these rules to classify source 150 recovery feeds:

```
Notes match /Quad Feed/i         → Channel 6
Notes match /Helo feed.*1/i      → Channel 7
Notes match /Helo feed.*2/i      → Channel 8
Everything else (source 150)     → Channel 5  (NASA broadcast / PAO / News Conference)
```

Aircraft footage is classified by source code:
```
Source 160 (SCIFLI)               → Channel 3
Source 200 (WB-57, launch)        → Channel 7
Source 201 (WB-57, recovery)      → Channel 4
```

## Background

### NASA ID Format

```
art002m1010912337
 |   |  |   |  |
 |   |  |   |  +-- Time: 23:37 UTC
 |   |  |   +----- GMT Day: 091
 |   |  +--------- Source Code: 101 (3 digits, vs ISS's 2)
 |   +------------ m = moving imagery (video)
 +---------------- art002 = Artemis II
```

Letter suffixes (A, B, C, D) indicate different camera angles or feed variants.
The "B" suffix does NOT mean duplicate — A and B are often completely different feeds.

### Source Codes

| Source Code | Camera/Feed | Count | Description |
|-------------|-------------|-------|-------------|
| **101** | Downlink Channel 01 | 323 | Primary exterior/interior camera feed |
| **102** | Downlink Channel 02 | 335 | Secondary camera feed |
| **103** | Downlink Channel 03 | 85 | PAO events, crew communications |
| **104** | Downlink Channel 04 | 23 | DockCam, specialty feeds |
| **120** | Onboard cameras | 76 | Raw clips from 10 physical cameras |
| **136-138** | FCR Cameras HD1-3 | 6 | White Flight Control Room views |
| **150** | NASA TV / Broadcast | 286 | NASA TV, PAO, carrier feeds, helicopter feeds |
| **160** | SCIFLI Aircraft | 3 | Gulfstream GV during splashdown |
| **200** | WB-57 (Launch) | 5 | High-altitude aircraft during launch |
| **201** | WB-57 (Recovery) | 5 | High-altitude aircraft during splashdown |

### Source 120 Physical Cameras

| Camera | Type | Description |
|--------|------|-------------|
| cmacma1/2 | Exterior | Crew Module Assembly cameras |
| cmasaw1/2/3/4 | Exterior | CMA Solar Array Wing cameras |
| cmcab1/2/3 | Interior | Crew Module Cabin cameras |
| IMG | Handheld | Crew handheld clips |

### IO Collection Issues

IO organizes Artemis 2 videos poorly for our purposes:

1. **Prelaunch/Launch** contains sources 101-103 — the same downlink channels, just
   categorized separately. Resolved by source code fallback.
2. **FD01-FD10** folders are mostly NASA TV (source 150), not marked in the "NASA TV"
   collection. Only 5 of ~286 source 150 videos are in the actual NASA TV collection.
3. **Landing/Recovery** lumps all source 150 feeds together despite being different cameras.
   Resolved by static overrides using Mission Video Notes.
