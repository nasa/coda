# OPTIMIS investigation tools

Read-only utilities for fetching OPTIMIS data and comparing a local Gantt chart with the Viewer. These tools do not change the CODA application or update upstream plans. See [the API reference](../../docs/optimis-api.md) for the verified endpoints, authentication differences, and field inventory.

## Setup

Use the repository's installed Node dependencies (`npm install`) and Python 3.10 or later. The Python renderer needs only the standard library. Set up the NASA certificate bundle at the repository root as `.env.local.cert.pem`, as described in the main README.

Create `.local/optimis-probe.credentials.json` with your service-account username/password and the Windows domain:

```json
{
  "username": "YOUR_SERVICE_ACCOUNT",
  "password": "YOUR_PASSWORD",
  "domain": "NDC"
}
```

Credentials, responses, reports, and rendered pages stay in Git-ignored `.local`. The probe loads credentials only with `--authenticate` and after an NTLM challenge. No secrets or captured schedule data are included with these tools.

## Fetch and view a production day

From the repository root:

```powershell
python scripts/optimis/optimis_gantt.py --date 2026-10-29 --fetch --serve
```

Open `http://127.0.0.1:8766/`. Omit `--date` to use the current UTC day. The chart includes crew/event lanes, the six context profiles, source status, window controls, and per-activity source IDs/times. It selects the plan with the most matching activities by default; use the plan selector to inspect the other returned plans.

The HTML is generated at `.local/optimis-gantt/viewer.html` and can also be opened directly. The server binds only to `127.0.0.1` and serves only the generated page. Press Ctrl+C in its terminal to stop it. If a server is already running, regenerate the page and reload instead of launching a second server.

Fetch separately or render an existing snapshot:

```powershell
node scripts/optimis/fetch.mjs 2026-10-29
python scripts/optimis/optimis_gantt.py --date 2026-10-29
```

Both commands use `.local/optimis-gantt/data/`. Snapshots less than 15 minutes old are reused when both response files exist. Add `--refresh` to the fetcher, or `--fetch --refresh` to the Python command, for an explicit fresh read. No automatic API polling is performed. Keep recurring collection at the documented conservative cadence.

## Probe authentication

```powershell
# Integration: anonymous endpoint checks and credential-free NTLM negotiation
node scripts/optimis/probe.mjs --environment integration --date 2026-10-29

# Inspect just the NTLM challenge; no username/password is sent
node scripts/optimis/probe.mjs --environment integration --negotiation-only

# Try the local service account against integration's known repository routes
node scripts/optimis/probe.mjs --environment integration --authenticate

# Fetch the production dictionary with NTLM
node scripts/optimis/probe.mjs --environment production --authenticate --dictionary-only
```

The default environment is integration. Hosts are restricted to the two documented NASA origins, redirects are not followed, and request ranges are bounded to one UTC day. Reports and successful responses go under `.local/optimis-gantt/probes/<environment>/`. Passwords, authorization values, session cookies, and OIDC state/nonce values are not written to reports.

On October 29, 2026, integration returned Launchpad redirects even after NTLM; production returned data. A redirect is an authentication result, not an empty schedule. These tools do not implement an OIDC sign-in flow.

## Verify locally

```powershell
python -m unittest discover -s scripts/optimis -p "test_*.py"
node --check scripts/optimis/fetch.mjs
node --check scripts/optimis/probe.mjs
```

The Python tests use synthetic records to check UTC boundary handling, seconds-based durations, optional profiles, and omission of note content from the rendered payload. They do not require credentials or network access.
