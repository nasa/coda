type MediaOverride = {
  id: number;
  date: string;
  source: string;
  type: string;
  url: string;
};

type MediaOverride_db_type = MediaOverride;

type MediaOverrideList = Omit<MediaOverride, "mediaOverride">;
