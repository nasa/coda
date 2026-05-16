import pcdAudioData from "server/processing/artemis2/pcd_audio/pcd-audio.json";
import { FunctionComponent, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { deepEqual, refEqual, useAppSelector } from "utils/useAppSelector";
import { usePlayheadDate } from "store/hooks";
import { useAppDispatch } from "utils/useAppDispatch";
import { setPaneStateDataValue } from "store/framework";
import { appSecondsFromDateString } from "utils/formatting";
import ClockInterval from "components/framework/ClockInterval";
import { HelpButton } from "components/interface/pane-help-control-button";
import HelpOverlay from "components/interface/pane-help-overlay";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVolumeHigh, faVolumeXmark } from "@fortawesome/free-solid-svg-icons";
import { setAppSeconds } from "store/clock";
import styles from "./pcd-audio.module.css";

// Canonical channel order for display
const ALL_DEVICES = ["PLT", "MS2", "PCD3", "FD04"] as const;

const DEVICE_COLORS: Record<string, string> = {
  PLT: "#e8a020",
  MS2: "#4a9edd",
  PCD3: "#a855f7",
  FD04: "#22c55e",
};

function fmtDur(seconds: number): string {
  const s = Math.floor(Math.abs(seconds));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ss = s % 60;
  if (h > 0) return `${h}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

// ─── Controls bar ────────────────────────────────────────────────────────────

export const PcdAudioControls: FunctionComponent<PaneComponentProps> = ({ paneInstanceId }) => {
  const dispatch = useAppDispatch();
  const paneStateData = useAppSelector(
    (state) => state.framework.paneInstances[paneInstanceId].paneStateData as PcdAudioPaneStateData,
    deepEqual
  );
  const date = useAppSelector((state) => state.clock.date, refEqual);
  const dateStr = date?.split("T")[0];

  // Only show device buttons for channels that have recordings on this date
  const availableDevices = useMemo(() => {
    if (!dateStr) return [] as string[];
    const seen = new Set<string>();
    for (const r of pcdAudioData.recordings) {
      if (r.startTime.startsWith(dateStr)) {
        seen.add(r.device ?? "FD04");
      }
    }
    return ALL_DEVICES.filter((d) => seen.has(d));
  }, [dateStr]);

  const toggleDevice = useCallback(
    (device: string) => {
      const current = paneStateData.unmutedChannels;
      const next = current.includes(device)
        ? current.filter((d) => d !== device)
        : [...current, device];
      dispatch(
        setPaneStateDataValue({
          paneInstanceId,
          paneStateProperty: "unmutedChannels",
          paneStateValue: next,
        })
      );
    },
    [dispatch, paneInstanceId, paneStateData.unmutedChannels]
  );

  return (
    <div className={styles.controls}>
      <div className={styles.controlsLeft}>
        {availableDevices.map((device) => {
          const isUnmuted = paneStateData.unmutedChannels.includes(device);
          return (
            <button
              key={device}
              className={`${styles.deviceButton} ${isUnmuted ? styles.deviceButtonActive : ""}`}
              style={
                isUnmuted
                  ? { borderColor: DEVICE_COLORS[device], color: DEVICE_COLORS[device] }
                  : undefined
              }
              onClick={() => toggleDevice(device)}
              title={`${isUnmuted ? "Mute" : "Unmute"} ${device}`}
            >
              <FontAwesomeIcon icon={isUnmuted ? faVolumeHigh : faVolumeXmark} />
              <span className={styles.deviceButtonLabel}>{device}</span>
            </button>
          );
        })}
      </div>
      <div className={styles.rightButtons}>
        <div className={styles.verticalCenter}>
          <HelpButton
            clickHandler={() =>
              dispatch(
                setPaneStateDataValue({
                  paneInstanceId,
                  paneStateProperty: "showHelp",
                  paneStateValue: !paneStateData.showHelp,
                })
              )
            }
            selected={paneStateData.showHelp}
          />
        </div>
      </div>
    </div>
  );
};

// ─── Pane content ────────────────────────────────────────────────────────────

const PcdAudioPane: FunctionComponent<PaneComponentProps> = ({ paneInstanceId }) => {
  const dispatch = useAppDispatch();
  const [appSeconds, setLocalAppSeconds] = useState(0);
  const playheadDate = usePlayheadDate();

  const isRunning = useAppSelector((state) => state.clock.isRunning, refEqual);
  const appSecondsAtStartStop = useAppSelector(
    (state) => state.clock.appSecondsAtStartStop,
    refEqual
  );
  const startStopTimestamp = useAppSelector((state) => state.clock.startStopTimestamp, refEqual);

  const paneStateData = useAppSelector(
    (state) => state.framework.paneInstances[paneInstanceId].paneStateData as PcdAudioPaneStateData,
    deepEqual
  );
  const { unmutedChannels, showHelp } = paneStateData;

  const dateStr = playheadDate.split("T")[0];
  const dayStartMs = useMemo(() => new Date(`${dateStr}T00:00:00Z`).getTime(), [dateStr]);
  const currentUtcMs = dayStartMs + appSeconds * 1000;

  const todayRecordings = useMemo(
    () => pcdAudioData.recordings.filter((r) => r.startTime.startsWith(dateStr)),
    [dateStr]
  );

  // Enrich recordings with display-time status (updates every 100ms via ClockInterval)
  const enriched = useMemo(
    () =>
      todayRecordings.map((r) => {
        const startMs = new Date(r.startTime).getTime();
        const endMs = startMs + r.durationSeconds * 1000;
        const isActive = currentUtcMs >= startMs && currentUtcMs < endMs;
        const isPast = currentUtcMs >= endMs;
        const elapsedSeconds = isActive ? (currentUtcMs - startMs) / 1000 : 0;
        const secondsUntil = !isActive && !isPast ? (startMs - currentUtcMs) / 1000 : 0;
        const deviceKey = r.device ?? "FD04";
        return { ...r, startMs, endMs, isActive, isPast, elapsedSeconds, secondsUntil, deviceKey };
      }),
    [todayRecordings, currentUtcMs]
  );

  // ── Audio management ─────────────────────────────────────────────────────
  // Runs only when clock state or unmuted channels change (not on every 100ms display tick).
  // A 1-second interval while running handles recordings that start/end mid-run.

  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    const manageAudio = () => {
      const elapsed = startStopTimestamp
        ? Math.max(0, (Date.now() - Date.parse(startStopTimestamp)) / 1000)
        : 0;
      const currentSeconds = isRunning ? appSecondsAtStartStop + elapsed : appSecondsAtStartStop;
      const nowMs = dayStartMs + currentSeconds * 1000;

      for (const r of pcdAudioData.recordings) {
        if (!r.startTime.startsWith(dateStr)) continue;
        const startMs = new Date(r.startTime).getTime();
        const endMs = startMs + r.durationSeconds * 1000;
        const isActive = nowMs >= startMs && nowMs < endMs;
        const deviceKey = r.device ?? "FD04";
        const isUnmuted = unmutedChannels.includes(deviceKey);

        if (isActive && isUnmuted && isRunning) {
          let audio = audioRefs.current.get(r.nasa_id);
          if (!audio) {
            audio = new Audio(r.audioUrl);
            audioRefs.current.set(r.nasa_id, audio);
          }
          const targetOffset = (nowMs - startMs) / 1000;
          if (audio.paused) {
            audio.currentTime = targetOffset;
            audio.play().catch(() => {});
          } else if (Math.abs(audio.currentTime - targetOffset) > 2) {
            // Clock was scrubbed while running — re-seek
            audio.currentTime = targetOffset;
          }
        } else {
          const audio = audioRefs.current.get(r.nasa_id);
          if (audio && !audio.paused) {
            audio.pause();
          }
        }
      }
    };

    manageAudio();

    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (isRunning) {
      intervalId = setInterval(manageAudio, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isRunning, appSecondsAtStartStop, startStopTimestamp, unmutedChannels, dateStr, dayStartMs]);

  // Cleanup audio elements on unmount
  useEffect(() => {
    const refs = audioRefs.current;
    return () => {
      for (const audio of refs.values()) {
        audio.pause();
        audio.src = "";
      }
      refs.clear();
    };
  }, []);

  // ── Auto-scroll to first active recording ────────────────────────────────
  const listRef = useRef<HTMLDivElement>(null);
  const firstActiveId = enriched.find((r) => r.isActive)?.nasa_id;
  const prevFirstActiveIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (firstActiveId && firstActiveId !== prevFirstActiveIdRef.current) {
      prevFirstActiveIdRef.current = firstActiveId;
      const el = listRef.current?.querySelector<HTMLElement>(`[data-nasa-id="${firstActiveId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [firstActiveId]);

  return (
    <div className={styles.main}>
      <ClockInterval setAppSeconds={setLocalAppSeconds} />

      {todayRecordings.length === 0 ? (
        <div className={styles.empty}>No recordings for this date</div>
      ) : (
        <div className={styles.list} ref={listRef}>
          {enriched.map((r) => (
            <div
              key={r.nasa_id}
              data-nasa-id={r.nasa_id}
              className={[
                styles.row,
                r.isActive ? styles.activeRow : "",
                r.isPast && !r.isActive ? styles.pastRow : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => dispatch(setAppSeconds(appSecondsFromDateString(r.startTime)))}
              title={`Jump to ${r.startTime.slice(11, 19)} UTC`}
            >
              <div
                className={styles.deviceBadge}
                style={{ background: DEVICE_COLORS[r.deviceKey] }}
              >
                {r.deviceKey}
              </div>
              <div className={styles.startTime}>{r.startTime.slice(11, 19)}</div>
              <div className={styles.totalDuration}>{fmtDur(r.durationSeconds)}</div>
              <div className={styles.statusCol}>
                {r.isActive ? (
                  <span className={styles.progressText}>
                    {fmtDur(r.elapsedSeconds)} / {fmtDur(r.durationSeconds)}
                  </span>
                ) : r.isPast ? (
                  <span className={styles.pastLabel}>past</span>
                ) : (
                  <span className={styles.upcomingLabel}>in {fmtDur(r.secondsUntil)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <HelpOverlay
        isModalOpen={showHelp}
        closeHandler={() =>
          dispatch(
            setPaneStateDataValue({
              paneInstanceId,
              paneStateProperty: "showHelp",
              paneStateValue: false,
            })
          )
        }
      >
        <div>
          <p>
            Lists PCD audio recordings for Artemis II (April 5–6, 2026). Each row shows the device
            channel, UTC start time, and total duration. Highlighted rows are currently active based
            on the playhead time.
          </p>
          <p>
            Click any row to jump the playhead to that recording's start time. Use the channel
            buttons in the header to unmute individual device channels — audio plays in sync with
            the clock when running.
          </p>
        </div>
      </HelpOverlay>
    </div>
  );
};

export default PcdAudioPane;
