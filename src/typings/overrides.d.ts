type MediaOverrideMatchMode = "exact" | "daily";

type MediaOverride = {
  id?: number;
  /** Exact date, or inclusive start date when matchMode is daily */
  date: string;
  source: Source;
  type: MediaMedium;
  /** Defaults to exact for records created before pattern overrides were introduced */
  matchMode: MediaOverrideMatchMode;
  /** Daily overrides contain one {date} token, resolved as yyyy-mm-dd */
  url: string;
  /** If set, only users whose AUID is in the linked AccessGrant.auids may receive this override */
  accessGrantId?: number | null;
};

type MediaOverrideList = MediaOverride;
