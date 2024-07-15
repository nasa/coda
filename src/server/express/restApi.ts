import packageJSON from "../../../package.json";
import express, { Application } from "express";
import cors from "cors";
import locationIssRoute from "./routes/location/iss";
import dayNightRoute from "./routes/daynight/daynight";
import sgAudioRoute from "./routes/emss/sgAudio";
import transcriptsRoute from "./routes/emss/transcripts";
import executeTimelineStatusRoute from "./routes/maestro/executeTimelineStatus";
import photosRoute from "./routes/media/photos";
import videosRoute from "./routes/media/videos";
import emssVideosRoute from "./routes/media/emssVideos";
import evasRoute from "./routes/sequences/evas";
import gpsRoute from "./routes/db/gps";
import mediaOverridesRoute from "./routes/db/mediaOverrides";
import graphsRoute from "./routes/sequences/graphs";
import testEventsRoute from "./routes/sequences/test-events";
import clearRoute from "./routes/cache/clear";
import clearAllRoute from "./routes/cache/clearAll";
import enableDisableEmssVideoRoute from "./routes/media/enableDisableEmssVideo";

const app: Application = express();

app.use(express.json({ limit: "20mb" }));
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Serve a successful response. For use with wait-on
app.get("/api/v1/health", (req, res) => {
  res.send({ status: "ok" });
});

app.get("/api/v1/version", (req, res) => {
  res.send({ version: packageJSON.version });
});
app.use("/api/v1/daynight/daynight", dayNightRoute);
app.use("/api/v1/emss/sgAudio", sgAudioRoute);
app.use("/api/v1/emss/transcripts", transcriptsRoute);
app.use("/api/v1/location/iss", locationIssRoute);
app.use("/api/v1/maestro/executeTimelineStatus", executeTimelineStatusRoute);
app.use("/api/v1/media/photos", photosRoute);
app.use("/api/v1/media/videos", videosRoute);
app.use("/api/v1/media/emssVideos", emssVideosRoute);
app.use("/api/v1/media/enableDisableEmssVideo", enableDisableEmssVideoRoute);
app.use("/api/v1/sequences/evas", evasRoute);
app.use("/api/v1/sequences/graphs", graphsRoute);
app.use("/api/v1/sequences/test-events", testEventsRoute);
app.use("/api/v1/cache/clear", clearRoute);
app.use("/api/v1/cache/clearAll", clearAllRoute);
app.use("/api/v1/db/gps", gpsRoute);
app.use("/api/v1/db/mediaOverrides", mediaOverridesRoute);
export default app;
