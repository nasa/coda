type AccessGrant = {
  id: number;
  name: string;
  auids: string[];
  notes?: string;
};

type AccessGrantUpsertRequest = {
  id?: number;
  name: string;
  auids: string[];
  notes?: string;
};

type AccessGrantListItem = {
  id: number;
  name: string;
  auidCount: number;
  notes?: string;
};

/** Summary of a restricted-override eligibility for a single visitor */
type VisitorRestrictedAccess = {
  overrideId: number;
  overrideType: MediaMedium;
  grantId: number;
  grantName: string;
};
