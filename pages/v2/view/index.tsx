import { isNull } from "lodash";
import Head from "next/head";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchEVAs } from "http-client/sequences";
import Header from "components/v2/header-v2";
import Viewer from "components/v2/viewer";
import { RootState } from "store/index";
import { changeDate, changeTime, diff, isSameDate } from "store/playhead";
import { addSequences, fetchError as sequencesFetchError } from "store/sequences";
import useInterval from "utils/useInterval";
import styles from "./index.module.css";
import _ from "lodash";

const FIVE_MINS_MS = 5 * 60 * 1000;

export default function V2(props: { query: QueryParams }) {
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

  /** Update the EVA store */
  const updateEVAs = () => {
    (async () => {
      try {
        // EVA data from the wiki
        const updatedEVAs = await fetchEVAs();
        dispatch(addSequences(updatedEVAs));
      } catch (e) {
        dispatch(sequencesFetchError(e.toString()));
        console.error(e);
      }
    })();
  };

  // fetch updated data when the page loads
  useEffect(updateEVAs, []);

  // look for wiki info every 5 mins
  useInterval(updateEVAs, FIVE_MINS_MS);

  return (
    <div className={styles.main}>
      <Head>
        <title>{process.env.NEXT_PUBLIC_TITLE}</title>
      </Head>
      <Header />
      <div className={styles.body}>
        <Viewer />
      </div>
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

  const queryParams = [
    "frameType1",
    "frameState1",
    "frameType2",
    "frameState2",
    "frameType3",
    "frameState3",
    "frameType4",
    "frameState4",
    "frameType5",
    "frameState5",
    "frameType6",
    "frameState6",
  ];

  // TODO: work on a system for new query params and translating old ones
  // maybe old one triggers a layout that is the same as the original?

  const queryValues = queryParams.map((qp) => _.get(query, qp, null)); // eslint-disable-line @typescript-eslint/no-unused-vars

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
