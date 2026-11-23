import { FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare, faList, faRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import ClockInterval from "components/framework/ClockInterval";
import { deepEqual, useAppSelector } from "utils/useAppSelector";
import { useAppDispatch } from "utils/useAppDispatch";
import { usePlayheadDate } from "store/hooks";
import { setPaneStateDataValue } from "store/framework";
import { getSequenceStartMilliseconds } from "store/sequences";
import { thunkChangeViewingDate } from "store/thunk/clockThunk";
import { dateFromAppSeconds, hhmmssFromDateString } from "utils/formatting";
import { isSameDate, midnightZulu } from "utils/date";
import styles from "./maestro-procedure.module.css";

const MAESTRO_URL: string = (import.meta.env.VITE_PUBLIC_MAESTRO_URL ?? "").replace(/\/+$/, "");
const SIGN_IN_HINT_DELAY_MILLISECONDS = 15000;

type MaestroExecutionState = "not-started" | "executing" | "complete";

type MaestroStatusMessage = {
  type: "coda-maestro/status";
  eventId: string;
  procedureName: string;
  historyIndex: number;
  actionCount: number;
  actionUnixMs: number | null;
  executionState: MaestroExecutionState;
};

type MaestroToCodaMessage =
  | { type: "coda-maestro/ready"; eventId: string }
  | MaestroStatusMessage
  | { type: "coda-maestro/seek"; unixMs: number }
  | { type: "coda-maestro/event-selected"; eventId: string; procedureName: string };

const maestroExecutionStateLabels: Record<MaestroExecutionState, string> = {
  "not-started": "Not started",
  executing: "Executing",
  complete: "Complete",
};

export function getMaestroOrigin(maestroUrl: string): string | null {
  try {
    return new URL(maestroUrl).origin;
  } catch {
    return null;
  }
}

const maestroOrigin = getMaestroOrigin(MAESTRO_URL);

export function buildMaestroEventReplayUrl(
  maestroUrl: string,
  eventId: string,
  unixMs: number,
  isEmbedded: boolean
): string {
  const embedParameter = isEmbedded ? "embed=coda&" : "";
  return `${maestroUrl}/event/${encodeURIComponent(eventId)}?${embedParameter}atTime=${Math.round(unixMs)}`;
}

export function buildMaestroEventPickerUrl(maestroUrl: string, unixMs: number): string {
  return `${maestroUrl}/embed/events?atTime=${Math.round(unixMs)}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isMaestroToCodaMessage(data: unknown): data is MaestroToCodaMessage {
  if (typeof data !== "object" || data === null) return false;
  const message = data as Record<string, unknown>;
  switch (message.type) {
    case "coda-maestro/ready":
      return typeof message.eventId === "string";
    case "coda-maestro/status":
      return (
        typeof message.eventId === "string" &&
        typeof message.procedureName === "string" &&
        isFiniteNumber(message.historyIndex) &&
        isFiniteNumber(message.actionCount) &&
        (message.actionUnixMs === null || isFiniteNumber(message.actionUnixMs)) &&
        Object.keys(maestroExecutionStateLabels).includes(message.executionState as string)
      );
    case "coda-maestro/seek":
      return isFiniteNumber(message.unixMs);
    case "coda-maestro/event-selected":
      return (
        typeof message.eventId === "string" &&
        message.eventId !== "" &&
        typeof message.procedureName === "string"
      );
    default:
      return false;
  }
}

/** Returns the message only when it comes from the embedded Maestro window and has a known shape */
export function parseTrustedMaestroMessage(
  event: Pick<MessageEvent, "origin" | "source" | "data">,
  expectedOrigin: string,
  expectedSource: MessageEventSource | null | undefined
): MaestroToCodaMessage | null {
  if (event.origin !== expectedOrigin || !event.source || event.source !== expectedSource) {
    return null;
  }
  return isMaestroToCodaMessage(event.data) ? event.data : null;
}

/** Maestro event of the sequence active at the playhead, else of a sequence starting on the playhead's date */
export function findSequenceMaestroEventId(
  sequences: Sequence[],
  playheadUnixMs: number
): string | null {
  const sequencesWithMaestroEvent = sequences.filter(
    (sequence) => typeof sequence.maestroEventUuid === "string" && sequence.maestroEventUuid !== ""
  );
  const activeSequence = sequencesWithMaestroEvent.find((sequence) => {
    const sequenceStartMilliseconds = getSequenceStartMilliseconds(sequence);
    return (
      playheadUnixMs >= sequenceStartMilliseconds &&
      playheadUnixMs <= sequenceStartMilliseconds + sequence.duration * 1000
    );
  });
  const sameDateSequence = sequencesWithMaestroEvent.find((sequence) =>
    isSameDate(new Date(sequence.startDate), new Date(playheadUnixMs))
  );
  return ((activeSequence ?? sameDateSequence)?.maestroEventUuid as string | undefined) ?? null;
}

export function resolveMaestroEvent(
  paneStateData: Pick<MaestroProcedurePaneStateData, "maestroEventId" | "showEventPicker">,
  sequenceEventId: string | null
): { eventId: string | null; resolvedFrom: "manual" | "sequence" | "picker" } {
  if (paneStateData.showEventPicker) return { eventId: null, resolvedFrom: "picker" };
  if (paneStateData.maestroEventId) {
    return { eventId: paneStateData.maestroEventId, resolvedFrom: "manual" };
  }
  if (sequenceEventId) return { eventId: sequenceEventId, resolvedFrom: "sequence" };
  return { eventId: null, resolvedFrom: "picker" };
}

export function unixMsFromClock(playheadDate: string, appSeconds: number): number {
  return dateFromAppSeconds(appSeconds, playheadDate).getTime();
}

type PlayheadClockReading = { date: string; appSeconds: number };

/** Keeps the previous reading when unchanged so ClockInterval's 100ms ticks don't re-render */
export function nextPlayheadClockReading(
  previousReading: PlayheadClockReading | null,
  date: string,
  appSeconds: number
): PlayheadClockReading {
  if (previousReading?.date === date && previousReading.appSeconds === appSeconds) {
    return previousReading;
  }
  return { date, appSeconds };
}

/** Pairs the playhead date with the seconds ClockInterval computed for that same date */
function usePlayheadUnixMs() {
  const playheadDate = usePlayheadDate();
  const [playheadClockReading, setPlayheadClockReading] = useState<PlayheadClockReading | null>(
    null
  );
  const handleClockTick = useCallback(
    (appSeconds: number) =>
      setPlayheadClockReading((previousReading) =>
        nextPlayheadClockReading(previousReading, playheadDate, appSeconds)
      ),
    [playheadDate]
  );
  const playheadUnixMs = playheadClockReading
    ? unixMsFromClock(playheadClockReading.date, playheadClockReading.appSeconds)
    : null;
  return { playheadUnixMs, handleClockTick };
}

export function clockPositionFromUnixMs(unixMs: number): { dateIso: string; appSeconds: number } {
  const dayStart = midnightZulu(new Date(unixMs));
  return {
    dateIso: dayStart.toISOString(),
    // Rounded up so the clock lands on or after the Maestro action it was sought to
    appSeconds: Math.ceil((unixMs - dayStart.getTime()) / 1000),
  };
}

export function formatMaestroStatus(status: MaestroStatusMessage): string {
  const statusParts = [
    maestroExecutionStateLabels[status.executionState],
    `action ${status.historyIndex + 1}/${status.actionCount}`,
  ];
  if (status.actionUnixMs !== null) {
    statusParts.push(
      `as of ${hhmmssFromDateString(new Date(status.actionUnixMs).toISOString())} GMT`
    );
  }
  return statusParts.join(" · ");
}

function useMaestroEventResolution(paneInstanceId: number, playheadUnixMs: number | null) {
  const paneStateData = useAppSelector(
    (state) =>
      state.framework.paneInstances[paneInstanceId].paneStateData as MaestroProcedurePaneStateData,
    deepEqual
  );
  const allSequences = useAppSelector((state) => state.sequences.allSequences, deepEqual);
  const sequenceEventId = useMemo(
    () =>
      playheadUnixMs === null ? null : findSequenceMaestroEventId(allSequences, playheadUnixMs),
    [allSequences, playheadUnixMs]
  );
  return { paneStateData, sequenceEventId, ...resolveMaestroEvent(paneStateData, sequenceEventId) };
}

export const MaestroProcedureControls: FunctionComponent<PaneComponentProps> = ({
  paneInstanceId,
}) => {
  const dispatch = useAppDispatch();
  const { playheadUnixMs, handleClockTick } = usePlayheadUnixMs();
  const { paneStateData, sequenceEventId, eventId, resolvedFrom } = useMaestroEventResolution(
    paneInstanceId,
    playheadUnixMs
  );

  const setPaneValue = (
    paneStateProperty: keyof MaestroProcedurePaneStateData,
    paneStateValue: unknown
  ) => {
    dispatch(setPaneStateDataValue({ paneInstanceId, paneStateProperty, paneStateValue }));
  };

  const openInMaestroUrl =
    eventId && playheadUnixMs !== null
      ? buildMaestroEventReplayUrl(MAESTRO_URL, eventId, playheadUnixMs, false)
      : MAESTRO_URL;

  return (
    <div className={styles.controls}>
      <ClockInterval setAppSeconds={handleClockTick} />
      <div className={styles.controlsLeft}>
        {resolvedFrom !== "picker" && (
          <button
            className={styles.controlButton}
            title="Choose a different Maestro event"
            onClick={() => {
              setPaneValue("maestroEventId", "");
              setPaneValue("maestroEventName", "");
              setPaneValue("showEventPicker", true);
            }}
          >
            <FontAwesomeIcon icon={faList} />
            <span>Choose event</span>
          </button>
        )}
        {sequenceEventId && eventId !== sequenceEventId && (
          <button
            className={styles.controlButton}
            title="Show the Maestro event recorded for this EVA"
            onClick={() => {
              setPaneValue("maestroEventId", "");
              setPaneValue("maestroEventName", "");
              setPaneValue("showEventPicker", false);
            }}
          >
            <FontAwesomeIcon icon={faRotateLeft} />
            <span>Use EVA&apos;s event</span>
          </button>
        )}
        {maestroOrigin && (
          <a
            className={styles.controlButton}
            href={openInMaestroUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in Maestro in a new tab"
          >
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
            <span>Open in Maestro</span>
          </a>
        )}
      </div>
      <div className={styles.rightButtons}>
        <div className={styles.verticalCenter}>
          <HelpButton
            clickHandler={() => setPaneValue("showHelp", !paneStateData.showHelp)}
            selected={paneStateData.showHelp}
          />
        </div>
      </div>
    </div>
  );
};

const MaestroFrame: FunctionComponent<{
  paneInstanceId: number;
  eventId: string | null;
  eventName: string;
  playheadUnixMs: number;
  expectedOrigin: string;
  onReload: () => void;
}> = ({ paneInstanceId, eventId, eventName, playheadUnixMs, expectedOrigin, onReload }) => {
  const dispatch = useAppDispatch();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeSrc] = useState(() =>
    eventId
      ? buildMaestroEventReplayUrl(MAESTRO_URL, eventId, playheadUnixMs, true)
      : buildMaestroEventPickerUrl(MAESTRO_URL, playheadUnixMs)
  );
  const [readyMessageCount, setReadyMessageCount] = useState(0);
  const [status, setStatus] = useState<MaestroStatusMessage | null>(null);
  const [isSignInHintVisible, setIsSignInHintVisible] = useState(false);

  useEffect(() => {
    const signInHintTimer = setTimeout(
      () => setIsSignInHintVisible(true),
      SIGN_IN_HINT_DELAY_MILLISECONDS
    );
    return () => clearTimeout(signInHintTimer);
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = parseTrustedMaestroMessage(
        event,
        expectedOrigin,
        iframeRef.current?.contentWindow
      );
      if (!message) return;
      switch (message.type) {
        case "coda-maestro/ready":
          setReadyMessageCount((count) => count + 1);
          break;
        case "coda-maestro/status":
          setStatus(message);
          break;
        case "coda-maestro/seek": {
          const { dateIso, appSeconds } = clockPositionFromUnixMs(message.unixMs);
          dispatch(thunkChangeViewingDate({ newDate: dateIso, newAppSeconds: appSeconds }));
          break;
        }
        case "coda-maestro/event-selected":
          dispatch(
            setPaneStateDataValue({
              paneInstanceId,
              paneStateProperty: "maestroEventId",
              paneStateValue: message.eventId,
            })
          );
          dispatch(
            setPaneStateDataValue({
              paneInstanceId,
              paneStateProperty: "maestroEventName",
              paneStateValue: message.procedureName,
            })
          );
          dispatch(
            setPaneStateDataValue({
              paneInstanceId,
              paneStateProperty: "showEventPicker",
              paneStateValue: false,
            })
          );
          break;
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [dispatch, expectedOrigin, paneInstanceId]);

  useEffect(() => {
    if (readyMessageCount === 0) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: "coda-maestro/set-time", unixMs: playheadUnixMs },
      expectedOrigin
    );
  }, [readyMessageCount, playheadUnixMs, expectedOrigin]);

  const signInLink = (
    <a href={MAESTRO_URL} target="_blank" rel="noopener noreferrer">
      sign in to Maestro
    </a>
  );
  const reloadButton = (
    <button className={styles.linkButton} onClick={onReload}>
      reload
    </button>
  );

  let statusContent: React.ReactNode;
  if (status) {
    statusContent = (
      <>
        <span className={styles.procedureName}>{status.procedureName}</span>
        <span className={styles.statusDetail}>{formatMaestroStatus(status)}</span>
      </>
    );
  } else if (!eventId) {
    statusContent = (
      <span>
        Choose a Maestro event below. If the list does not load, {signInLink}, then {reloadButton}.
      </span>
    );
  } else if (readyMessageCount > 0) {
    statusContent = <span>{eventName || "Connected to Maestro"}</span>;
  } else if (isSignInHintVisible) {
    statusContent = (
      <span>
        Maestro has not responded. You may need to {signInLink}, then {reloadButton}.
      </span>
    );
  } else {
    statusContent = <span>Waiting for Maestro…</span>;
  }

  return (
    <>
      <div className={styles.statusBar}>{statusContent}</div>
      <iframe
        ref={iframeRef}
        className={styles.frame}
        title="Maestro procedure"
        src={iframeSrc}
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </>
  );
};

const MaestroProcedurePane: FunctionComponent<PaneComponentProps> = ({ paneInstanceId }) => {
  const dispatch = useAppDispatch();
  const { playheadUnixMs, handleClockTick } = usePlayheadUnixMs();
  const { paneStateData, eventId } = useMaestroEventResolution(paneInstanceId, playheadUnixMs);
  const [reloadCount, setReloadCount] = useState(0);

  const toggleHelp = () => {
    dispatch(
      setPaneStateDataValue({
        paneInstanceId,
        paneStateProperty: "showHelp",
        paneStateValue: !paneStateData.showHelp,
      })
    );
  };

  return (
    <div className={styles.main}>
      <ClockInterval setAppSeconds={handleClockTick} />
      {!maestroOrigin && (
        <div className={styles.message}>The Maestro URL is not configured for this server.</div>
      )}
      {maestroOrigin && playheadUnixMs !== null && (
        <MaestroFrame
          key={`${eventId ?? "picker"}-${reloadCount}`}
          paneInstanceId={paneInstanceId}
          eventId={eventId}
          eventName={paneStateData.maestroEventName}
          playheadUnixMs={playheadUnixMs}
          expectedOrigin={maestroOrigin}
          onReload={() => setReloadCount((count) => count + 1)}
        />
      )}
      <HelpOverlay isModalOpen={paneStateData.showHelp} closeHandler={toggleHelp}>
        <div>
          <p>
            Shows the Maestro procedure as it was being executed at the current playhead time. The
            procedure follows the CODA clock, and clicking an action in Maestro moves the CODA clock
            to the time that action was taken.
          </p>
          <p>
            For ISS EVAs, the Maestro event recorded on the wiki is loaded automatically. For other
            events, or to view a different event, use <b>Choose event</b> and select one from the
            list. <b>Use EVA&apos;s event</b> returns to the event recorded for the EVA.
          </p>
          <p>
            You must be signed in to Maestro for the procedure to load. If the pane stays on
            &quot;Waiting for Maestro&quot;,{" "}
            <a href={MAESTRO_URL} target="_blank" rel="noopener noreferrer">
              open Maestro
            </a>{" "}
            in a new tab to sign in, then reload this pane.
          </p>
        </div>
      </HelpOverlay>
    </div>
  );
};

export default MaestroProcedurePane;
