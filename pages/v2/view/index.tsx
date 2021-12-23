import Head from "next/head";
import Header from "components/v2/framework/header-v2";
import Viewer from "components/v2/framework/viewer";
import styles from "./index.module.css";
import _ from "lodash";
import Timeline from "components/v2/panes/nav-timeline-v2";
import { Collection } from "utils/enums";
import WithPlayheadMonitor from "components/with-playhead-monitor";

export function V2(props: { query: QueryParams }) {
  return (
    <div className={styles.main}>
      <Head>
        <title>{process.env.NEXT_PUBLIC_TITLE}</title>
      </Head>
      <Header collection={Collection.ISS} />
      <div className={styles.body}>
        <Viewer query={props.query} collection={Collection.ISS} />
      </div>
      <Timeline collection={Collection.ISS} />
    </div>
  );
}

export default WithPlayheadMonitor(V2);

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
