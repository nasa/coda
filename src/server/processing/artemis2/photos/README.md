# Artemis 2 Photo Timezone Corrections

## The Problem

Imagery Online (IO) stores photo timestamps in `md_creation_date` using the camera's local time as if it were UTC. The camera writes `DateTimeOriginal: 2026:04:10 17:06:20` (local time, no timezone), and IO ingests this as `2026-04-10T17:06:20Z`. The actual UTC time depends on where the photographer was.

## How the Correction Works

`photo-time-overrides.json` is a flat `{ nasa_id: timeOffset }` lookup imported by `io-photos.ts`. For each photo, if the nasa_id exists in the map, the offset is subtracted from `md_creation_date` to produce the correct UTC time. Photos not in the map are left uncorrected.

`io-photos.ts` also fetches the previous day's photos from IO, because a late-evening local-time photo (e.g., 22:00 CDT) shifts past midnight when corrected to UTC (03:00 UTC the next day). After correction, photos that don't fall on the requested UTC day are filtered out.

## How the Timezone Offset Was Determined

### The key evidence: EXIF `DigitalCreationTime`

IO's info page for each photo includes a camera data table with raw EXIF fields. The critical field is `DigitalCreationTime` (or `TimeCreated`), which preserves the timezone offset the camera was set to. The timezone-naive `DateTimeOriginal` does not.

**Example — jsc2026e022262 (Josh Valcarcel, San Diego, recovery day):**

| Field                        | Value                  | What it tells us                      |
| ---------------------------- | ---------------------- | ------------------------------------- |
| `md_creation_date` (IO)      | `2026-04-10T17:06:20Z` | IO stored 17:06:20 as UTC — **wrong** |
| `DateTimeOriginal` (EXIF)    | `2026:04:10 17:06:20`  | Camera local time, no timezone        |
| `DigitalCreationTime` (EXIF) | `17:06:20-07:00`       | **Camera was set to UTC-7 (PDT)**     |
| Correct UTC                  | `2026-04-11T00:06:20Z` | 17:06:20 + 7 hours                    |

The `-07:00` suffix on `DigitalCreationTime` is the proof: `DateTimeOriginal` and `md_creation_date` contain the same digits (17:06:20), confirming IO copied the local time verbatim. The offset tells us how far off it is.

**Contrast with jsc2026e022271 (Robert Markowitz, Houston, same day):**

| Field                     | Value                  |
| ------------------------- | ---------------------- |
| `md_creation_date` (IO)   | `2026-04-11T14:57:48Z` |
| `DateTimeOriginal` (EXIF) | `2026:04:11 14:57:48`  |
| `TimeCreated` (EXIF)      | `14:57:48-05:00`       |

Same pattern — IO stored local time as UTC. The `-05:00` confirms this camera was set to CDT. Two photographers, same nasa_id prefix, different timezones.

### Handling photos without `DigitalCreationTime`

About 85% of photos are raw NEF files processed through a pipeline that strips the timezone-aware EXIF fields. These have a minimal EXIF set with different field names:

**Example — jsc2026e022268 (raw NEF, no timezone offset):**

| Field   | Value                    |
| ------- | ------------------------ |
| `MODEL` | `NIKON Z 9 S/N: 3023828` |
| `GMT`   | `2026:04:11 14:56:49`    |

No `DigitalCreationTime`, no `TimeCreated`, no timezone offset. But the `MODEL` field embeds the camera body serial number (`S/N: 3023828`). By matching this serial to processed JPGs from the same camera that DO have timezone data, we can determine the camera's timezone setting.

In this case, serial `3023828` appears on other photos as processed JPGs with `DigitalCreationTime: 18:15:47-06:00` and `Creator: David DeHoyos - NASA - JSC`. Every processed JPG from this serial across every mission day shows `-06:00`, confirming the camera was consistently set to CST throughout the mission.

**Important caveat**: Serial-based mapping is only used for cameras verified to have a consistent timezone across the entire mission. Cameras that changed timezone (e.g., Blair's serial `3022521` was `-05:00` in Houston on Apr 1 then `-07:00` in San Diego on Apr 10) are excluded from serial mapping — those rely solely on scraped EXIF per photo. If a photographer travels to a different timezone and changes their camera clock, only photos that were processed through Lightroom (which preserves `DigitalCreationTime`) will have the correct offset; raw NEFs from that camera on travel days would fall back to the prefix default and may be incorrect.

### Confirming unknown cameras via IO collection metadata

Three camera serials (`3001958`, `3020106`, `3502583`) appear only as raw NEFs with no `Creator` field and no processed JPGs to cross-reference. For these, we used the IO `collections_string` metadata which names the event:

**Example — jsc2026e022813 (serial 3001958):**

```
collections_string: "Artemis-02 Splashdown Watch Party at Building 37 Lunar Park 2026-04-10"
```

Building 37 is at JSC Houston. The watch party photos span 16:59–18:16 local time, consistent with splashdown at 17:07 PDT (19:07 CDT). Camera was in CDT (-05:00).

**Example — jsc2026e023273 (serial 3020106):**

```
collections_string: "Artemis-02 Post-Splashdown News Conference 2026-04-10"
```

Post-splashdown press conferences are held at JSC Houston. Photos span 22:31–23:24 local time. Camera was in CDT (-05:00).

## Findings by Photographer

Every photo in IO has an incorrect `md_creation_date` — local time stored as UTC. The tables below show the camera's timezone offset, how far off IO's date is, and whether the camera itself was set correctly for the photographer's location.

### JSC Photographers (`jsc2026e`)

Expected camera setting for Houston: **-05:00 CDT** (Central Daylight Time).

#### Josh Valcarcel

| Serial  | Model     | Camera Offset | IO Date Error  | Camera Setting              | Location  | Days   |
| ------- | --------- | ------------- | -------------- | --------------------------- | --------- | ------ |
| 3022417 | NIKON Z 9 | -07:00 PDT    | 7 hours behind | Correct (PDT for San Diego) | San Diego | Apr 10 |
| 3502585 | NIKON D5  | -05:00 CDT    | 5 hours behind | Correct                     | Houston   | Apr 11 |

Two camera bodies. Serial 3022417 traveled to San Diego and was correctly set to PDT. Serial 3502585 stayed in Houston on CDT.

#### James Blair

| Serial  | Model     | Camera Offset | IO Date Error  | Camera Setting              | Location  | Days   |
| ------- | --------- | ------------- | -------------- | --------------------------- | --------- | ------ |
| 3022521 | NIKON Z 9 | -05:00 CDT    | 5 hours behind | Correct                     | Houston   | Apr 1  |
| 3022521 | NIKON Z 9 | -07:00 PDT    | 7 hours behind | Correct (PDT for San Diego) | San Diego | Apr 10 |
| 3502503 | NIKON D5  | -07:00 PDT    | 7 hours behind | Correct (PDT for San Diego) | San Diego | Apr 10 |

Same camera body (3022521) was updated from CDT to PDT when Blair traveled to San Diego. The timezone changed mid-mission, so this camera cannot use serial-based mapping — it relies on scraped EXIF per photo.

#### David DeHoyos

| Serial  | Model     | Camera Offset | IO Date Error  | Camera Setting                      | Location | Days                      |
| ------- | --------- | ------------- | -------------- | ----------------------------------- | -------- | ------------------------- |
| 3023828 | NIKON Z 9 | -06:00 CST    | 6 hours behind | **Incorrect — not updated for DST** | Houston  | Apr 1, 3, 6, 7, 8, 10, 11 |

532 photos across 7 days. Camera was set to Central Standard Time and was not switched to CDT for daylight saving time. IO dates are 6 hours behind UTC instead of the expected 5. Confirmed via processed JPGs showing `DigitalCreationTime` with `-06:00`.

#### Luna Posadas Nava

| Serial  | Model     | Camera Offset | IO Date Error  | Camera Setting                      | Location | Days                      |
| ------- | --------- | ------------- | -------------- | ----------------------------------- | -------- | ------------------------- |
| 3035041 | NIKON Z 9 | -06:00 CST    | 6 hours behind | **Incorrect — not updated for DST** | Houston  | Apr 1, 2, 4, 6, 7, 10, 13 |

156 photos across 7 days. Same issue as DeHoyos — camera remained on CST.

#### Robert Markowitz

| Serial  | Model     | Camera Offset | IO Date Error  | Camera Setting | Location | Days             |
| ------- | --------- | ------------- | -------------- | -------------- | -------- | ---------------- |
| 3022482 | NIKON Z 9 | -05:00 CDT    | 5 hours behind | Correct        | Houston  | Apr 5, 7, 10, 11 |

#### Bill Stafford

| Serial  | Model     | Camera Offset | IO Date Error  | Camera Setting                            | Location | Days       |
| ------- | --------- | ------------- | -------------- | ----------------------------------------- | -------- | ---------- |
| 3034984 | NIKON Z 9 | -05:00 CDT    | 5 hours behind | Correct                                   | Houston  | Apr 10, 11 |
| 3034984 | NIKON Z 9 | -04:00 EDT    | 4 hours behind | **Incorrect — set to EDT instead of CDT** | Houston  | Apr 2, 6   |

Same camera body shows `-05:00` on most days but `-04:00` on Apr 2 and Apr 6 (7 photos). The camera timezone setting was changed mid-mission. The `-04:00` photos are corrected via scraped EXIF.

#### Helen Arase Vargas

| Serial  | Model     | Camera Offset | IO Date Error  | Camera Setting | Location | Days       |
| ------- | --------- | ------------- | -------------- | -------------- | -------- | ---------- |
| 3023929 | NIKON Z 9 | -05:00 CDT    | 5 hours behind | Correct        | Houston  | Apr 10, 11 |

#### Unknown Cameras (No Creator in EXIF)

| Serial  | Model    | Camera Offset | IO Date Error  | Camera Setting | Location        | Determined By                                                            |
| ------- | -------- | ------------- | -------------- | -------------- | --------------- | ------------------------------------------------------------------------ |
| 3001958 | NIKON D6 | -05:00 CDT    | 5 hours behind | Correct        | Houston Bldg 37 | `collections_string`: "Splashdown Watch Party at Building 37 Lunar Park" |
| 3020106 | NIKON D6 | -05:00 CDT    | 5 hours behind | Correct        | Houston JSC     | `collections_string`: "Post-Splashdown News Conference"                  |
| 3502583 | NIKON D5 | -05:00 CDT    | 5 hours behind | Correct        | Houston JSC     | `collections_string`: FCR, press briefings, JSC events across 8 days     |

### NHQ Photographers (`nhq`)

Expected camera setting for KSC: **-04:00 EDT** (Eastern Daylight Time). All NHQ photos are from launch day (Apr 1).

Most NHQ photos have correct `-04:00` in EXIF (IO dates 4 hours behind UTC). Exceptions:

| Photographer     | Serial       | Camera Offset | IO Date Error   | Camera Setting                                                 | Photos |
| ---------------- | ------------ | ------------- | --------------- | -------------------------------------------------------------- | ------ |
| Bill Ingalls     | 3003184      | -05:00 CDT    | 5 hours behind  | **Incorrect — set to CDT instead of EDT**                      | 2      |
| Bill Ingalls     | 652057000325 | +05:00        | 5 hours _ahead_ | **Incorrect — severely misconfigured (10 hours off from EDT)** | 2      |
| Aubrey Gemignani | 3000433      | -05:00 CDT    | 5 hours behind  | **Incorrect — set to CDT instead of EDT**                      | 1      |
| Joel Kowsky      | 392055000136 | -05:00 CDT    | 5 hours behind  | **Incorrect — set to CDT instead of EDT**                      | 2      |

These are all corrected via scraped EXIF tz_offset.

## Override Summary

| Offset          | Photos    | IO Date Error        | Description                                                                              |
| --------------- | --------- | -------------------- | ---------------------------------------------------------------------------------------- |
| -05:00:00 (CDT) | 2,238     | 5 hours behind UTC   | JSC Houston photographers, correct camera setting, incorrect in IO                       |
| -06:00:00 (CST) | 688       | 6 hours behind UTC   | DeHoyos + Posadas Nava, incorrect camera setting (not updated for DST), incorrect in IO  |
| -04:00:00 (EDT) | 127       | 4 hours behind UTC   | NHQ at KSC (120 correct camera setting, incorrect in IO) + Stafford camera misconfig (7) |
| -07:00:00 (PDT) | 11        | 7 hours behind UTC   | Valcarcel + Blair in San Diego, correct camera setting, incorrect in IO                  |
| +05:00:00       | 2         | 5 hours ahead of UTC | Ingalls camera severely misconfigured, incorrect in IO                                   |
| **Total**       | **3,066** |                      | **All 3,066 ground photos have incorrect dates/times in IO**                             |

## File Inventory

| File                                | Purpose                                                            | Runtime? |
| ----------------------------------- | ------------------------------------------------------------------ | -------- |
| `photo-time-overrides.json`         | Per-photo timezone corrections, imported by `io-photos.ts`         | **Yes**  |
| `generate-photo-time-overrides.mjs` | Generates overrides from scraped EXIF data                         | Script   |
| `scrape-io-photo-metadata.mjs`      | Scrapes EXIF from IO info pages, writes `photo-exif-metadata.json` | Script   |
| `photo-exif-metadata.json`          | Full scraped EXIF data (3,066 ground photos)                       | Data     |
| `seed-photo-timeshifts-api.mjs`     | Seeds default per-prefix timezone rules via REST API (legacy)      | Script   |

## Regenerating Overrides

If new photos are added to IO or camera assignments change:

```bash
# 1. Re-scrape EXIF metadata from IO (fetches all jsc/nhq photos, ~5min)
node src/server/processing/artemis2/photos/scrape-io-photo-metadata.mjs

# 2. Regenerate overrides from scraped data
node src/server/processing/artemis2/photos/generate-photo-time-overrides.mjs
```

If new cameras with non-default timezones are found, add their serial numbers to the `CAMERA_TZ` map in `generate-photo-time-overrides.mjs`.
