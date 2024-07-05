type MediaOverride = {
  id: number;
  date: string;
  source: "ARTEMIS" | "ISS" | "NBL" | "TEST_EVENTS";
  type: "video" | "photo" | "transcript" | "audio";
  url: string;
};

type MediaOverride_db_type = MediaOverride;

type MediaOverrideList = Omit<MediaOverride, "mediaOverride">;
