import express, { Application } from "express";
import cors from "cors";
import { RequestContext } from "@mikro-orm/postgresql";
import dayNightRoute from "./routes/daynight/daynight";
import dataRefreshRoute from "./routes/emss/dataRefresh";
import dataViewRoute from "./routes/emss/dataView";
import liveVideoToggleRoute from "./routes/emss/liveVideoToggle";
import gpsRoute from "./routes/db/gps";
import ephemerisRoute from "./routes/db/ephemeris";
import mediaOverridesRoute from "./routes/db/mediaOverrides";
import ancillaryDataRoute from "./routes/db/ancillaryDataSources";
import getCurrentUser from "./routes/user/auth";
import logFromClient from "./routes/user/logFromClient";
import profiler from "./routes/profiler/profiler";
import videoRoute from "./routes/db/video";
import photoRoute from "./routes/db/photos";
import assetOverridesRoute from "./routes/db/assetOverrides";
import accessGrantsRoute from "./routes/db/accessGrants";
import restrictedVideosRoute from "./routes/restricted/videos";
import pcdAudioRoute from "./routes/db/pcdAudio";
import { getORM, globalValues } from "./global";
import timeRoute from "./routes/time/time";

const app: Application = express();

app.use(express.json({ limit: "20mb" }));
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Mikro-ORM RequestContext should be last middleware before routes
// https://mikro-orm.io/docs/identity-map#request-context
// use Mikro-ORM RequestContext for express and socketio handlers
app.use((_req, _res, next) => {
  RequestContext.create(getORM().em, next);
});

// Serve a successful response. For use with wait-on
app.get("/api/v1/health", (_req, res) => {
  res.send({ status: "ok" });
});

app.get("/api/v1/version", (_req, res) => {
  res.send(globalValues.appVersion);
});

app.use("/api/v1/external/daynight/daynight", dayNightRoute); // external endpoint for maestro
app.use("/api/v1/emss/dataRefresh", dataRefreshRoute); // routed through launchpad
app.use("/api/v1/emss/dataView", dataViewRoute); // routed through launchpad
app.use("/api/v1/emss/liveVideoToggle", liveVideoToggleRoute); // routed through launchpad
app.use("/api/v1/db/gps", gpsRoute);
app.use("/api/v1/db/ephemeris", ephemerisRoute);
app.use("/api/v1/db/mediaOverrides", mediaOverridesRoute);
app.use("/api/v1/db/ancillaryDataSources", ancillaryDataRoute);
app.use("/api/v1/db/videoStartTimeOverrides", videoRoute);
app.use("/api/v1/db/photoTimeShifts", photoRoute);
app.use("/api/v1/db/assetOverrides", assetOverridesRoute);
app.use("/api/v1/db/accessGrants", accessGrantsRoute);
app.use("/api/v1/restricted/videos", restrictedVideosRoute); // routed through launchpad — see RESTRICTED_OVERRIDES.md
app.use("/api/v1/db/pcdAudio", pcdAudioRoute);
app.use("/api/v1/user/current", getCurrentUser); // routed through launchpad
app.use("/api/v1/log/from-client", logFromClient);
app.use("/api/v1/profile", profiler);
app.use("/api/v1/time", timeRoute); // simple route to get server time
export default app;
