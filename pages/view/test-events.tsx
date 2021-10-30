import isNull from "lodash/isNull";
import Head from "next/head";
import { useDispatch, useSelector } from "react-redux";
import Main from "components/main-te";
import { fetchRockYard } from "http-client/sequences";
import { buildVideoStore, buildPhotoStore, buildPhotoCollections } from "http-client/media";
import { addVideos, fetchError as videosFetchError } from "store/videos";
import { addPhotos, fetchError as photosFetchError, setCollectionFilters } from "store/photos";
import { addSequences, fetchError as sequencesFetchError } from "store/sequences";
import { useEffect } from "react";
import { diff, isSameDate, changeDate, changeTime } from "store/playhead";
import useInterval from "utils/useInterval";
import { RootState } from "store/index";
import { Collection } from "typings";
import { buildAncillaryPayloadsStore } from "http-client/ancillary";
import { ancillaryFetchError, AncillaryState, setAncillaryData } from "store/ancillary";

const FIVE_MINS_MS = 5 * 60 * 1000;

export default function View(props: { query: QueryParams }) {
  const playheadDate = useSelector((state: RootState) => state.playhead.date);

  const dispatch = useDispatch();

  // make sure the application is running on the correct date
  let userDate = null;

  const yyyymmdd = /^\d{4}-(0?[1-9]|1[012])-(0?[1-9]|[12][0-9]|3[01])$/;
  if (!isNull(props.query.date) && !isNull(props.query.date.match(yyyymmdd))) {
    // change the date if the user set the `date` query param
    userDate = new Date(props.query.date);
  } else {
    // default the date to today
    userDate = new Date();
  }

  // we will ignore the datetime if it is in the future! (CODA doesn't have precogs yet!)
  // https://youtu.be/m_0s8IZWkBg
  const isFutureDate = diff(userDate, new Date()) > 0;

  // we will ignore the datetime if it is invalid
  const isMalformedDate = isNaN(userDate.valueOf());

  if (isFutureDate || isMalformedDate) {
    // set the date today
    const d = new Date();
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const day = d.getUTCDate();
    userDate = new Date(Date.UTC(year, month, day));
  }

  useEffect(() => {
    if (!playheadDate || !isSameDate(new Date(playheadDate), userDate)) {
      dispatch(changeDate(userDate.toISOString()));
    }
  }, []);

  useEffect(() => {
    // TODO: also use sstart to jump ahead
    // explicit time overwrites sstart

    // make sure the application is running on the correct time
    // default the time to 00:00:00Z
    let userTime = 0;

    // change the time if the user set the `gmt` query param
    if (!isNull(props.query.gmt)) {
      const [hh, mm, ss = 0] = props.query.gmt.split(":").map(Number);
      userTime = hh * 3600 + mm * 60 + ss;
    }

    dispatch(changeTime(userTime));
  }, []);

  // grab videos
  useEffect(() => {
    (async () => {
      if (isNull(playheadDate)) {
        return;
      }

      const d = new Date(playheadDate);

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const day = d.getUTCDate();

      try {
        // video data for this EVA
        const videoStore = await buildVideoStore(year, month + 1, day, Collection.TEST_EVENTS);
        dispatch(addVideos(videoStore));
      } catch (e) {
        dispatch(videosFetchError(e.toString()));
        console.error(e);
      }
    })();
  }, [playheadDate]);

  // Grab photos
  useEffect(() => {
    (async () => {
      if (isNull(playheadDate)) {
        return;
      }

      const d = new Date(playheadDate);

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const day = d.getUTCDate();

      try {
        // photos data for today
        const photoStore = await buildPhotoStore(year, month + 1, day, Collection.TEST_EVENTS);
        dispatch(addPhotos(photoStore));
        const photoCollectionsFilter = buildPhotoCollections(photoStore);
        dispatch(setCollectionFilters(photoCollectionsFilter));
      } catch (e) {
        dispatch(photosFetchError(e.toString()));
        console.error(e);
      }
    })();
  }, [playheadDate]);

  // Grab ancillary data from govcloud
  useEffect(() => {
    (async () => {
      if (isNull(playheadDate)) {
        return;
      }

      const d = new Date(playheadDate);

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const day = d.getUTCDate();

      try {
        const ancillaryDataStore: AncillaryState = await buildAncillaryPayloadsStore(
          year,
          month,
          day,
          "test_event"
        );
        dispatch(setAncillaryData(ancillaryDataStore));
      } catch (e) {
        dispatch(ancillaryFetchError(e.toString()));
        console.error(e);
      }
    })();
  }, [playheadDate]);

  // look for new videos every 5 minutes if the user is looking at today's date
  useInterval(() => {
    (async () => {
      // the playhead hasn't been set, no point in looking for videos
      if (isNull(playheadDate)) {
        return;
      }

      const d = new Date(playheadDate);
      if (!isSameDate(d, new Date())) {
        // the user is looking at a date in the past. no need to keep looking for new videos
        return;
      }

      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const day = d.getUTCDate();

      try {
        // video data for this EVA
        const videoStore = await buildVideoStore(year, month, day, Collection.TEST_EVENTS);
        dispatch(addVideos(videoStore));
      } catch (e) {
        dispatch(videosFetchError(e.toString()));
        console.error(e);
      }
    })();
  }, FIVE_MINS_MS);

  /** Update the EVA store */
  const updateEVAs = () => {
    (async () => {
      try {
        // EVA data from the wiki
        const updatedEVAs = await fetchRockYard();
        dispatch(addSequences(updatedEVAs));
      } catch (e) {
        dispatch(sequencesFetchError(e.toString()));
        console.error(e);
      }
    })();
  };

  // fetch updated data when the date changes
  useEffect(updateEVAs, [playheadDate]);

  // look for wiki info every 5 mins
  useInterval(updateEVAs, FIVE_MINS_MS);

  let prefix = "Viewer";
  if (!isNull(playheadDate)) {
    const d = new Date(playheadDate);
    const options: Intl.DateTimeFormatOptions = {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "2-digit",
    };
    prefix = d.toLocaleDateString("en-gb", options);
  }

  return (
    <div>
      <Head>
        <title>
          {prefix} Test Event | {process.env.NEXT_PUBLIC_TITLE}
        </title>
      </Head>
      <Main {...props} />
    </div>
  );
}

export async function getServerSideProps({ query }) {
  const date = query.date === undefined ? null : query.date;
  const gmt = query.gmt === undefined ? null : query.gmt;
  const video1 = query.video1 === undefined ? null : query.video1;
  const video2 = query.video2 === undefined ? null : query.video2;
  const nonDLvideo1 = query.nonDLvideo1 === undefined ? null : query.nonDLvideo1;
  const nonDLvideo2 = query.nonDLvideo2 === undefined ? null : query.nonDLvideo2;

  const returnVal: QueryParams = {
    gmt,
    date,
    video1,
    video2,
    nonDLvideo1,
    nonDLvideo2,
  };

  return {
    props: {
      query: returnVal,
    },
  };
}

export interface QueryParams {
  /** yyyy-mm-dd the user wants to view */
  date: string;
  /** UTC hh:mm the user wants to view */
  gmt: string;
  /** Downlink number the user wants to view in player 1 */
  video1: string;
  /** Downlink number the user wants to view in player 2 */
  video2: string;
  /** ID of the non-D/L video the user wants to view in player 1 */
  nonDLvideo1: string;
  /** ID of the non-D/L video the user wants to view in player 2 */
  nonDLvideo2: string;
}
