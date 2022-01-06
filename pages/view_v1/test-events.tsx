import isNull from "lodash/isNull";
import Head from "next/head";
import { useSelector } from "react-redux";
// import Body from "components/body";
import { RootState } from "store/index";
import { Collection } from "utils/enums";

export default function View(props: { query: QueryParams }) {
  const playheadDate = useSelector((state: RootState) => state.playhead.date);

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
          {prefix} Test Events | {process.env.NEXT_PUBLIC_TITLE}
        </title>
      </Head>
      {/* <Body collection={Collection.TEST_EVENTS} {...props} /> */}
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
