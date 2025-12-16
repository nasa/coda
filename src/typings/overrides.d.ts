type MediaOverride = {
  id?: number;
  date: string;
  source: Source;
  type: MediaMedium;
  url: string;
};

type MediaOverride_db_type = MediaOverride;

type MediaOverrideList = Omit<MediaOverride, "mediaOverride">;
