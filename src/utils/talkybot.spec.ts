import { filterAudioFilesForSource, toTbAudioFileConverted } from "./talkybot";

function buildNativeAudioFile(overrides: Partial<TbAudioFileNative> = {}): TbAudioFileNative {
  return {
    uuid: "file-uuid-1",
    version: 1,
    added: "2025-01-15T10:00:00Z",
    updated: "2025-01-15T10:00:00Z",
    startTime: "2025-01-15T10:00:00",
    deleted: false,
    channel: {
      id: 1,
      name: "SG-1",
      slug: "1-sg-1",
      sim: false,
      groups: [{ id: 1, name: "ISS", slug: "iss" }],
    },
    ...overrides,
  };
}

describe("talkybot", () => {
  describe("toTbAudioFileConverted", () => {
    it("should append a Z to a startTime with no timezone so it parses as UTC", () => {
      const converted = toTbAudioFileConverted(buildNativeAudioFile());
      expect(converted.startTime.toISOString()).toBe("2025-01-15T10:00:00.000Z");
    });

    it("should not double-append Z when startTime already ends with Z", () => {
      const converted = toTbAudioFileConverted(
        buildNativeAudioFile({ startTime: "2025-01-15T10:00:00Z" })
      );
      expect(converted.startTime.toISOString()).toBe("2025-01-15T10:00:00.000Z");
    });

    it("should prefer mediaInfo.duration when present", () => {
      const converted = toTbAudioFileConverted(
        buildNativeAudioFile({
          mediaInfo: {
            codec: "aac",
            sampleRate: 44100,
            sampleFormat: "fltp",
            bitRate: 128000,
            channels: 1,
            duration: 12.5,
          },
          transcription: {
            uuid: "t1",
            requested: "2025-01-15T10:00:00Z",
            received: "2025-01-15T10:00:05Z",
            updated: "2025-01-15T10:00:05Z",
            language: "en",
            aligned: true,
            diarized: false,
            translated: false,
            segments: [{ type: "segment", start: 0, end: 99, text: "should not be used" }],
            text: "should not be used",
          },
        })
      );
      expect(converted.duration).toBe(12.5);
    });

    it("should fall back to the last transcription segment's end time when mediaInfo is absent", () => {
      const converted = toTbAudioFileConverted(
        buildNativeAudioFile({
          transcription: {
            uuid: "t1",
            requested: "2025-01-15T10:00:00Z",
            received: "2025-01-15T10:00:05Z",
            updated: "2025-01-15T10:00:05Z",
            language: "en",
            aligned: true,
            diarized: false,
            translated: false,
            segments: [
              { type: "segment", start: 0, end: 3, text: "hello" },
              { type: "segment", start: 3, end: 7.5, text: "world" },
            ],
            text: "hello world",
          },
        })
      );
      expect(converted.duration).toBe(7.5);
    });

    it("should default duration to 0 when there is no mediaInfo or transcription", () => {
      const converted = toTbAudioFileConverted(buildNativeAudioFile());
      expect(converted.duration).toBe(0);
    });

    it("should concatenate only 'segment'-type entries for the transcript text", () => {
      const converted = toTbAudioFileConverted(
        buildNativeAudioFile({
          transcription: {
            uuid: "t1",
            requested: "2025-01-15T10:00:00Z",
            received: "2025-01-15T10:00:05Z",
            updated: "2025-01-15T10:00:05Z",
            language: "en",
            aligned: true,
            diarized: true,
            translated: false,
            segments: [
              { type: "segment", start: 0, end: 3, text: "hello" },
              { type: "diarized", start: 0, end: 3, text: "hello (speaker)", speaker: "A" },
              { type: "segment", start: 3, end: 6, text: "world" },
            ],
            text: "hello world",
          },
        })
      );
      expect(converted.text).toBe("hello world");
    });

    it("should populate textOriginalLanguage from nativeLanguageSegments when translated", () => {
      const converted = toTbAudioFileConverted(
        buildNativeAudioFile({
          transcription: {
            uuid: "t1",
            requested: "2025-01-15T10:00:00Z",
            received: "2025-01-15T10:00:05Z",
            updated: "2025-01-15T10:00:05Z",
            language: "en",
            aligned: true,
            diarized: false,
            translated: true,
            segments: [{ type: "segment", start: 0, end: 3, text: "hello" }],
            nativeLanguageSegments: [{ type: "segment", start: 0, end: 3, text: "привет" }],
            text: "hello",
          },
        })
      );
      expect(converted.text).toBe("hello");
      expect(converted.textOriginalLanguage).toBe("привет");
    });

    it("should carry over channel slug, groups, and sim flag", () => {
      const converted = toTbAudioFileConverted(
        buildNativeAudioFile({
          channel: {
            id: 2,
            name: "Sim SG-1",
            slug: "sim-1-sg-1",
            sim: true,
            groups: [{ id: 2, name: "Sim", slug: "sim" }],
          },
        })
      );
      expect(converted.channel).toBe("sim-1-sg-1");
      expect(converted.groups).toEqual([{ id: 2, name: "Sim", slug: "sim" }]);
      expect(converted.sim).toBe(true);
    });

    it("should default groups to [] and sim to false when the channel omits them", () => {
      const converted = toTbAudioFileConverted(
        buildNativeAudioFile({
          channel: { id: 3, name: "Unknown", slug: "unknown" },
        })
      );
      expect(converted.groups).toEqual([]);
      expect(converted.sim).toBe(false);
    });
  });

  describe("filterAudioFilesForSource", () => {
    function buildConvertedFile(
      overrides: Partial<TbAudioFileConverted> = {}
    ): TbAudioFileConverted {
      return {
        fileUuid: "f1",
        startTime: new Date("2025-01-15T10:00:00Z"),
        duration: 5,
        channel: "1-sg-1",
        text: "hello",
        textOriginalLanguage: "",
        language: "en",
        groups: [{ id: 1, name: "ISS", slug: "iss" }],
        sim: false,
        ...overrides,
      };
    }

    it("should keep a real ISS file when filtering for ISS", () => {
      const file = buildConvertedFile();
      expect(filterAudioFilesForSource([file], "ISS")).toEqual([file]);
    });

    it("should drop a real ISS file when filtering for a non-ISS source", () => {
      const file = buildConvertedFile();
      expect(filterAudioFilesForSource([file], "TEST_EVENTS")).toEqual([]);
    });

    it("should drop simulated ISS files for every source (sim-ISS is never shown in CODA)", () => {
      const file = buildConvertedFile({ sim: true });
      expect(filterAudioFilesForSource([file], "ISS")).toEqual([]);
      expect(filterAudioFilesForSource([file], "TEST_EVENTS")).toEqual([]);
      expect(filterAudioFilesForSource([file], "ARTEMIS")).toEqual([]);
    });

    it("should route a miscellaneous group to both TEST_EVENTS and ARTEMIS", () => {
      const file = buildConvertedFile({ groups: [{ id: 3, name: "Test", slug: "test" }] });
      expect(filterAudioFilesForSource([file], "TEST_EVENTS")).toEqual([file]);
      expect(filterAudioFilesForSource([file], "ARTEMIS")).toEqual([file]);
      expect(filterAudioFilesForSource([file], "ISS")).toEqual([]);
    });

    it("should keep files with no group info for backward compatibility (e.g. legacy overrides)", () => {
      const file = buildConvertedFile({ groups: [], override: true });
      expect(filterAudioFilesForSource([file], "ISS")).toEqual([file]);
      expect(filterAudioFilesForSource([file], "TEST_EVENTS")).toEqual([file]);
      expect(filterAudioFilesForSource([file], "ARTEMIS")).toEqual([file]);
    });

    it("should include a file that matches via any of its multiple groups", () => {
      const file = buildConvertedFile({
        groups: [
          { id: 1, name: "ISS", slug: "iss" },
          { id: 3, name: "Test", slug: "test" },
        ],
      });
      // "iss" alone would not route to TEST_EVENTS, but the "test" group does
      expect(filterAudioFilesForSource([file], "TEST_EVENTS")).toEqual([file]);
      expect(filterAudioFilesForSource([file], "ISS")).toEqual([file]);
    });
  });
});
