import { getORM } from "server/express/global";
import { MediaOverride_db } from "server/database/models/mediaOverride.model";

const DATE_TOKEN = "{date}";
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export type MediaOverrideVisibility = "all" | "public" | "restricted";

export const isCanonicalDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const validateMediaOverrideUrl = (
  rawUrl: unknown,
  matchMode: MediaOverrideMatchMode
): string | null => {
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    return "url is required";
  }

  const url = rawUrl.trim();
  const dateTokenCount = url.split(DATE_TOKEN).length - 1;
  if (matchMode === "daily" && dateTokenCount !== 1) {
    return "Daily URL templates must contain exactly one {date} token";
  }
  if (matchMode === "exact" && dateTokenCount !== 0) {
    return "Exact-date URLs cannot contain a {date} token";
  }
  if (/\{[^}]*\}/.test(url.replace(DATE_TOKEN, ""))) {
    return "URL contains an unsupported template token";
  }

  try {
    const parsed = new URL(url.replace(DATE_TOKEN, "2000-01-01"));
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "url must use http or https";
    }
    if (parsed.username || parsed.password) {
      return "url cannot contain embedded credentials";
    }
  } catch {
    return "url must be a valid absolute URL";
  }

  return null;
};

/**
 * Selects the winning override tier for a requested day and resolves URL templates.
 * Exact overrides win. Otherwise the newest daily start date wins. Daily overrides
 * never apply before their inclusive start date.
 */
export const resolveApplicableMediaOverrides = (
  candidates: readonly MediaOverride[],
  requestedDate: string
): MediaOverride[] => {
  const exact = candidates.filter(
    (record) => record.matchMode === "exact" && record.date === requestedDate
  );
  const selected =
    exact.length > 0
      ? exact
      : (() => {
          const daily = candidates.filter(
            (record) => record.matchMode === "daily" && record.date <= requestedDate
          );
          const latestStartDate = daily.reduce(
            (latest, record) => (record.date > latest ? record.date : latest),
            ""
          );
          return daily.filter((record) => record.date === latestStartDate);
        })();

  return selected
    .map((record) => ({
      ...record,
      url:
        record.matchMode === "daily" ? record.url.replace(DATE_TOKEN, requestedDate) : record.url,
    }))
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
};

export async function getApplicableMediaOverrides({
  source,
  type,
  requestedDate,
  visibility,
}: {
  source: Source;
  type: MediaMedium;
  requestedDate: string;
  visibility: MediaOverrideVisibility;
}): Promise<MediaOverride[]> {
  if (!isCanonicalDate(requestedDate)) return [];

  const accessGrantFilter =
    visibility === "public"
      ? { accessGrantId: null }
      : visibility === "restricted"
        ? { accessGrantId: { $ne: null } }
        : {};
  const em = getORM().em.fork();
  const candidates = await em.find(
    MediaOverride_db,
    {
      source,
      type,
      date: { $lte: requestedDate },
      ...accessGrantFilter,
    },
    { orderBy: { date: "DESC", id: "ASC" } }
  );

  return resolveApplicableMediaOverrides(candidates, requestedDate);
}
