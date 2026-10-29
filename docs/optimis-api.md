# OPTIMIS Plan Repository API

This document describes the read API investigated for CODA on **October 29, 2026**. Request formats came from OPTIMIS Viewer network requests and were verified against production using a service account. Field lists come from the returned JSON and the production XML dictionary.

This is an observed integration contract, not a replacement for the OPTIMIS External Interface Design Description (EIDD). Requiredness, other query operators, pagination, retention, write operations, and access to other planning contexts have not been established. Fields can be omitted, null, or added in other responses; the types below describe the captured response unless marked **dictionary only**.

## Environments and authentication

| Environment | Repository base URL                       | Observed authentication behavior                                                                                                                                                                                                |
| ----------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production  | `https://ops.jsc.nasa.gov/planrepository` | HTTP NTLM with the `NDC` Windows domain; dictionary, activity, and profile reads succeeded with the supplied service account.                                                                                                   |
| Integration | `https://int.jsc.nasa.gov/planrepository` | Unauthenticated reads redirect to NASA Launchpad/OIDC. Preemptive NTLM obtains an NDC challenge, but the account's NTLM response still leads to a Launchpad redirect instead of API data. Unattended access remains unresolved. |

The DNS host and Windows account domain are different settings: `ops.jsc.nasa.gov` is the production host; `NDC` is the NTLM domain, advertised by the server as `ndc.nasa.gov`. Supply username, password, and domain separately to an NTLM-capable client. A password by itself does not establish Basic authentication or an OIDC client registration.

The production Viewer at `https://ops.jsc.nasa.gov/Gateway/index?program=iss&site=ops1` uses Launchpad/OIDC, even though the production repository accepts NTLM. Browser sign-in behavior therefore does not establish API authentication behavior. Do not assume the integration repository is anonymous because a dictionary is visible in an existing browser session.

Keep TLS verification enabled. CODA's setup instructions describe the NASA CA bundle at `.env.local.cert.pem`; the working Node probes combined this with Node's trusted roots. Keep credentials server-side, outside committed files and `VITE_PUBLIC_` configuration. Do not log Axios request/error objects: they can contain authorization headers. Disable automatic redirects when diagnosing authentication so a sign-in page cannot be mistaken for an API response.

## Verified read endpoints

All paths below are relative to the repository base URL. These are HTTPS **GET** requests. Use a URL encoder for query parameter values.

| Path              | Response                                      | Purpose                                                                                                                          |
| ----------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `/dictionary`     | XML, `text/xml;charset=UTF-8`                 | Activity types, shared attributes, enums, reference types, and display metadata. Contains definitions, not scheduled activities. |
| `/activitySearch` | JSON object, `application/json;charset=UTF-8` | Activities overlapping a time range, grouped into source plans, with plan metadata and optional resource/constraint data.        |
| `/profilesSearch` | JSON array, `application/json;charset=UTF-8`  | Interval-valued context profiles such as day/night, orbit number, attitude, and communications availability.                     |

### Activity search

Working request for October 29, 2026 UTC:

```text
GET https://ops.jsc.nasa.gov/planrepository/activitySearch
    ?overlapRange=startTime%3D2026-10-29T00%3A00%3A00Z%2CendTime%3D2026-10-30T00%3A00%3A00Z
    &keywordQuery=isTask%3Afalse
    &planContext=ops1
    &maxResults=-1
```

The line breaks above are for readability. The decoded query parameters are:

| Parameter      | Verified value/format                                         | Meaning and limits                                                                                                                                                                |
| -------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `overlapRange` | `startTime=2026-10-29T00:00:00Z,endTime=2026-10-30T00:00:00Z` | A single parameter containing both named UTC bounds, separated by a comma. Activities may start before or end after this range.                                                   |
| `keywordQuery` | `isTask:false`                                                | Excludes activities marked as task-list items. A task-list-named source plan still appeared because it contained a matching non-task activity. Other query grammar is unverified. |
| `planContext`  | `ops1`                                                        | Operational planning context used by the Viewer and successful probes. Other contexts have not been queried.                                                                      |
| `maxResults`   | `-1`                                                          | The Viewer's setting for requesting results without an explicit positive limit. Server ceilings, pagination, and completeness guarantees remain unverified.                       |
| `_`            | Millisecond timestamp in the captured Viewer request          | Appears to be a browser cache-busting parameter. It was omitted from successful probes.                                                                                           |

The plain `start`/`end` parameters used by profile search are **not** the verified activity search format. Initial activity probes without the correct `overlapRange` format returned generic HTTP 500 pages. That error alone cannot distinguish bad parameters from a server failure.

### Profile search

```text
GET https://ops.jsc.nasa.gov/planrepository/profilesSearch
    ?keywordQuery=id%3ADayNight%2CDAILY_ORB_NUM%2CATTITUDE%2CALL_KU_AVAIL%2CALL_S1_AVAIL%2CALL_S2_AVAIL
    &start=2026-10-29T00%3A00%3A00Z
    &end=2026-10-30T00%3A00%3A00Z
    &planContext=ops1
```

| Parameter      | Verified value/format                                                       | Meaning                                                                     |
| -------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `keywordQuery` | `id:DayNight,DAILY_ORB_NUM,ATTITUDE,ALL_KU_AVAIL,ALL_S1_AVAIL,ALL_S2_AVAIL` | Selects the six profile IDs used by the Viewer. Preserve spelling and case. |
| `start`        | ISO 8601 UTC timestamp                                                      | Requested interval start.                                                   |
| `end`          | ISO 8601 UTC timestamp                                                      | Requested interval end.                                                     |
| `planContext`  | `ops1`                                                                      | Match the activity request's context.                                       |
| `_`            | Optional cache-busting value                                                | Present in the Viewer request; unnecessary in successful probes.            |

### Dictionary

Fetch [the production dictionary](https://ops.jsc.nasa.gov/planrepository/dictionary) through the same NTLM client. Its root is `<Dictionary mission="mod">`. The observed activity types are `Activity`, `Sleep`, and `TLM_Format_Swap`.

Include `text/xml` in the request's `Accept` header for this endpoint. A probe accepting JSON, `application/xml`, and HTML but omitting `text/xml` received HTTP 406; adding `text/xml` produced HTTP 200. The repository probe includes both XML media types.

The dictionary contains `TypeDefinitions`, shared `Attributes`, `ResourceDefs`, `ContainerDef`, and `ActivityDefs`, plus categories and properties. Parameters declare a type and may declare `isList`, `reference`, `nullAllowed`, units, restrictions, or defaults. These dictionary defaults do not establish that every JSON response contains the field or that consumers should fill in missing data automatically.

Its relative XSD reference is `../model/ngpsActivityDictionary.xsd`. Resolving that against the document URL gives `https://ops.jsc.nasa.gov/model/ngpsActivityDictionary.xsd`, which returned 404. A canonical downloadable XSD has not been established. The dictionary's IPV/JEDI/ILRT URLs describe supporting link providers; they are not recursive schema imports or activity search endpoints.

Parse XML without automatic external-entity/DTD retrieval. Treat dictionary display expressions as metadata; do not execute supplied expressions as application code.

## Making a production request from this repository

The repository already includes `axios-ntlm`. After installing repository dependencies and configuring the NASA CA bundle, create a local `.local/optimis-probe.credentials.json`:

```json
{
  "username": "YOUR_SERVICE_ACCOUNT",
  "password": "YOUR_PASSWORD",
  "domain": "NDC"
}
```

`.local` is ignored by Git. The file is a local convenience, not a deployed secret-management interface. JSON special characters in passwords must be escaped correctly.

Save this example as `.local/fetch-optimis.mjs` and run `node .local/fetch-optimis.mjs` from the repository root. It performs a single bounded read and prints counts rather than response bodies or credentials:

```js
import fs from "node:fs";
import https from "node:https";
import tls from "node:tls";
import { NtlmClient } from "axios-ntlm";

const credentials = JSON.parse(fs.readFileSync(".local/optimis-probe.credentials.json", "utf8"));
if (!credentials.username || !credentials.password) {
  throw new Error("Missing OPTIMIS credentials");
}

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 1,
  ca: [...tls.rootCertificates, fs.readFileSync(".env.local.cert.pem", "utf8")],
});
const client = NtlmClient(
  { ...credentials, domain: credentials.domain || "NDC", workstation: "" },
  {
    httpsAgent: agent,
    maxRedirects: 0,
    timeout: 60000,
    maxContentLength: 32 * 1024 * 1024,
    proxy: false, // Direct connection, as used in the successful probes.
  }
);

const url = new URL("https://ops.jsc.nasa.gov/planrepository/activitySearch");
url.search = new URLSearchParams({
  overlapRange: "startTime=2026-10-29T00:00:00Z,endTime=2026-10-30T00:00:00Z",
  keywordQuery: "isTask:false",
  planContext: "ops1",
  maxResults: "-1",
}).toString();

try {
  const response = await client.get(url.href, {
    headers: { Accept: "application/json" },
  });
  if (!String(response.headers["content-type"]).includes("application/json")) {
    throw new Error("Expected JSON; received another content type");
  }
  const data = response.data;
  if (!Array.isArray(data?.plan)) {
    throw new Error("Expected activitySearch response with plan[]");
  }
  fs.writeFileSync(".local/optimis-activities.json", JSON.stringify(data));
  console.log(`Received ${data.plan.length} source plans`);
} catch (error) {
  // Avoid printing the full error, which may contain request credentials.
  console.error(error.response ? `HTTP ${error.response.status}` : error.code || error.message);
  process.exitCode = 1;
} finally {
  agent.destroy();
}
```

For profiles, use the same client with `/profilesSearch` and the parameters above. Do not change Axios validation to treat every 401 as successful: the NTLM client's handshake relies on handling the initial 401 challenge. This example is restricted to the production URL; do not forward its authorization headers to redirect destinations.

## Activity response structure

The root is an object containing `plan[]`. Each plan has its own metadata and `children.activity[]`. The captured search response had flat activity arrays; the dictionary also defines containers, but a complete nested-container response has not been verified.

This abbreviated example uses illustrative names, IDs, and revision values:

```json
{
  "plan": [
    {
      "name": "EXAMPLE_WEEK.OPS1",
      "start": "2026-10-26T06:00:00.000Z",
      "end": "2026-11-02T06:00:00.000Z",
      "version": "",
      "applicationProperties": [
        { "name": "viewer.baseRevision", "integer": 12345 },
        { "name": "viewer.subRevision", "integer": 1 }
      ],
      "children": {
        "activity": [
          {
            "id": "ACTIVITY_ID",
            "name": "EXAMPLE ACTIVITY",
            "activityType": "Activity",
            "scheduled": true,
            "startTime": "2026-10-29T12:30:00.000Z",
            "duration": "3600",
            "templateId": "TEMPLATE_ID",
            "sharedProperties": {
              "activityStatus": "Scheduled Enabled",
              "crewMembers": ["FE-2"],
              "events": ["CREW"],
              "isTask": false
            }
          }
        ]
      }
    }
  ]
}
```

### Envelope and plan fields

Paths in this table are relative to one `plan[]` element, except the root row.

| Field                   | Observed JSON type            | Meaning                                                                                              |
| ----------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| Root `plan`             | array of objects              | Matching source plans; one request can return multiple plans.                                        |
| `name`                  | string                        | Source plan name. Keep it with activity IDs; do not merge plans solely because activity names match. |
| `start`, `end`          | UTC timestamp strings         | Bounds of the source plan; can extend beyond the requested overlap range.                            |
| `version`               | string                        | Source version field; empty in the sample. Do not equate it with the revision counters below.        |
| `increment`             | string                        | Increment metadata; empty values were observed.                                                      |
| `notes`                 | string                        | Plan notes; may be empty.                                                                            |
| `dayNotes`              | object                        | Day-note structure; only empty objects were observed, so its entries are unverified.                 |
| `applicationProperties` | array of objects              | Named metadata with typed value slots.                                                               |
| `children`              | object                        | Child collections.                                                                                   |
| `children.activity`     | array of objects              | Activities returned for this source plan.                                                            |
| `constraints`           | object, omitted on some plans | Temporal bound/relation groups; field list below.                                                    |

### Application properties

Each entry has `name` plus a typed value field such as `integer`, `string`, or `time`. All three slots were observed across plan/activity metadata. Select by `name`, not by array position.

| Property name          | Value slot | Observed use                                                                                                                     |
| ---------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `viewer.baseRevision`  | `integer`  | Source plan's base revision counter.                                                                                             |
| `viewer.subRevision`   | `integer`  | Source plan's subrevision counter.                                                                                               |
| `viewer.baseIndexTime` | `time`     | Source indexing timestamp in UTC; not the collector's fetch time.                                                                |
| `sync.range.startTime` | `time`     | Range start recorded in the search response.                                                                                     |
| `sync.range.endTime`   | `time`     | Range end recorded in the search response.                                                                                       |
| `score.persistentID`   | `string`   | Activity-level persistent identifier in activity `applicationProperties`. Its stability across copies/plans has not been tested. |

Persist the collector's own fetch timestamp and request scope separately. Atomicity between activity and profile requests, and incremental synchronization based on these counters, have not been established.

### Activity fields

Paths are relative to `plan[].children.activity[]`.

| Field                   | Observed JSON type                 | Meaning                                                                                                    |
| ----------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `id`                    | string                             | Source activity identifier. Preserve with source plan/context; global uniqueness has not been established. |
| `name`                  | string                             | Timeline activity label; can contain non-English text.                                                     |
| `activityType`          | string                             | Dictionary activity type: `Activity`, `Sleep`, or `TLM_Format_Swap` in the observed dictionary.            |
| `scheduled`             | boolean                            | Source scheduling flag. All sample activities were `true`; behavior for `false` is unverified.             |
| `startTime`             | UTC timestamp string               | Scheduled start, including starts outside the requested day.                                               |
| `duration`              | string containing a number         | Duration in **seconds**, not milliseconds. Parse numerically; zero-duration activities were observed.      |
| `templateId`            | string                             | Template reference; not the instance activity ID.                                                          |
| `applicationProperties` | array of objects                   | Activity metadata such as `score.persistentID`.                                                            |
| `sharedProperties`      | object                             | Activity attributes listed below.                                                                          |
| `resources`             | object, omitted on some activities | Resource effects and requirements; field list below.                                                       |

There was no top-level activity `endTime` in the captured response. Derive it as `startTime + duration seconds`.

### Shared activity fields observed in JSON

All names in this table are relative to activity `sharedProperties`. A field appearing in this inventory does not mean it appears on every activity. Enum-like values are strings in JSON; consult the dictionary for allowed values and preserve unknown values.

| Field                        | Observed JSON type     | Meaning                                                                                                                                                                           |
| ---------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activityStatus`             | string                 | Source status; see values below. Present in `activitySearch`; no separate status call was needed for the snapshot.                                                                |
| `activitySequence`           | string                 | Display/sequence designation such as `Sequenced 4`; distinct from status.                                                                                                         |
| `crewMembers`                | array of strings       | Crew-role references, such as `ISS CDR` or `FE-2`. The dictionary models references to `CrewMember`, but this response serializes role names, not expanded member objects.        |
| `events`                     | array of strings       | Timeline event/band assignments such as `CREW`, `SPECIALIST`, `S-BD`, and `KU-BD`. An activity can belong to several bands.                                                       |
| `filterCategory1`            | string                 | Level 1 ISS hierarchy/filter category.                                                                                                                                            |
| `filterCategory2`            | string                 | Level 2 hierarchy/filter category.                                                                                                                                                |
| `filterCategory3`            | string                 | Level 3 category, including utilization or work/rest classifications.                                                                                                             |
| `origination`                | string                 | Originating planning center/organization.                                                                                                                                         |
| `class`                      | string                 | System/payload classification.                                                                                                                                                    |
| `location`                   | string                 | Location of the activity.                                                                                                                                                         |
| `workplace`                  | string                 | More specific workplace/panel designation.                                                                                                                                        |
| `timeCritical`               | boolean                | Source marks activity timing as critical.                                                                                                                                         |
| `monitor`                    | boolean                | Monitor on/off field; downstream operational behavior is unverified.                                                                                                              |
| `altName`                    | string                 | Alternate activity label.                                                                                                                                                         |
| `russianAltName`             | string                 | Russian alternate label.                                                                                                                                                          |
| `planningFilter1`            | string                 | First planning-frequency/filter field.                                                                                                                                            |
| `planningFilter3`            | string                 | Third planning-frequency/filter field; `planningFilter2` is dictionary-only in this sample.                                                                                       |
| `annotationNote`             | string                 | Short annotation.                                                                                                                                                                 |
| `annotationText`             | string                 | Longer planning/scheduling annotation.                                                                                                                                            |
| `procedureName`              | string                 | Procedure identifier/name referenced by the activity.                                                                                                                             |
| `ostpDelta`                  | string                 | OSTP delta designation, e.g. `DELTA 1`.                                                                                                                                           |
| `ostpPriority`               | integer                | Source OSTP priority.                                                                                                                                                             |
| `isTask`                     | boolean                | Task-list classification; filter used here is `false`.                                                                                                                            |
| `taskCandidate`              | boolean                | Task-candidate classification.                                                                                                                                                    |
| `priority`                   | string                 | Task-list priority; dictionary values are `HIGH`, `MEDIUM`, and `LOW`.                                                                                                            |
| `crewNote`                   | string                 | Crew note content; honor `isCrewNotePrivate` before distributing it.                                                                                                              |
| `isCrewNotePrivate`          | boolean                | Privacy flag for crew notes.                                                                                                                                                      |
| `groundNote`                 | string                 | Ground note content; access/display policy needs to be established for consumers.                                                                                                 |
| `executionNotes`             | array of typed objects | Links or text notes; see nested fields below.                                                                                                                                     |
| `opsNote`                    | typed object           | Multilingual operations label/description; see nested fields below.                                                                                                               |
| `isAudio`                    | boolean                | Audio-related activity flag.                                                                                                                                                      |
| `isVideo`                    | boolean                | Video-related activity flag.                                                                                                                                                      |
| `tags`                       | string                 | Tags were a **string**, not an array, in the activity response. Do not infer delimiter semantics.                                                                                 |
| `flightDay`                  | integer                | Source flight-day value; zero was observed.                                                                                                                                       |
| `variantName`                | string                 | Variant/template name.                                                                                                                                                            |
| `variantParentId`            | string                 | Variant parent reference.                                                                                                                                                         |
| `russianInstanceId`          | string                 | APS instance reference.                                                                                                                                                           |
| `russianDescendantId`        | string                 | APS descendant reference.                                                                                                                                                         |
| `tlmFormatSwapTo`            | string                 | Target telemetry format for `TLM_Format_Swap`.                                                                                                                                    |
| `tlmFormatsEss`              | array of strings       | Applicable ESS telemetry formats.                                                                                                                                                 |
| `tlmFormatsHK1`              | array of strings       | Applicable HK1 telemetry formats.                                                                                                                                                 |
| `tlmFormatsHK2`              | array of strings       | Applicable HK2 telemetry formats.                                                                                                                                                 |
| `restAncestorContainerNames` | string                 | Serialized ancestor/container information. The sample contains ID/name pairs, sometimes comma-separated. Exact escaping and parsing rules are unverified; preserve the raw value. |
| `restContainerPos`           | integer                | Source position within a container. Ordering scope is unverified.                                                                                                                 |

The last two `rest*` fields were observed in JSON but are not declared as shared attributes in the captured dictionary.

Dictionary `ACTIVITY_STATUS` values are:

```text
Scheduled Enabled, Active, Completed, Aborted, Deferred, Inhibited,
Not Ready, Contingency, As Needed, Ground Coord
```

The sample contained `Scheduled Enabled`, `Active`, `Completed`, and `Aborted`. Sequence values are the empty string and `Sequenced 1` through `Sequenced 6`. Source status is not an independently verified execution record; retain it without deriving completion from the current clock or the scheduled end.

### Additional shared fields declared by the dictionary

These fields were **not observed** in the captured activity JSON. Types here are dictionary types, not verified JSON encodings. The list includes shared attributes declared by the dictionary and the activity-specific attributes above; container-specific parameters are a separate schema and may differ.

| Field                                                                          | Dictionary type       | Meaning/limits                                                                                             |
| ------------------------------------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `avoidances`                                                                   | `Properties[]`        | Embedded property-map objects; semantics unverified.                                                       |
| `resourceRequest`                                                              | `Properties[]`        | Embedded resource request maps; distinct from the observed top-level `resources` object.                   |
| `planningFilter2`                                                              | `PLANNING_FILTER`     | Second planning-frequency/filter field.                                                                    |
| `responsibleOrg`                                                               | `RESPONSIBLE_ORG[]`   | Responsible organizations.                                                                                 |
| `flightPhase`                                                                  | `FLIGHT_PHASE[]`      | Flight-phase classifications.                                                                              |
| `procedureLocation`                                                            | `PROCEDURE_LOCATION`  | Procedure-location classification.                                                                         |
| `cpsId`                                                                        | `String`              | CPS activity identifier; distinct from top-level `id`.                                                     |
| `cpsOrigDoId`                                                                  | `String`              | CPS original DO identifier.                                                                                |
| `cpsMasterId`                                                                  | `String`              | CPS master activity identifier.                                                                            |
| `cpsMasterOrigDoId`                                                            | `String`              | Original DO identifier of the CPS master.                                                                  |
| `cpsSeqId`                                                                     | `String`              | CPS sequence identifier.                                                                                   |
| `minDuration`, `maxDuration`                                                   | `duration`, units `s` | Minimum/maximum duration metadata. JSON encoding unverified.                                               |
| `cpsScheduledBand`                                                             | `String`              | CPS field; semantics unverified.                                                                           |
| `cpsTimeReference`                                                             | `String`              | CPS time-reference field; semantics unverified.                                                            |
| `cpsPetId`                                                                     | `String`              | CPS reference; semantics unverified.                                                                       |
| `cpsInhibitToggle`                                                             | `Boolean`             | CPS inhibition field; semantics unverified.                                                                |
| `cpsCalendarView`                                                              | `Boolean`             | CPS calendar-view field.                                                                                   |
| `cpsVectorOption`                                                              | `Integer`             | CPS option field.                                                                                          |
| `cpsSeqNum`                                                                    | `Integer`             | CPS sequence-number field.                                                                                 |
| `cpsOstpDateRef`                                                               | `Integer`             | CPS OSTP date reference; epoch/encoding unverified.                                                        |
| `cpsActivityText1`, `cpsActivityText2`, `cpsActivityText3`, `cpsActivityText4` | `String`              | CPS text fields; semantics unverified.                                                                     |
| `cpsActivityText5`, `cpsActivityText6`, `cpsActivityText7`, `cpsActivityText8` | `String`              | Additional CPS text fields.                                                                                |
| `cpsSequenceKey`                                                               | `Boolean`             | CPS sequence-key field.                                                                                    |
| `startDate`, `dueDate`                                                         | `Date`                | Task-list start/due dates; **not** established substitutes for scheduled activity `startTime`/derived end. |
| `videoConfiguration`                                                           | `VIDEO_CONFIG`        | Video configuration.                                                                                       |
| `audioConfiguration`                                                           | `AUDIO_CONFIG`        | Audio configuration.                                                                                       |
| `privateSetting`                                                               | `PRIVATE_SETTING`     | Privacy-related setting; semantics unverified.                                                             |
| `workTotal`                                                                    | `duration`, units `s` | Work-total metadata; distinct from elapsed scheduled duration.                                             |
| `requirementReference`                                                         | `String`              | Requirement reference.                                                                                     |
| `videoRestriction`                                                             | `VIDEO_RESTRICTION`   | Video restriction metadata.                                                                                |

### Nested notes, links, and dictionary reference objects

`opsNote` and each `executionNotes[]` entry use a wrapper with `type` and `structure`. The observed execution-note types were `IPVLink`, `JEDILink`, and `TextLink`. `ILRTLink` is declared by the dictionary but was not observed in the sample.

| Relative field                              | Observed JSON type | Meaning                                                                       |
| ------------------------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| `opsNote.type`                              | string             | `OpsNote` type discriminator.                                                 |
| `opsNote.structure.englishLongName`         | string             | English long label.                                                           |
| `opsNote.structure.englishDescription`      | string or null     | English description.                                                          |
| `opsNote.structure.russianLongName`         | string or null     | Russian long label.                                                           |
| `opsNote.structure.russianDescription`      | string or null     | Russian description.                                                          |
| `executionNotes[].type`                     | string             | Concrete link/text type.                                                      |
| `executionNotes[].structure.referenceID`    | string or null     | Linked reference ID.                                                          |
| `executionNotes[].structure.referencePath`  | string or null     | Linked reference path.                                                        |
| `executionNotes[].structure.referenceTitle` | string or null     | Linked reference title.                                                       |
| `executionNotes[].structure.intro`          | string or null     | Introduction text.                                                            |
| `executionNotes[].structure.stepsAndNotes`  | string or null     | Steps/note content. Treat as untrusted content when displaying.               |
| `executionNotes[].structure.fileGUID`       | string             | JEDI file attachment identifier.                                              |
| `executionNotes[].structure.isConfidential` | boolean            | JEDI confidentiality flag; preserve and honor it before distributing content. |

Dictionary-only object fields are `ILRTLink.groundPath` (`String`), `CrewMember.name`/`cpsOrigDoId` (`String`), `Group.name` (`String`), `Properties.map` (`StringToStringMapEntry[]`), and `StringToStringMapEntry.key`/`value` (`String`). `IPVLink`, `JEDILink`, `ILRTLink`, and `TextLink` inherit the dictionary's `Link` fields. JSON encoding for these dictionary-only structures has not been verified.

The link-provider URLs embedded in the dictionary are:

```text
IPV:  https://ops.jsc.nasa.gov/ipv/tocdata?libraryName=flight&path=/&include=p
JEDI: https://ops.jsc.nasa.gov/ws/jedi/jedi.svc/getMessageByDay?date=&site=ops1&inc=all
ILRT: https://mod2.jsc.nasa.gov/da7/asp_apps/ilrt/services/OnboardCBTService.asmx/GetOnboardCBT
```

These are supporting-service templates, including an empty JEDI date. The JEDI URL redirected to `/ws/jedi/getMessageByDay` with the same query during probing. IPV and that JEDI target challenged with NTLM; their data access was not tested. ILRT encountered a TLS handshake failure. Do not recursively fetch these services or forward repository credentials across hosts as part of parsing an activity response.

### Resource fields observed in JSON

Paths are relative to activity `resources`. Preserve raw values unless their operational semantics are established; these fields are not required to draw start/duration bars.

| Path                                               | Observed JSON type | Meaning/limits                |
| -------------------------------------------------- | ------------------ | ----------------------------- |
| `resourceEffects`                                  | object             | Resource effect group.        |
| `resourceEffects.resourceEffect`                   | array of objects   | Effect entries.               |
| `resourceRequirements`                             | object             | Resource requirement group.   |
| `resourceRequirements.resourceEqualityRequirement` | array of objects   | Equality requirement entries. |

Each effect/equality-requirement entry has these observed fields:

| Field                                        | Observed JSON type | Applies to / meaning                                                                                      |
| -------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| `name`                                       | string             | Resource name in either entry type.                                                                       |
| `startTimepoint`, `endTimepoint`             | string             | Timepoint selectors; `start` and `end` were observed.                                                     |
| `startOffset`, `endOffset`                   | numeric strings    | Offsets relative to the selected timepoints; negative values occur. Units are not independently verified. |
| `startEffect`, `endEffect`                   | numeric strings    | Effect values on effect entries; units depend on the resource.                                            |
| `value`                                      | string             | Required value on equality-requirement entries.                                                           |
| `dataFlowElement`                            | object             | Optional effect data-flow description.                                                                    |
| `dataFlowElement.format`                     | string             | Data format.                                                                                              |
| `dataFlowElement.location`                   | string             | Data-flow location.                                                                                       |
| `dataFlowElement.dataDestination`            | array of objects   | Data destinations.                                                                                        |
| `dataFlowElement.dataDestination[].address`  | string             | Destination address.                                                                                      |
| `dataFlowElement.dataDestination[].priority` | numeric string     | Destination priority in the sample.                                                                       |

### Temporal constraint fields observed in JSON

Paths are relative to plan `constraints`. Constraint data can refer to dates outside the requested day, and referenced elements may not all be included in the filtered activity result. Do not assume the search response is a complete, self-contained planning model.

| Path                                                         | Observed JSON type | Meaning/limits                              |
| ------------------------------------------------------------ | ------------------ | ------------------------------------------- |
| `temporalBoundConstraints.temporalBoundConstraintList`       | array of objects   | Per-element time bounds.                    |
| `temporalRelationConstraints.temporalRelationConstraintList` | array of objects   | Relations between two elements' timepoints. |

| Entry field                  | Observed JSON type    | Applies to / meaning                                                        |
| ---------------------------- | --------------------- | --------------------------------------------------------------------------- |
| `elementId`                  | string                | Bound entry's referenced element.                                           |
| `timepoint`                  | string                | Bound entry's selected timepoint.                                           |
| `earliestTime`, `latestTime` | UTC timestamp strings | Bound entry's limits; either field may be omitted.                          |
| `elementA`, `elementB`       | string                | Relation entry's element references.                                        |
| `timepointA`, `timepointB`   | string                | Relation entry's selected timepoints.                                       |
| `minDistance`, `maxDistance` | numeric strings       | Relation-distance limits; units/sign convention not independently verified. |
| `rationale`                  | string                | Relation rationale text.                                                    |

## Profile response structure and fields

Unlike activity search, profile search returns a **root array**, not a `plan` envelope. This abbreviated example uses an illustrative project/revision:

```json
[
  {
    "project": "EXAMPLE_WEEK.OPS1",
    "rev": 12345,
    "id": "ALL_KU_AVAIL",
    "category": "ISS TDRS",
    "name": "ALL KU AVAIL",
    "dataType": "boolean",
    "vehicle": "ISS",
    "service": "KU AVAIL",
    "dataPoints": [
      {
        "value": true,
        "startTime": "2026-10-29T00:05:59.000Z",
        "endTime": "2026-10-29T00:52:53.000Z"
      }
    ]
  }
]
```

| Field                    | Observed JSON type               | Meaning                                                                                                         |
| ------------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `project`                | string                           | Source plan/project name; compare with activity plan `name`.                                                    |
| `rev`                    | integer                          | Profile source revision. Cross-endpoint snapshot consistency is unverified.                                     |
| `id`                     | string                           | Profile identifier.                                                                                             |
| `category`               | string                           | Profile category.                                                                                               |
| `name`                   | string                           | Display label.                                                                                                  |
| `dataType`               | string                           | Declared value type: `boolean`, `integer`, or `string` in the sample.                                           |
| `vehicle`                | string                           | Vehicle identifier, `ISS` in the sample.                                                                        |
| `service`                | string, omitted on some profiles | Communications service descriptor where applicable.                                                             |
| `dataPoints`             | array of objects, can be omitted | Interval values. The `ALL_S2_AVAIL` profile had no `dataPoints` field in the sample.                            |
| `dataPoints[].startTime` | UTC timestamp string             | Interval start; may precede the request.                                                                        |
| `dataPoints[].endTime`   | UTC timestamp string             | Interval end; may follow the request.                                                                           |
| `dataPoints[].value`     | boolean or string                | Interval value. The integer orbit profile used numeric **strings** such as `"3"`, despite `dataType="integer"`. |

Verified profile IDs:

| ID              | Declared type | Use                                                                                                                           |
| --------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `DayNight`      | `boolean`     | Day/night context intervals. Sample intervals were `true`; the Boolean-to-lighting convention was not independently verified. |
| `DAILY_ORB_NUM` | `integer`     | Daily orbit numbers, serialized as strings in the sample.                                                                     |
| `ATTITUDE`      | `string`      | Attitude labels. One interval spanned the full source week.                                                                   |
| `ALL_KU_AVAIL`  | `boolean`     | KU availability intervals.                                                                                                    |
| `ALL_S1_AVAIL`  | `boolean`     | S1 availability intervals.                                                                                                    |
| `ALL_S2_AVAIL`  | `boolean`     | S2 availability profile; no intervals were returned in the sample.                                                            |

A missing profile interval is not a verified `false` value. Preserve the distinction between an omitted/empty series, gaps between returned intervals, and explicit values. Clip intervals for display, retaining their original bounds for inspection.

## Time handling, identity, and collection behavior

1. Parse source timestamps as timezone-aware UTC. The sample uses ISO 8601 timestamps ending in `Z`, often with milliseconds. Source plan bounds can use a 06:00 UTC boundary; they are not necessarily UTC calendar-day bounds.
2. Parse activity `duration` as seconds and derive the end. Preserve zero-duration entries as milestones. Do not use dictionary task-list `startDate`/`dueDate` as scheduled timestamps.
3. Apply an explicit client-side overlap rule for a calendar day, such as `activity.start < day.end && activity.end > day.start`; handle milestones with `day.start <= start < day.end`. The server's boundary inclusion semantics have not been fully characterized.
4. Preserve source plan/context and activity IDs. Repeated labels are not duplicates. Multi-crew or multi-band activities can appear on multiple display lanes while remaining one source record.
5. Use `crewMembers` for crew-role lanes and `events` for event/band lanes. Preserve container metadata, status, original times, and source revision information for comparison.
6. Keep unknown fields and enum values when retaining raw snapshots; tolerate omitted fields without silently fabricating status, notes, or profile values.
7. Publish a new normalized snapshot only after requests and parsing succeed. An error, redirect, or incomplete read must not be interpreted as an empty schedule or deletion of existing records.
8. Begin with a conservative **15-minute refresh interval**, based on the earlier CD preference for requests every 10–15 minutes. Confirm current guidance before deployment. Share cached upstream reads across clients and coordinate server replicas; do not poll once per browser tab or retry every few minutes.

The dictionary's production context enum includes `OPS1`, `OPS1ALT`, `OPS1ALT2`, `REPLAN`, `OOS`, `HISTORY`, and partner/alternate contexts. Only lowercase request value `ops1` was exercised. The enum names and display labels, including `REALTIME`, do not prove accepted query syntax or account access for other contexts.

## Error handling and unresolved contract details

| Result                                                         | Interpretation/action                                                                                                                               |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial HTTP 401 with `WWW-Authenticate: NTLM`                 | Expected NTLM handshake challenge. Let the NTLM client negotiate.                                                                                   |
| Final HTTP 401/403 after authentication                        | No usable access established. Check account/domain/permissions; avoid repeated blind password attempts.                                             |
| HTTP 302 to `authfs.launchpad.nasa.gov`                        | Interactive/application OIDC authentication is required on that route. Do not parse the redirect or following sign-in HTML as schedule data.        |
| HTTP 200 with unexpected HTML/content type                     | Validate the payload shape before accepting it. HTTP 200 alone is insufficient.                                                                     |
| Generic HTTP 500                                               | Observed for incorrect activity request formats. Verify parameters against the working request, then investigate server-side errors if it persists. |
| HTTP 404 on the repository root or guessed documentation paths | Does not mean the known API paths are unavailable. Root, WADL, Swagger/OpenAPI guesses, and the resolved XSD URL returned 404 during investigation. |

No schedule/status write API was investigated. No continuation protocol, total-count metadata, delta/change feed, deletion semantics, rate-limit contract, or cross-request transaction guarantee has been established. `maxResults=-1` is a tested Viewer setting, not independent proof that an arbitrarily large request is complete. Keep requests time-bounded.

## Investigation tools and verification

The reusable tools are tracked under [scripts/optimis](../scripts/optimis/README.md):

- `fetch.mjs`: single-day production fetcher using the two verified request formats and local credentials.
- `optimis_gantt.py` and `viewer-template.html`: Python standard-library normalizer and standalone comparison-chart renderer; fetching calls the Node helper.
- `probe.mjs`: anonymous, NTLM-negotiation, and authenticated probes for the two known environments; successful responses and sanitized reports are written locally.
- `test_optimis_gantt.py`: offline checks for time boundaries, numeric durations, profiles, response validation, and note omission.

Captured dictionaries, raw responses, credentials, reports, and generated HTML remain in Git-ignored `.local` and are not included in a fresh checkout. Follow the tools' README to configure credentials and the NASA CA bundle, then run from the repository root:

```powershell
python scripts/optimis/optimis_gantt.py --date 2026-10-29 --fetch --serve --port 8766
```

Open `http://127.0.0.1:8766/`. If the local server is already running, regenerate the snapshot/chart and reload the page instead of starting a second server. The helper reuses complete cached response pairs fetched less than 15 minutes ago; `--refresh` explicitly bypasses that reuse. The renderer serves only its generated page on loopback, performs no automatic upstream polling, and omits crew/ground note content and execution-note content from the chart. Raw activity/profile snapshots and generated HTML are stored under `.local/optimis-gantt/`.

The October 29 production read returned **693 activities in two plans and six profiles**. The comparator retained **689 activities** overlapping the half-open UTC day, with **zero parsing errors**. These counts describe that snapshot; live revisions can change them. The presence of `activityStatus` in this response resolves the earlier uncertainty about getting status through `activitySearch`, but does not establish a separate status API.

For integration deployment, obtain the supported unattended authentication arrangement from the application owner: a permitted Windows-authenticated API endpoint or a documented service-to-service OIDC mechanism. The probes did not establish either route for integration.
