import packageJSON from "../../../package.json";
import express, { Application } from "express";
import cors from "cors";
import locationIssRoute from "./routes/location/iss";
import dayNightRoute from "./routes/daynight/daynight";
import sgAudioRoute from "./routes/emss-labs/sgAudio";
import transcriptsRoute from "./routes/emss-labs/transcripts";
import executeTimelineStatusRoute from "./routes/maestro/executeTimelineStatus";
import photosRoute from "./routes/media/photos";
import videosRoute from "./routes/media/videos";
import evasRoute from "./routes/sequences/evas";
import gpsRoute from "./routes/sequences/gps";
import graphsRoute from "./routes/sequences/graphs";
import testEventsRoute from "./routes/sequences/test-events";

const app: Application = express();

app.use(express.json({ limit: "20mb" }));
app.use(cors());
app.use(express.urlencoded({ extended: true }));

app.get("/api/v1/version", (req, res) => {
  res.send({ version: packageJSON.version });
});
app.use("/api/v1/daynight/daynight", dayNightRoute);
app.use("/api/v1/emss-labs/sgAudio", sgAudioRoute);
app.use("/api/v1/emss-labs/transcripts", transcriptsRoute);
app.use("/api/v1/location/iss", locationIssRoute);
app.use("/api/v1/maestro/executeTimelineStatus", executeTimelineStatusRoute);
app.use("/api/v1/media/photos", photosRoute);
app.use("/api/v1/media/videos", videosRoute);
app.use("/api/v1/media/manifest-manifest", (req, res) => {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const startMs = start.getTime();

  const msToday = Date.now() - startMs;
  const fourMinutes = 4 * 60 * 1000;
  const fiveMinutes = 5 * 60 * 1000;

  let currentToday = 0;

  const videos: VideoFile[] = [];
  while (currentToday < msToday) {
    const currentUtcMs = startMs + currentToday;
    videos.push({
      id: "vid" + currentToday,
      description: `The fake video at ${currentToday}ms`,
      collection: "Rick Astley",
      collections: "Rick Astley",
      dataURL: "https://www.youtube.com/watch?v=oHg5SJYRHA0",
      mediaLowResURL: "https://en.wikipedia.org/wiki/Rickrolling#/media/File:RickRoll.png",
      start: currentUtcMs,
      end: currentUtcMs + fourMinutes,
      downlink: 7,
      LOS: false,
      priority: 1,
      startDateTime: new Date(currentUtcMs).toISOString(),
    });
    currentToday += fiveMinutes;
  }

  res.status(200).json(videos);
  return;
});
app.use("/api/v1/sequences/evas", evasRoute);
app.use("/api/v1/sequences/gps", gpsRoute);
app.use("/api/v1/sequences/graphs", graphsRoute);
app.use("/api/v1/sequences/test-events", testEventsRoute);
export default app;
