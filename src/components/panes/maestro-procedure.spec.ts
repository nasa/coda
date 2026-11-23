import {
  buildMaestroEventPickerUrl,
  buildMaestroEventReplayUrl,
  clockPositionFromUnixMs,
  findSequenceMaestroEventId,
  formatMaestroStatus,
  getMaestroOrigin,
  isMaestroToCodaMessage,
  nextPlayheadClockReading,
  parseTrustedMaestroMessage,
  resolveMaestroEvent,
  unixMsFromClock,
} from "./maestro-procedure";

const maestroUrl = "https://maestro.fit.nasa.gov";
const maestroOrigin = "https://maestro.fit.nasa.gov";

const validStatusMessage = {
  type: "coda-maestro/status",
  eventId: "event-1",
  procedureName: "US EVA 92",
  historyIndex: 42,
  actionCount: 310,
  actionUnixMs: Date.UTC(2025, 4, 1, 14, 3, 22),
  executionState: "executing",
};

function makeSequence(overrides: Partial<Sequence>): Sequence {
  return {
    location: "ISS",
    type: 1,
    name: "US EVA 92",
    displayTitle: "US EVA 92",
    dataURL: "",
    startDate: "2025-05-01",
    startTime: "12:00",
    duration: 6 * 3600,
    asPerformed: {},
    ...overrides,
  } as Sequence;
}

describe("getMaestroOrigin", () => {
  it("returns the origin of a valid URL", () => {
    expect(getMaestroOrigin("https://maestro-beta.fit.nasa.gov/some/path")).toBe(
      "https://maestro-beta.fit.nasa.gov"
    );
  });

  it("returns null for an empty or invalid URL", () => {
    expect(getMaestroOrigin("")).toBeNull();
    expect(getMaestroOrigin("not a url")).toBeNull();
  });
});

describe("Maestro URL builders", () => {
  it("builds the embedded event replay URL", () => {
    expect(buildMaestroEventReplayUrl(maestroUrl, "abc-123", 1714572202000, true)).toBe(
      "https://maestro.fit.nasa.gov/event/abc-123?embed=coda&atTime=1714572202000"
    );
  });

  it("builds the non-embedded event URL for opening in a new tab", () => {
    expect(buildMaestroEventReplayUrl(maestroUrl, "abc-123", 1714572202000, false)).toBe(
      "https://maestro.fit.nasa.gov/event/abc-123?atTime=1714572202000"
    );
  });

  it("encodes the event id and rounds the time", () => {
    expect(buildMaestroEventReplayUrl(maestroUrl, "a/b", 1000.6, true)).toBe(
      "https://maestro.fit.nasa.gov/event/a%2Fb?embed=coda&atTime=1001"
    );
  });

  it("builds the event picker URL", () => {
    expect(buildMaestroEventPickerUrl(maestroUrl, 1714572202000)).toBe(
      "https://maestro.fit.nasa.gov/embed/events?atTime=1714572202000"
    );
  });
});

describe("isMaestroToCodaMessage", () => {
  it("accepts each valid message type", () => {
    expect(isMaestroToCodaMessage({ type: "coda-maestro/ready", eventId: "event-1" })).toBe(true);
    expect(isMaestroToCodaMessage(validStatusMessage)).toBe(true);
    expect(isMaestroToCodaMessage({ ...validStatusMessage, actionUnixMs: null })).toBe(true);
    expect(isMaestroToCodaMessage({ type: "coda-maestro/seek", unixMs: 1714572202000 })).toBe(true);
    expect(
      isMaestroToCodaMessage({
        type: "coda-maestro/event-selected",
        eventId: "event-1",
        procedureName: "US EVA 92",
      })
    ).toBe(true);
  });

  it("rejects non-objects and unknown types", () => {
    expect(isMaestroToCodaMessage(null)).toBe(false);
    expect(isMaestroToCodaMessage("coda-maestro/ready")).toBe(false);
    expect(isMaestroToCodaMessage({ type: "coda-maestro/set-time", unixMs: 1 })).toBe(false);
    expect(isMaestroToCodaMessage({ type: "something-else" })).toBe(false);
  });

  it("rejects malformed ready and seek messages", () => {
    expect(isMaestroToCodaMessage({ type: "coda-maestro/ready" })).toBe(false);
    expect(isMaestroToCodaMessage({ type: "coda-maestro/seek", unixMs: "1714572202000" })).toBe(
      false
    );
    expect(isMaestroToCodaMessage({ type: "coda-maestro/seek", unixMs: NaN })).toBe(false);
  });

  it("rejects malformed status messages", () => {
    expect(isMaestroToCodaMessage({ ...validStatusMessage, executionState: "paused" })).toBe(false);
    expect(isMaestroToCodaMessage({ ...validStatusMessage, executionState: "constructor" })).toBe(
      false
    );
    expect(isMaestroToCodaMessage({ ...validStatusMessage, historyIndex: "42" })).toBe(false);
    expect(isMaestroToCodaMessage({ ...validStatusMessage, actionUnixMs: undefined })).toBe(false);
    expect(isMaestroToCodaMessage({ ...validStatusMessage, procedureName: 5 })).toBe(false);
  });

  it("rejects event-selected without a non-empty event id", () => {
    expect(
      isMaestroToCodaMessage({
        type: "coda-maestro/event-selected",
        eventId: "",
        procedureName: "US EVA 92",
      })
    ).toBe(false);
  });
});

describe("parseTrustedMaestroMessage", () => {
  const maestroWindow = {} as Window;
  const readyMessage = { type: "coda-maestro/ready", eventId: "event-1" };

  it("returns the message when origin, source, and shape match", () => {
    expect(
      parseTrustedMaestroMessage(
        { origin: maestroOrigin, source: maestroWindow, data: readyMessage },
        maestroOrigin,
        maestroWindow
      )
    ).toEqual(readyMessage);
  });

  it("rejects messages from another origin", () => {
    expect(
      parseTrustedMaestroMessage(
        { origin: "https://evil.example.com", source: maestroWindow, data: readyMessage },
        maestroOrigin,
        maestroWindow
      )
    ).toBeNull();
  });

  it("rejects messages from another window", () => {
    expect(
      parseTrustedMaestroMessage(
        { origin: maestroOrigin, source: {} as Window, data: readyMessage },
        maestroOrigin,
        maestroWindow
      )
    ).toBeNull();
  });

  it("rejects messages when the iframe window is unavailable", () => {
    expect(
      parseTrustedMaestroMessage(
        { origin: maestroOrigin, source: null, data: readyMessage },
        maestroOrigin,
        null
      )
    ).toBeNull();
  });

  it("rejects malformed messages from the trusted window", () => {
    expect(
      parseTrustedMaestroMessage(
        { origin: maestroOrigin, source: maestroWindow, data: { type: "coda-maestro/ready" } },
        maestroOrigin,
        maestroWindow
      )
    ).toBeNull();
  });
});

describe("findSequenceMaestroEventId", () => {
  const evaWithEvent = makeSequence({ maestroEventUuid: "eva-event" });

  it("returns the event of the sequence active at the playhead", () => {
    expect(findSequenceMaestroEventId([evaWithEvent], Date.UTC(2025, 4, 1, 13))).toBe("eva-event");
  });

  it("falls back to a sequence on the playhead's date", () => {
    expect(findSequenceMaestroEventId([evaWithEvent], Date.UTC(2025, 4, 1, 8))).toBe("eva-event");
  });

  it("prefers the active sequence over another sequence on the same date", () => {
    const earlierEva = makeSequence({ startTime: "01:00", duration: 3600, maestroEventUuid: "a" });
    const laterEva = makeSequence({ startTime: "12:00", maestroEventUuid: "b" });
    expect(findSequenceMaestroEventId([earlierEva, laterEva], Date.UTC(2025, 4, 1, 13))).toBe("b");
  });

  it("finds a sequence that started the previous day and is still active", () => {
    const overnightEva = makeSequence({
      startDate: "2025-04-30",
      startTime: "22:00",
      maestroEventUuid: "overnight",
    });
    expect(findSequenceMaestroEventId([overnightEva], Date.UTC(2025, 4, 1, 1))).toBe("overnight");
  });

  it("ignores sequences without a Maestro event", () => {
    expect(
      findSequenceMaestroEventId(
        [makeSequence({ maestroEventUuid: false }), makeSequence({})],
        Date.UTC(2025, 4, 1, 13)
      )
    ).toBeNull();
  });

  it("returns null when no sequence is on the playhead's date", () => {
    expect(findSequenceMaestroEventId([evaWithEvent], Date.UTC(2025, 4, 3, 13))).toBeNull();
  });
});

describe("resolveMaestroEvent", () => {
  it("prefers a manually chosen event", () => {
    expect(
      resolveMaestroEvent({ maestroEventId: "manual", showEventPicker: false }, "sequence")
    ).toEqual({ eventId: "manual", resolvedFrom: "manual" });
  });

  it("uses the sequence event when nothing was chosen", () => {
    expect(resolveMaestroEvent({ maestroEventId: "", showEventPicker: false }, "sequence")).toEqual(
      { eventId: "sequence", resolvedFrom: "sequence" }
    );
  });

  it("falls back to the picker when no event is known", () => {
    expect(resolveMaestroEvent({ maestroEventId: "", showEventPicker: false }, null)).toEqual({
      eventId: null,
      resolvedFrom: "picker",
    });
  });

  it("shows the picker when the user asked to choose an event", () => {
    expect(resolveMaestroEvent({ maestroEventId: "", showEventPicker: true }, "sequence")).toEqual({
      eventId: null,
      resolvedFrom: "picker",
    });
  });
});

describe("clock conversion", () => {
  it("converts the playhead date and app seconds to unix milliseconds", () => {
    expect(unixMsFromClock("2025-05-01", 3661)).toBe(Date.UTC(2025, 4, 1, 1, 1, 1));
    expect(unixMsFromClock("2025-05-01T00:00:00.000Z", 3661)).toBe(Date.UTC(2025, 4, 1, 1, 1, 1));
  });

  it("converts unix milliseconds to the UTC day and app seconds", () => {
    expect(clockPositionFromUnixMs(Date.UTC(2025, 4, 1, 14, 3, 22))).toEqual({
      dateIso: "2025-05-01T00:00:00.000Z",
      appSeconds: 14 * 3600 + 3 * 60 + 22,
    });
  });

  it("rounds partial seconds up so the clock lands on or after the action", () => {
    expect(clockPositionFromUnixMs(Date.UTC(2025, 4, 1, 0, 0, 10, 250)).appSeconds).toBe(11);
  });

  it("treats app seconds past midnight as the next day", () => {
    expect(unixMsFromClock("2025-05-01", 86400)).toBe(Date.UTC(2025, 4, 2));
  });

  it("round-trips whole seconds", () => {
    const unixMs = Date.UTC(2025, 4, 1, 23, 59, 59);
    const { dateIso, appSeconds } = clockPositionFromUnixMs(unixMs);
    expect(unixMsFromClock(dateIso, appSeconds)).toBe(unixMs);
  });
});

describe("formatMaestroStatus", () => {
  it("formats execution state, 1-based action progress, and action time", () => {
    expect(
      formatMaestroStatus(validStatusMessage as Parameters<typeof formatMaestroStatus>[0])
    ).toBe("Executing · action 43/310 · as of 14:03:22 GMT");
  });

  it("shows action 0 and omits the action time before the first action", () => {
    expect(
      formatMaestroStatus({
        ...validStatusMessage,
        executionState: "not-started",
        historyIndex: -1,
        actionUnixMs: null,
      } as Parameters<typeof formatMaestroStatus>[0])
    ).toBe("Not started · action 0/310");
  });
});

describe("nextPlayheadClockReading", () => {
  it("keeps the previous reading when date and seconds are unchanged", () => {
    const previousReading = { date: "2025-05-01", appSeconds: 100 };
    expect(nextPlayheadClockReading(previousReading, "2025-05-01", 100)).toBe(previousReading);
  });

  it("pairs the new seconds with the date they were computed for", () => {
    expect(nextPlayheadClockReading(null, "2025-05-01", 100)).toEqual({
      date: "2025-05-01",
      appSeconds: 100,
    });
    expect(
      nextPlayheadClockReading({ date: "2025-05-01", appSeconds: 86400 }, "2025-05-02", 0)
    ).toEqual({ date: "2025-05-02", appSeconds: 0 });
  });
});
