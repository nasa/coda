type MediaOverride = {
  id?: number;
  date: string;
  source: Source;
  type: MediaMedium;
  url: string;
  /** If set, only users whose AUID is in the linked AccessGrant.auids may receive this override */
  accessGrantId?: number | null;
};

type MediaOverrideList = Omit<MediaOverride, "mediaOverride">;
