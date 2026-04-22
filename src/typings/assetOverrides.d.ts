type AssetOverrideMediaType = "photo-time" | "video-channel";

type AssetOverride = {
  id: number;
  mediaType: AssetOverrideMediaType;
  source: Source;
  startDate: string;
  endDate: string;
  overrideJson: Record<string, string | number>;
  notes?: string;
};

type AssetOverrideUpsertRequest = {
  id?: number;
  mediaType: AssetOverrideMediaType;
  source: Source;
  startDate: string;
  endDate: string;
  overrideJson: Record<string, string | number>;
  notes?: string;
};

type AssetOverrideListItem = {
  id: number;
  mediaType: AssetOverrideMediaType;
  source: Source;
  startDate: string;
  endDate: string;
  notes?: string;
  entryCount: number;
};
