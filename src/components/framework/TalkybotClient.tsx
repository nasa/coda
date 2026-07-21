import { FunctionComponent, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { useAppDispatch } from "utils/useAppDispatch";
import { refEqual, useAppSelector } from "utils/useAppSelector";
import { usePlayheadDate } from "store/hooks";
import { isDataTypeValidForSource } from "utils/sourceDataTypeMap";
import {
  clearTalkybotAudioFiles,
  setTalkybotAudioFiles,
  upsertTalkybotAudioFile,
} from "store/talkybot";
import {
  filterAudioFilesForSource,
  getTalkybotBaseUrl,
  toTbAudioFileConverted,
} from "utils/talkybot";
import ConsoleLogger from "utils/logging/consoleLogger";

/**
 * TalkybotClient — makes the CODA browser a *native Talkybot client*.
 *
 * Connects directly (cross-origin, with the shared `.fit.nasa.gov` auth cookie) to a
 * Talkybot server's Socket.IO + REST API and feeds the comm pane's Redux slice:
 *   - On (source, date) change it loads that date's transcript and CODA's legacy comm
 *     overrides, filters to the current CODA source, and replaces the slice contents.
 *   - A persistent socket pushes new utterances live; each is filtered to the current
 *     source + date (read via refs) and upserted.
 *
 * Replaces the old server-to-server path (talkybotS2sSocket + the talkybot data-fetch
 * config that pushed over CODA's own socket). Mounted alongside SocketClient.
 */

/** Talkybot client-facing socket events we consume. */
interface TalkybotServerToClientEvents {
  audioFile: (payload: TbAudioFileNative) => void;
}

/** Talkybot's per-date transcript response (only the fields we use). */
interface TalkybotTranscriptResponse {
  date: string;
  audioFiles: TbAudioFileNative[];
}

const TalkybotClient: FunctionComponent = () => {
  const dispatch = useAppDispatch();
  // The base UTC date being viewed. usePlayheadDate() is guaranteed non-null: it returns
  // state.clock.date once view/index.tsx has applied the URL date, and falls back to today
  // (midnight Z) before then. We use it instead of the raw state.clock.date because for
  // ISS *today* (no `date` URL param) view/index.tsx never dispatches setDate — playhead
  // already equals today — so clock.date stays null forever and a raw-null guard would
  // never let us fetch (spinner spins forever). The fallback is the correct date for today,
  // and for any non-today URL date setDate is always dispatched before this settles.
  // Stays put during playback (the live playhead advances via appSeconds, not clock.date).
  const clockDate = usePlayheadDate();
  const source = useAppSelector((state) => state.framework.source, refEqual);

  // Latest source/date for the live socket handler to read without forcing a reconnect.
  const sourceRef = useRef<Source | null>(source);
  const dateRef = useRef<string | null>(null);
  sourceRef.current = source;

  // Persistent direct socket to Talkybot. Room membership (which channels the user can
  // hear) is decided server-side from the shared auth cookie; we filter what arrives.
  const socket = useRef<Socket<TalkybotServerToClientEvents> | null>(null);

  useEffect(() => {
    const baseUrl = getTalkybotBaseUrl();
    if (!baseUrl) {
      ConsoleLogger.error("TalkybotClient: VITE_PUBLIC_TALKYBOT_URL is not set");
      return;
    }

    // setTimeout(0) for the same StrictMode mount→unmount→remount reason as SocketClient.
    const timerId = setTimeout(() => {
      if (!socket.current) {
        socket.current = io(baseUrl, {
          transports: ["websocket"],
          path: "/api/v1/socketio",
          withCredentials: true,
        });
      }

      socket.current.on("audioFile", (payload: TbAudioFileNative) => {
        const currentSource = sourceRef.current;
        const currentDate = dateRef.current;
        if (!currentSource || !currentDate) return;

        const converted = toTbAudioFileConverted(payload);

        // Only keep files that route to the source the comm pane is showing...
        if (filterAudioFilesForSource([converted], currentSource).length === 0) return;
        // ...and that fall on the date currently being viewed.
        const fileDate = new Date(converted.startTime).toISOString().split("T")[0];
        if (fileDate !== currentDate) return;

        dispatch(upsertTalkybotAudioFile(converted));
      });
    }, 0);

    return () => {
      clearTimeout(timerId);
      if (socket.current) {
        socket.current.removeAllListeners();
        socket.current.disconnect();
        socket.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: socket persists across source/date changes; the handler reads current values via refs
  }, []);

  // Load the transcript + legacy overrides whenever the source or viewed date changes.
  useEffect(() => {
    // clockDate is non-null (usePlayheadDate fallback) — see note above.
    const date = clockDate.split("T")[0];
    dateRef.current = date;

    if (!source || !isDataTypeValidForSource(source, "talkybot")) {
      dispatch(clearTalkybotAudioFiles());
      return;
    }

    let cancelled = false;
    const baseUrl = getTalkybotBaseUrl();

    const load = async () => {
      dispatch(clearTalkybotAudioFiles());

      // Talkybot's transcript endpoint filters by a single `sim` value (default false),
      // so fetch both to cover ISS (sim=false) and the non-ISS bucket (sim true/false);
      // routing to the current CODA source is decided client-side by (group, sim).
      const fetchTranscript = async (sim: boolean): Promise<TbAudioFileNative[]> => {
        const url = `${baseUrl}/api/v1/transcript/${date}?sim=${sim}`;
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) {
          ConsoleLogger.warn(
            `TalkybotClient: transcript fetch (sim=${sim}) returned ${res.status}`
          );
          return [];
        }
        const body = (await res.json()) as TalkybotTranscriptResponse;
        return body.audioFiles ?? [];
      };

      try {
        const [nonSim, sim] = await Promise.all([fetchTranscript(false), fetchTranscript(true)]);
        if (cancelled) return;

        const converted = [...nonSim, ...sim].map(toTbAudioFileConverted);
        const audioFiles = filterAudioFilesForSource(converted, source);

        dispatch(
          setTalkybotAudioFiles({
            data: audioFiles,
            fetchMetadata: { success: true, timestamp: new Date().toISOString() },
          })
        );
      } catch (e) {
        if (cancelled) return;
        ConsoleLogger.warn("TalkybotClient: transcript load error:", e);
        dispatch(
          setTalkybotAudioFiles({
            data: [],
            fetchMetadata: { success: true, timestamp: new Date().toISOString() },
          })
        );
      }

      // Merge CODA's legacy comm overrides (JETT5/MS1/MS2, etc.) on top of live data.
      try {
        const res = await fetch(
          `/api/v1/external/comm-overrides?source=${encodeURIComponent(source)}&date=${encodeURIComponent(date)}`
        );
        if (res.ok) {
          const overrideResponse = (await res.json()) as FetchResponse<TbAudioFileConverted[]>;
          if (!cancelled && Array.isArray(overrideResponse.data)) {
            for (const file of overrideResponse.data) {
              dispatch(upsertTalkybotAudioFile(file));
            }
          }
        }
      } catch (e) {
        ConsoleLogger.warn("TalkybotClient: comm-overrides fetch error:", e);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [source, clockDate, dispatch]);

  return <></>;
};

export default TalkybotClient;
