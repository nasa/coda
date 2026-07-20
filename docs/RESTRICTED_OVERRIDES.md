# Restricted Media Overrides

Allows superusers to gate certain `MediaOverride_db` rows so that only an explicit
list of LaunchPad AUIDs receives the override. Everyone else continues to see the
unmodified IO data (or whatever public override would normally apply).

## Architecture (v1)

A separate REST endpoint, **not** the socket pipeline, delivers restricted data.

- `MediaOverride_db.access_grant_id` (nullable FK) — `null` = public (today's behavior),
  non-null = restricted to the AUIDs in the linked `AccessGrant_db.auids`.
- `AccessGrant_db` — reusable named lists of AUIDs. One grant can be referenced by
  multiple media overrides.
- Public socket fetchers (`io-videos.ts`, `io-photos.ts`, `talkybot.ts`) call
  `getPublicMediaOverridesList()` so restricted overrides never leak into public
  caches or rooms.
- `GET /api/v1/restricted/videos?source=X&dateWanted=YYYY-MM-DD` — JWT-authed.
  Returns the forged manifest only if the caller's AUID is in the grant.
  Responds `204` when no restricted override exists, `403` when the user is not
  in the grant. Every successful delivery is logged via
  `serverLogger.info({ logId: "restrictedOverrideAccess", ... })`.
- The client (`SocketClient.tsx`) calls this endpoint after every public `videos`
  socket update; if a restricted payload comes back, it replaces the videos in
  the Redux store.

## nginx configuration

The `location /api/v1/restricted` block in
[`docker/nginx/nginx.conf`](../docker/nginx/nginx.conf) routes restricted-override
traffic through the same launchpad auth proxy as `/api/v1/emss` and `/api/v1/db`.
The Express `getUser(req)` check inside the route handler is defense-in-depth;
nginx is the authoritative auth boundary.

## Admin UI

- `/admin/accessGrants` — list and CRUD AUID grants
- `/admin/mediaOverridesUpsert` — the existing media override form now has a
  "Restrict to Access Grant" dropdown that defaults to "Public — no restriction"
- `/admin/socketStatus` (Visitor Activity) — each connection now shows a
  "Restricted Access" column listing which restricted overrides the user is
  eligible for on the date/source they're viewing.

## Operational notes

- Deleting an `AccessGrant_db` row is refused (409) if any media override still
  references it. Reassign or remove those overrides first.
- Removing an AUID from a grant takes effect on the next REST call from that
  user (no caching of restricted data).
- For local development with `MOCK_USER=true`, set `MOCK_USER_AUID` to an AUID
  that is in (or out of) the seeded grant to test both paths.

## Future work (not in v1)

- Extend `access_grant_id` gating to `AssetOverride_db`, `VideoStartTimeOverrides_db`,
  `PhotoTimeShifts_db` if a need arises.
- Promote restricted delivery to the socket pipeline (variant rooms + variant
  caches) if low-latency push of restricted data becomes important.
- Add a restricted endpoint for non-video media types (photo/audio/transcript).
  The schema already supports it; only the REST handler is video-only today.
