import { useSelector } from "react-redux";
import { RootState } from "store/index";

export default function EventInfo(props: { frameID: number }) {
  const playheadDate = useSelector((state: RootState) => state.playhead.date);

  const getAgAudio = () => {
    const url = `https://emss-labs.fit.nasa.gov/transcriptions/${dateWanted}/transcript-SG${i}.json`;
    const unprocessedTranscript: UnprocessedTranscript = {
      sgNum: i,
      unprocessedUtterances: [],
    };
    try {
      const res = await fetch(url);
      unprocessedTranscript.unprocessedUtterances = await res.json();
    } catch (e) {
      unprocessedTranscript.unprocessedUtterances = [];
    }
  };

  return <></>;
}
