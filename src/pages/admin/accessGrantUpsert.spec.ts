import { parseAuidsInput } from "./accessGrantUpsert";

describe("parseAuidsInput", () => {
  it("returns an empty result for an empty string", () => {
    expect(parseAuidsInput("")).toEqual({ auids: [], error: null });
  });

  it("returns an empty result for a whitespace-only string", () => {
    expect(parseAuidsInput("   \n\t  ")).toEqual({ auids: [], error: null });
  });

  it("parses comma-separated AUIDs and trims whitespace", () => {
    expect(parseAuidsInput("narmstra, ealdrin ,  mcollin")).toEqual({
      auids: ["narmstra", "ealdrin", "mcollin"],
      error: null,
    });
  });

  it("parses whitespace/newline-separated AUIDs", () => {
    expect(parseAuidsInput("narmstra\nealdrin\tmcollin")).toEqual({
      auids: ["narmstra", "ealdrin", "mcollin"],
      error: null,
    });
  });

  it("parses a JSON array of strings", () => {
    expect(parseAuidsInput('["narmstra", "ealdrin"]')).toEqual({
      auids: ["narmstra", "ealdrin"],
      error: null,
    });
  });

  it("trims and drops empty strings from a JSON array", () => {
    expect(parseAuidsInput('["  narmstra  ", "", "   "]')).toEqual({
      auids: ["narmstra"],
      error: null,
    });
  });

  it("does not case-fold input (case-folding is applied server-side)", () => {
    expect(parseAuidsInput("NArmstra")).toEqual({ auids: ["NArmstra"], error: null });
  });

  it("returns an error when JSON input is not an array of strings", () => {
    const result = parseAuidsInput('["narmstra", 42]');
    expect(result.auids).toEqual([]);
    expect(result.error).toBe("JSON must be an array of strings");
  });

  it("returns an error when JSON input is malformed", () => {
    const result = parseAuidsInput('["narmstra"');
    expect(result.auids).toEqual([]);
    expect(result.error).toMatch(/Invalid JSON/);
  });
});
