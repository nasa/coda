# Artemis 2 Video Channel Mapping

## The Problem

IO organizes Artemis 2 video into a collection hierarchy that doesn't map cleanly to CODA's channel model. CODA needs each video assigned to one of 8 channels so the timeline can display them as parallel streams. IO's organization has structural problems, inconsistent categorization, and ambiguous metadata that required scraping, manual classification, and static overrides to resolve.

## How the Channel Assignment Works

`io-api.ts` (`getArtemisChannel`) resolves each video to a channel using three tiers:

1. **Static overrides** — `channel-overrides.json`, a `{ nasa_id: channel }` lookup for the 43 videos that can't be resolved programmatically
2. **Collection string** — if `Downlink|Channel XX` exists in the IO collection path, use that channel (1–4)
3. **Source code fallback** — parse the 3-digit source from the nasa_id and map: 101–104 → Ch 1–4, 150 → Ch 5, 120 → Ch 6, 136–138 → Ch 7

Videos that don't match any tier get `downlink = -1` (non-channel, shown in the "Video Non-Downlink" component).

## IO Data Issues

### Issue 1: NASA ID format differs from ISS

ISS videos use `iss{exp}m{source}` with a 2-digit source code. Artemis uses `art{mission}m{source}` with a **3-digit** source code. The existing `isDownlinkVideo()` function only matches `iss` and `sts` prefixes, so it returns `false` for all Artemis videos. Channel assignment for Artemis bypasses `isDownlinkVideo()` entirely and uses `getArtemisChannel()`.

```
ISS:     iss060m01 2311234      source = 01 (2 digits)
Artemis: art002m101 0912337     source = 101 (3 digits)
```

### Issue 2: Prelaunch/Launch videos are downlink channels in disguise

20 videos with source codes 101–103 are categorized by IO under `Prelaunch/Launch` instead of `Downlink|Channel XX`. These are the same camera feeds as Downlink Ch01–03, just from before and during launch (16:59–23:42 UTC on April 1). IO chose to categorize them by mission phase rather than by signal source.

Without the source code fallback, these videos would get `downlink = -1` and not appear on any channel, leaving a gap in Ch01–03 coverage during the most important part of the mission.

| Source | In `Downlink\|Channel` | In `Prelaunch/Launch` | Total |
|--------|------------------------|----------------------|-------|
| 101    | 317                    | 6                    | 323   |
| 102    | 329                    | 6                    | 335   |
| 103    | 77                     | 8                    | 85    |
| 104    | 23                     | 0                    | 23    |

### Issue 3: FD01–FD10 folders are mostly NASA TV, not flight day highlights

IO created `FD01` through `FD10` subcollections that suggest curated flight-day content. In reality, 250 of the 277 videos in these folders are NASA TV continuous coverage feeds (source 150) — hour-long broadcast recordings chopped into segments.

Only 3 of the 286 source-150 videos are in the actual `NASA TV` collection. The other 283 are buried in FD folders or `Prelaunch/Launch` or `Landing/Recovery`, with no indication in the collection path that they're broadcast footage.

The source code fallback (150 → Ch 5) catches all of these regardless of which IO folder they're in.

### Issue 4: "Mission Video Notes" is not in the API

The IO search API returns `md_title` and `description` for each video, but many videos (especially source 120 onboard camera clips and recovery feeds) have both fields blank. The only useful metadata is in the "Mission Video Notes" field, which is **only visible on individual info.cfm web pages** — it is not returned by the search API.

We had to scrape all 1,149 individual video pages to extract this field. Without it, the 76 source-120 camera clips are unidentifiable (no title, no description), and the 30 recovery-phase source-150 feeds are indistinguishable from each other.

Example — `art002m1200912239A` (source 120, no title, no description):
```
Mission Video Notes: "Folder: Core-Separation-Batch-2 | File: cmasaw1_20260401224358 |
  View of Core Seperation [Pre-cleared NEC]"
```

This tells us the camera name (`cmasaw1` — CMA Solar Array Wing Camera 1), the event (core separation), and clearance status — none of which appears in the API.

### Issue 5: Recovery feeds share a source code but are different cameras

During recovery (April 10–11), source code 150 represents **6 different camera feeds** running simultaneously:

| Feed | Description | Videos |
|------|-------------|--------|
| Continuous Coverage | NASA TV broadcast (Parts 215–221) | 6 |
| NASA + SplashDown Coverage | Main NASA broadcast feed | 5 |
| PAO Event | Public Affairs Office UHD recording | 5 |
| Quad Feed from Carrier | Multi-camera quad view from USS Portland | 5 |
| Helo feed 1 | Helicopter camera 1 | 3 |
| Helo feed 2 | Helicopter camera 2 | 4 |
| Post-Splashdown News Conference | Press conference | 2 |

All 30 videos have `source_code = 150` and `category = Landing/Recovery` in the API. The only way to distinguish them is the scraped Mission Video Notes field. The `generate-channel-overrides.mjs` script classifies them by regex matching on the notes text.

### Issue 6: The "B" suffix does NOT mean duplicate

38 videos have a `B` suffix on their nasa_id (e.g., `art002m1501002220B`). In 24 of these cases, the A and B versions are **completely different feeds** — not alternate encodes or backups.

Examples from recovery:

| nasa_id | A version | B version |
|---------|-----------|-----------|
| `art002m1501002220` | NASA + SplashDown Coverage Feed | Quad Feed from Carrier |
| `art002m1501002258` | PAO Event (UHD) | Helo feed 2 |
| `art002m1501002359` | Helo feed 1 | PAO Continuous Coverage Part 219 |

For source-120 onboard clips, A and B are typically different physical cameras filming the same event from different angles (e.g., `cmacma1` vs `cmacma2`). These need to be on the same channel since they represent alternate views, not parallel streams.

### Issue 7: Aircraft footage uses unique source codes with no IO categorization

Three source codes appear only during launch and recovery for aircraft-based imaging:

| Source | Aircraft | Phase | Videos | IO Category |
|--------|----------|-------|--------|-------------|
| 160 | SCIFLI Gulfstream GV | Recovery | 3 | Landing/Recovery |
| 200 | WB-57 | Launch | 5 | Prelaunch/Launch |
| 201 | WB-57 | Recovery | 5 | Landing/Recovery |

IO lumps these into the same categories as everything else. They need static overrides to be assigned to channels where they don't overlap with active downlink feeds:
- Source 160 → Channel 3 (reuses empty Ch03 during recovery)
- Source 201 → Channel 4 (reuses empty Ch04 during recovery)
- Source 200 → Channel 7 (no conflict during launch)

### Issue 8: Two videos have non-standard nasa_ids

Two Blue FCR (Flight Control Room) camera recordings of the Trans Lunar Injection burn use JSC-style nasa_ids instead of the Artemis `art` prefix:

| nasa_id | Title | Duration | Collection |
|---------|-------|----------|------------|
| `jsc2026m000326` | Artemis 2 Trans Lunar Injection Burn | 60 min | `FCR Cameras` |
| `jsc2026m000327` | Artemis 2 Trans Lunar Injection Burn | 65 min | `FCR Cameras` |

Both start at `2026-04-02T22:55:00Z` and show views from the Blue FCR during TLI burn ops. They sit alongside the 6 `art002m136/137/138` FCR videos (which use the standard prefix and are resolved to Channel 7 by source code fallback), but because `jsc2026m` doesn't match the `art\d{3}m(\d{3})` regex, these two fall through all three resolution tiers and get `downlink = -1`. They have no Mission Video Notes (the scrape returned null). They could be added to `channel-overrides.json` manually if needed.

## Channel Map

### Channels 1–4: Downlink (all phases)

Real spacecraft-to-ground video feeds. IO organizes these well under `Downlink|Channel XX`, except for 20 Prelaunch/Launch videos resolved by source code fallback.

### Channel 5: NASA TV / Broadcast (all phases)

All source-150 videos during main flight and launch. During recovery, only the broadcast-type feeds (Continuous Coverage, PAO, NASA + SplashDown, News Conference). 256 resolved by source code fallback, 18 by static override.

### Channel 6: Onboard Camera Clips (launch) / Quad Feed (recovery)

During launch: 76 source-120 clips from 10 physical cameras (cmacma1/2, cmasaw1/2/3/4, cmcab1/2/3, IMG). Up to 10 concurrent during the launch window (22:22–22:59 UTC). Resolved by source code fallback.

During recovery: 5 Quad Feed from Carrier videos. Resolved by static override (notes match `/Quad Feed/i`).

### Channel 7: WB-57 (launch) / Helo Feed 1 (recovery)

During launch: 5 WB-57 high-altitude aircraft videos (source 200). Resolved by static override.

During recovery: 3 Helicopter camera 1 videos. Resolved by static override (notes match `/Helo feed.*1/i`).

### Channel 8: Helo Feed 2 (recovery only)

4 Helicopter camera 2 videos. Resolved by static override (notes match `/Helo feed.*2/i`).

## Override Summary

| Resolution Method | Videos | Description |
|-------------------|--------|-------------|
| Collection string `Downlink\|Channel XX` | 746 | Downlink channels 1–4, well-categorized by IO |
| Source code fallback (101–104) | 20 | Downlink channels miscategorized as Prelaunch/Launch |
| Source code fallback (150) | 256 | NASA TV scattered across FD folders |
| Source code fallback (120) | 76 | Onboard camera clips in FD/Prelaunch folders |
| Source code fallback (136–138) | 6 | FCR cameras |
| Static override (recovery 150) | 30 | Recovery feeds classified by Mission Video Notes |
| Static override (aircraft) | 13 | Sources 160, 200, 201 assigned to empty channels |
| Unresolved (`downlink = -1`) | 2 | Non-standard `jsc2026m` prefix FCR videos |
| **Total** | **1,149** | |

## File Inventory

| File | Purpose | Runtime? |
|------|---------|----------|
| `channel-overrides.json` | Per-video channel assignments (43 entries) | **Yes** (imported by `io-api.ts`) |
| `video-notes.json` | All 1,149 videos with scraped Mission Video Notes | Data |
| `generate-channel-overrides.mjs` | Classifies recovery/aircraft feeds, writes `channel-overrides.json` | Script |
| `scrape-io-notes.mjs` | Scrapes Mission Video Notes from IO info pages | Script |

## Regenerating Overrides

If IO data changes (new videos added, collections reorganized):

```bash
# 1. Re-scrape Mission Video Notes from IO (~2 minutes, 1,149 pages)
node src/server/processing/artemis2/videos/scrape-io-notes.mjs

# 2. Regenerate channel overrides from scraped notes (instant)
node src/server/processing/artemis2/videos/generate-channel-overrides.mjs
```
