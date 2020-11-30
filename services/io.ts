/*
SERVER ONLY methods for fetching from IO. Only use this code within `getStaticProps()` or `getServerSideProps()` functions
*/
import fetch from "node-fetch";

function getIO(params: string) {
  const url = `${process.env.IO_API_URL}&${params}`;
  const options = {
    headers: {
      "Accept-Encoding": "gzip,deflate",
      "Accept-Language": "en-us",
      cacert: process.env.CA_CERT,
      Connection: "keep-alive",
      "Content-Type": "application/json; charset=utf-8",
      cookie: process.env.COOKIE_JAR,
      "cookie-jar": process.env.COOKIE_JAR,
      "Script-Charset": "utf-8",
      "X-SKIP-SAML": "True",
    },
  };
  return fetch(url, options);
}

/**
 * Fetch video data from IO
 */
export default async function getVideoData(
  year: number,
  month: number,
  day: number
): Promise<any> {
  const rangeStartYear = year;
  const rangeStartMonth = month;
  const rangeStartDay = day;
  const rangeEndYear = year;
  const rangeEndMonth = month;
  const rangeEndDay = day;

  const rangeStartIO =
    rangeStartMonth + "-" + rangeStartDay + "-" + rangeStartYear;
  const rangeEndIO = rangeEndMonth + "-" + rangeEndDay + "-" + rangeEndYear;
  const rangeStartTimeline = new Date(
    Date.UTC(rangeStartYear, rangeStartMonth, rangeStartDay) - 60 * 60 * 1000
  );
  const rangeEndTimeline = new Date(
    Date.UTC(rangeEndYear, rangeEndMonth, rangeEndDay) + 6 * 60 * 60 * 1000
  );

  const queryParams = `s_dt=${rangeStartIO}&e_dt=${rangeEndIO}&as=2?key=${process.env.IO_KEY}&format=json`;

  return getIO(queryParams)
    .then((res) => res.json())
    .then(parseIOResponse);
}

function parseIOResponse(res) {
  const gVideoItems = [];
  let gTimingData = {};

  const docs = res.results.response.docs;
  const output = "";
  let className;
  let beyondSixGroupId;
  let nonDownlinkGroupId;
  let earliestStart;
  let latestEnd;

  const groups = [
    { id: 0, content: "D/L 01", value: 1 },
    { id: 1, content: "D/L 02", value: 2 },
    { id: 2, content: "D/L 03", value: 3 },
    { id: 3, content: "D/L 04", value: 4 },
    { id: 4, content: "D/L 05", value: 5 },
    { id: 5, content: "D/L 06", value: 6 },
  ];

  let allowDownlinksBeyondSix = false;
  let allowNonDownlinks = true;

  if (allowDownlinksBeyondSix) {
    beyondSixGroupId = groups.length;
    groups.push({
      id: beyondSixGroupId,
      content: "Other D/L",
      value: beyondSixGroupId + 1,
    });
  }

  if (allowNonDownlinks) {
    nonDownlinkGroupId = groups.length;
    groups.push({
      id: nonDownlinkGroupId,
      content: "Non-Downlink",
      value: nonDownlinkGroupId + 1,
    });
  }

  for (var i = 0; i < docs.length; i++) {
    var d = docs[i];

    var channel = getChannel(d.collections_string);

    if (channel) {
      if (["01", "02", "03", "04", "05", "06"].indexOf(channel) > -1) {
        className = "downlink-" + channel;
        var group = parseInt(channel) - 1;
      } else {
        if (!allowDownlinksBeyondSix) continue;
        className = "downlink-other";
        group = beyondSixGroupId;
      }
      var content = d.md_title;
    } else {
      // FOR NOW, FILTERING OUT NON DOWNLINKS
      if (!allowNonDownlinks) {
        continue;
      }

      className = "non-downlink-video";
      content = "Non-Downlink: " + d.md_title;
      group = nonDownlinkGroupId;
    }

    if (!d.duration_seconds) {
      d.duration_seconds = 0;
    }
    d.duration_ms = d.duration_seconds * 1000;

    // Create array of date elements from creation date
    var dateArr = d.md_creation_date
      .match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z/) // regex match for the date
      .slice(1) // remove the first item (the full matched string)
      .map(function (n) {
        return parseInt(n);
      }); // for each element, convert to integer

    //********** EXCEPTION for video recorded during LOS
    // NASA IDs are like iss053m532781939
    // Breakdown:
    // iss  = ISS video
    // 053  = Expedition 53
    // m    = moving imagery e.g. video
    // 53   = Downlink 3, downlinked after an LOS. Realtime downlink would be 03
    // 278  = GMT day 278
    // 1939 = Actual start time of the video
    //
    // Note that 19:39 is the actual GMT start time of this video for a non-realtime
    // downlink. The "Start GMT" listed in IO is wrong, stating GMT 0600.
    const id_metadata = d.nasa_id.match(/iss\d{3}m(\d)(\d)\d+(\d{2})(\d{2})/);
    if (id_metadata && id_metadata[1] === "5") {
      dateArr[3] = id_metadata[3];
      dateArr[4] = id_metadata[4];
      dateArr[5] = "00";
      className = "downlink-LOS";
    }

    // create date object. Note, month is 0-11 in javascript.
    const UTCstartMilliseconds = Date.UTC(
      dateArr[0],
      dateArr[1] - 1,
      dateArr[2],
      dateArr[3],
      dateArr[4],
      dateArr[5]
    );
    const UTCstart = new Date(UTCstartMilliseconds),
      UTCend = new Date(UTCstartMilliseconds + d.duration_ms);
    const dateString = function (a) {
      return a.toJSON().slice(0, 10) + " " + a.toJSON().slice(11, 19);
      // return a.getUTCFullYear() + '-' + a.getUTCMonth() + '-' + a.getUTCDate()
      // + ' ' + a.getUTCHours() + ':' + a.getUTCMinutes() + ':' + a.getUTCSeconds();
    };

    if (
      !gTimingData["video_earliestStart"] ||
      UTCstart.getTime() < gTimingData["video_earliestStart"].getTime()
    ) {
      gTimingData["video_earliestStart"] = new Date(UTCstart.toUTCString());
    }
    if (
      !gTimingData["video_latestEnd"] ||
      UTCend.getTime() > gTimingData["video_latestEnd"].getTime()
    ) {
      gTimingData["video_latestEnd"] = new Date(UTCend.toUTCString());
    }

    var url = process.env.HOST_IO + "/app/info.cfm?pid=" + d.id;

    var videoUrl =
      process.env.HOST_IO +
      d.webpath +
      "/video/" +
      d.nasa_id +
      "." +
      d.file_extension_video;

    if (className === "downlink-LOS") {
      var priority = 0;
    } else {
      priority = 1;
    }

    gVideoItems.push({
      id: i + 1,
      content: content,
      description: d.description,
      start: UTCstart,
      end: UTCend,
      url: url,
      videoUrl: videoUrl,
      className: className,
      priority: priority,
      md_creation_date: d.md_creation_date,
      group: group,
    });
  }
  gTimingData["EVA_duration_seconds"] =
    (gTimingData["video_latestEnd"] - gTimingData["video_earliestStart"]) /
    1000;

  for (i = 0; i < gVideoItems.length; i++) {
    gVideoItems[i]["missionSecondsStart"] =
      (gVideoItems[i]["start"] - gTimingData["video_earliestStart"]) / 1000;
    gVideoItems[i]["missionSecondsEnd"] =
      (gVideoItems[i]["end"] - gTimingData["video_earliestStart"]) / 1000;
    gVideoItems[i]["durationSeconds"] =
      gVideoItems[i]["missionSecondsEnd"] -
      gVideoItems[i]["missionSecondsStart"];
  }

  gVideoItems.sort(
    //sorts by priority first, then duration second. Counterintuitively, this array is later used to choose the item with the highest array position for the preferred video stream for a given group and time.
    function (a, b) {
      return (
        +(a.priority > b.priority) ||
        +(a.priority === b.priority) - 1 ||
        +(a.durationSeconds > b.durationSeconds) ||
        +(a.durationSeconds === b.durationSeconds) - 1
      );
    }
  );

  const gVideoActivityByGroupBySecond = createMissionVideoActivity(
    gTimingData,
    gVideoItems
  );

  return { gTimingData, gVideoActivityByGroupBySecond, gVideoItems };
}

function createMissionVideoActivity(gTimingData, gVideoItems) {
  const gVideoActivityByGroupBySecond = [];
  for (let group = 0; group <= 6; group++) {
    const groupSecondsArray = [];
    for (let second = 0; second < gTimingData.EVA_duration_seconds; second++) {
      const vidsThisGroupThisSecond = [];
      for (let i = 0; i < gVideoItems.length; i++) {
        if (
          gVideoItems[i].group === group &&
          second >= gVideoItems[i].missionSecondsStart &&
          second <= gVideoItems[i].missionSecondsEnd
        ) {
          vidsThisGroupThisSecond.push(i);
        }
      }
      let vidIndex;
      if (vidsThisGroupThisSecond.length > 0) {
        vidIndex = vidsThisGroupThisSecond[vidsThisGroupThisSecond.length - 1];
      } else {
        vidIndex = -1;
      }
      groupSecondsArray.push(vidIndex);
    }
    gVideoActivityByGroupBySecond.push(groupSecondsArray);
  }
  return gVideoActivityByGroupBySecond;
}

/**
 * Pull a channel from the IO response of available channels. Exported for testing purposes.
 */
export function getChannel(collectionStrings: string[]): string {
  for (let j = 0; j < collectionStrings.length; j++) {
    const chMatch = collectionStrings[j].match(/US Downlink\|Channel (\d+)/);

    if (chMatch) {
      return chMatch[1];
    }
  }
}
