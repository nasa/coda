import { refEqual, useAppSelector } from "utils/useAppSelector";

/**
 * Hook to get the playhead date, guaranteed non-null.
 * Returns the current playhead date or today's date as fallback.
 */
export const usePlayheadDate = (): string => {
  const playheadDate = useAppSelector((state) => state.clock.date, refEqual);
  return playheadDate ?? new Date().toISOString().split("T")[0] + "T00:00:00.000Z";
};
