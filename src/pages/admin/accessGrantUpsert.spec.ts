import { parseAuidsInput } from "./accessGrantUpsert";

describe("parseAuidsInput", () => {
  it("returns an empty result for an empty string", () => {
    expect(parseAuidsInput("")).toEqual({ auids: [], error: null });
  });

  it("returns an empty result for a whitespace-only string", () => {
    expect(parseAuidsInput("   \n\t  ")).toEqual({ auids: [], error: null });
  });

  it("parses comma-separated AUIDs and trims whitespace", () => {
    expect(parseAuidsInput("narmstra,\n ealdrin ,  mcollin")).toEqual({
      auids: ["narmstra", "ealdrin", "mcollin"],
      error: null,
    });
  });

  it("does not case-fold input (case-folding is applied server-side)", () => {
    expect(parseAuidsInput("NArmstra")).toEqual({ auids: ["NArmstra"], error: null });
  });

  it.each([
    "narmstra ealdrin",
    "narmstra\nealdrin",
    "narmstra;ealdrin",
    '["narmstra", "ealdrin"]',
    "'narmstra', 'ealdrin'",
    ",narmstra",
    "narmstra,",
    "narmstra, ,ealdrin",
  ])("rejects a malformed comma-delimited list %j", (input) => {
    const { auids, error } = parseAuidsInput(input);
    expect(auids).toEqual([]);
    expect(error).toBe("Enter one unquoted AUID per comma-separated entry.");
  });
});
