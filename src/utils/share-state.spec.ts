import { validateShareLinkDateTime } from "./share-state";

describe("validateShareLinkDateTime", () => {
  beforeEach(() => {
    // Mock current time to 2024-03-15 14:30:45 UTC for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-15T14:30:45Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("date validation", () => {
    it("should preserve valid past dates", () => {
      const result = validateShareLinkDateTime("2024-03-10", null);
      expect(result.validatedDate).toBe("2024-03-10");
      expect(result.isToday).toBe(false);
    });

    it("should change future dates to today", () => {
      const result = validateShareLinkDateTime("2024-03-20", null);
      expect(result.validatedDate).toBe("2024-03-15");
      expect(result.isToday).toBe(true);
    });

    it("should recognize today's date", () => {
      const result = validateShareLinkDateTime("2024-03-15", null);
      expect(result.validatedDate).toBe("2024-03-15");
      expect(result.isToday).toBe(true);
    });

    it("should handle null date input", () => {
      const result = validateShareLinkDateTime(null, null);
      expect(result.validatedDate).toBe("2024-03-15"); // Now defaults to today
      expect(result.isToday).toBe(true);
    });
  });

  describe("time validation on today's date", () => {
    it("should preserve past times when date is today", () => {
      const result = validateShareLinkDateTime("2024-03-15", "10:00:00");
      expect(result.validatedGmt).toBe("10:00:00");
    });

    it("should change future times to current time when date is today", () => {
      const result = validateShareLinkDateTime("2024-03-15", "18:45:30");
      expect(result.validatedGmt).toBe("14:30:45");
    });

    it("should handle URL-encoded colons in time", () => {
      const result = validateShareLinkDateTime("2024-03-15", "10%3A00%3A00");
      expect(result.validatedGmt).toBe("10%3A00%3A00");
    });

    it("should handle URL-encoded colons for future times", () => {
      const result = validateShareLinkDateTime("2024-03-15", "18%3A45%3A30");
      expect(result.validatedGmt).toBe("14:30:45");
    });

    it("should preserve current exact time", () => {
      const result = validateShareLinkDateTime("2024-03-15", "14:30:45");
      expect(result.validatedGmt).toBe("14:30:45");
    });

    it("should handle null time input when date is today", () => {
      const result = validateShareLinkDateTime("2024-03-15", null);
      expect(result.validatedGmt).toBe(null);
    });
  });

  describe("time validation on non-today dates", () => {
    it("should not validate time when date is in the past", () => {
      const result = validateShareLinkDateTime("2024-03-10", "23:59:59");
      expect(result.validatedGmt).toBe("23:59:59");
      expect(result.isToday).toBe(false);
    });

    it("should not validate time when future date is corrected to today", () => {
      const result = validateShareLinkDateTime("2024-03-20", "23:59:59");
      // Date gets corrected to today, but time validation happens after with isToday check
      expect(result.validatedGmt).toBe("14:30:45");
      expect(result.isToday).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle both null date and null time", () => {
      const result = validateShareLinkDateTime(null, null);
      expect(result.validatedDate).toBe("2024-03-15"); // Now defaults to today
      expect(result.validatedGmt).toBe(null);
      expect(result.isToday).toBe(true);
    });

    it("should handle malformed time format", () => {
      const result = validateShareLinkDateTime("2024-03-15", "25:99:99");
      expect(result.validatedGmt).toBe("25:99:99");
    });

    it("should handle single-digit hours in valid time", () => {
      const result = validateShareLinkDateTime("2024-03-15", "9:30:00");
      expect(result.validatedGmt).toBe("9:30:00");
    });

    it("should handle midnight time", () => {
      const result = validateShareLinkDateTime("2024-03-15", "00:00:00");
      expect(result.validatedGmt).toBe("00:00:00");
    });

    it("should handle end of day time on past date", () => {
      const result = validateShareLinkDateTime("2024-03-10", "23:59:59");
      expect(result.validatedGmt).toBe("23:59:59");
      expect(result.isToday).toBe(false);
    });
  });
});
