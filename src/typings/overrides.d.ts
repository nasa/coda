type MediaOverride = {
  id?: number;
  date: string;
  source: Source;
  type: MediaMedium;
  url: string;
};

type MediaOverrideList = Omit<MediaOverride, "mediaOverride">;
