import { formatEVADisplayTitle, getYearDayNumber } from "utils/formatting";

/**
 * Shortcut for making a UTC Date
 * @param year UTC yyyy
 * @param month UTC zero-indexed month
 * @param day UTC day of the month
 * @returns A UTC date
 */
function makeDate(year: number, month: number, day: number): Date {
  const dt = new Date();
  dt.setUTCFullYear(year, month, day);
  return dt;
}

describe("getYearDayNumber", () => {
  it("should handle jan 1", () => {
    const year = 2021;
    const dt = makeDate(year, 0, 1);
    expect(getYearDayNumber(dt)).toEqual(`1`);
  });

  it("should handle feb 1", () => {
    const year = 2021;
    const dt = makeDate(year, 1, 1);
    expect(getYearDayNumber(dt)).toEqual(`32`);
  });

  it("should handle march 1 non-leap year", () => {
    const year = 2021;
    const dt = makeDate(year, 2, 1);
    expect(getYearDayNumber(dt)).toEqual(`60`);
  });

  it("should handle march 1 leap year", () => {
    const year = 2020;
    const dt = makeDate(year, 2, 1);
    expect(getYearDayNumber(dt)).toEqual(`61`);
  });

  it("should handle dec 31 non-leap year", () => {
    const year = 2021;
    const dt = makeDate(year, 11, 31);
    expect(getYearDayNumber(dt)).toEqual(`365`);
  });
});

describe("cleansEVATitleFromWiki", () => {
  const testCases: { title: string; evaName: string; output: string }[] = [
    { title: "RS EVA Things and Stuff", evaName: "RS EVA 99", output: "RS EVA 99" },
    { title: "Things and Stuff", evaName: "RS EVA 98", output: "RS EVA 98" },
    { title: "RPCM P12B A R&R", evaName: "RPCM P12B_A R&R", output: "RPCM P12B A R&R" },
    { title: "RS EVA 26", evaName: "RS EVA Test Name", output: "RS EVA 26 - Test Name" },
    { title: "RS EVA 43", evaName: "Test Name", output: "RS EVA 43 - Test Name" },
    { title: "RS EVA 44", evaName: "RS EVA 44", output: "RS EVA 44" },
    { title: "RS EVA 45", evaName: "RS EVA 45", output: "RS EVA 45" },
    { title: "RS EVA 45A", evaName: "RS EVA 45A", output: "RS EVA 45A" },
    { title: "RS EVA 46", evaName: "RS EVA 46", output: "RS EVA 46" },
    { title: "RS EVA 47", evaName: "RS EVA 47", output: "RS EVA 47" },
    { title: "RS EVA 48", evaName: "RS EVA 48", output: "RS EVA 48" },
    { title: "RS EVA 49", evaName: "RS EVA 49", output: "RS EVA 49" },
    { title: "RS EVA 50", evaName: "RS EVA 50", output: "RS EVA 50" },
    { title: "RS EVA 51", evaName: "RS EVA 51", output: "RS EVA 51" },
    { title: "RS EVA 52", evaName: "RS EVA 52", output: "RS EVA 52" },
    { title: "RS EVA 53", evaName: "RS EVA 53", output: "RS EVA 53" },
    { title: "RS EVA 54", evaName: "RS EVA 54", output: "RS EVA 54" },
    { title: "RS EVA 9A", evaName: "RS EVA 9A", output: "RS EVA 9A" },
    { title: "RS EVA 9B", evaName: "RS EVA 9B", output: "RS EVA 9B" },
    { title: "Expedition 5 RS EVA 7", evaName: "RS EVA 7", output: "RS EVA 7" },
    { title: "Expedition 18 RS EVA 21A", evaName: "RS EVA 21A", output: "RS EVA 21A" },
    { title: "RS EVA ESA", evaName: "RS EVA ESA", output: "RS EVA ESA" },
    { title: "US EVA 1", evaName: "US EVA 1", output: "US EVA 1" },
    { title: "US EVA 10", evaName: "US EVA 10", output: "US EVA 10" },
    { title: "US EVA 11", evaName: "US EVA 11", output: "US EVA 11" },
    { title: "US EVA 12", evaName: "US EVA 12", output: "US EVA 12" },
    { title: "US EVA 13", evaName: "US EVA 13", output: "US EVA 13" },
    { title: "US EVA 14", evaName: "US EVA 14", output: "US EVA 14" },
    { title: "US EVA 15", evaName: "US EVA 15", output: "US EVA 15" },
    { title: "US EVA 16", evaName: "US EVA 16", output: "US EVA 16" },
    { title: "US EVA 17", evaName: "US EVA 17", output: "US EVA 17" },
    { title: "US EVA 18", evaName: "US EVA 18", output: "US EVA 18" },
    { title: "US EVA 19", evaName: "US EVA 19", output: "US EVA 19" },
    { title: "US EVA 2", evaName: "US EVA 2", output: "US EVA 2" },
    { title: "US EVA 20", evaName: "US EVA 20", output: "US EVA 20" },
    { title: "US EVA 21", evaName: "US EVA 21", output: "US EVA 21" },
    { title: "US EVA 22", evaName: "US EVA 22", output: "US EVA 22" },
    { title: "US EVA 23", evaName: "US EVA 23", output: "US EVA 23" },
    { title: "US EVA 24", evaName: "US EVA 24", output: "US EVA 24" },
    { title: "US EVA 25", evaName: "US EVA 25", output: "US EVA 25" },
    { title: "US EVA 26", evaName: "US EVA 26", output: "US EVA 26" },
    {
      title: "US EVA 27",
      evaName: "US EVA 27 (PM Relocate / MTRA Install)",
      output: "US EVA 27 - PM Relocate / MTRA Install",
    },
    { title: "US EVA 28", evaName: "US EVA 28 (SSU/PMM Prep)", output: "US EVA 28 - SSU/PMM Prep" },
    {
      title: "US EVA 29",
      evaName: "US EVA 29 (US EVA IDA1 Cables)",
      output: "US EVA 29 - US EVA IDA1 Cables",
    },
    { title: "US EVA 3", evaName: "US EVA 3", output: "US EVA 3" },
    {
      title: "US EVA 30",
      evaName: "US EVA 30 (IDA 1 Cables / LEE Lube)",
      output: "US EVA 30 - IDA 1 Cables / LEE Lube",
    },
    { title: "US EVA 31", evaName: "US EVA 31 (C2V2)", output: "US EVA 31 - C2V2" },
    { title: "US EVA 32", evaName: "US EVA 32 (ISS UPGRADES)", output: "US EVA 32 - ISS UPGRADES" },
    { title: "US EVA 33", evaName: "US EVA 33 (PVTCS RTOC)", output: "US EVA 33 - PVTCS RTOC" },
    { title: "US EVA 34", evaName: "US EVA 34 (MT Rescue)", output: "US EVA 34 - MT Rescue" },
    { title: "US EVA 35", evaName: "US EVA 35 (1B SSU)", output: "US EVA 35 - 1B SSU" },
    { title: "US EVA 36", evaName: "US EVA 36 (IDA2 Install)", output: "US EVA 36 - IDA2 Install" },
    { title: "US EVA 37", evaName: "US EVA 37 (TTCR Restow)", output: "US EVA 37 - TTCR Restow" },
    {
      title: "US EVA 38",
      evaName: "US EVA 38 (S4 Battery R&R EVA 1)",
      output: "US EVA 38 - S4 Battery R&R EVA 1",
    },
    {
      title: "US EVA 39",
      evaName: "US EVA 39 (S4 Battery R&R EVA 2)",
      output: "US EVA 39 - S4 Battery R&R EVA 2",
    },
    { title: "US EVA 4", evaName: "US EVA 4", output: "US EVA 4" },
    {
      title: "US EVA 40",
      evaName: "US EVA 40 (EPIC SPDM LUBE)",
      output: "US EVA 40 - EPIC SPDM LUBE",
    },
    { title: "US EVA 41", evaName: "US EVA 41 (EPIC Shields)", output: "US EVA 41 - EPIC Shields" },
    { title: "US EVA 42", evaName: "US EVA ExPCA", output: "US EVA 42 - ExPCA" },
    { title: "US EVA 44", evaName: "LEE R&R", output: "US EVA 44 - LEE R&R" },
    { title: "US EVA 45", evaName: "US EVA CP9 & LEE Lube", output: "US EVA 45 - CP9 & LEE Lube" },
    {
      title: "US EVA 46",
      evaName: "US EVA CP13 & LEE Lube",
      output: "US EVA 46 - CP13 & LEE Lube",
    },
    { title: "US EVA 47", evaName: "US EVA LEE B R&R", output: "US EVA 47 - LEE B R&R" },
    { title: "US EVA 48", evaName: "US EVA LEE B R&R", output: "US EVA 48 - LEE B R&R" },
    { title: "US EVA 49", evaName: "US EVA N3 EWC & CP8", output: "US EVA 49 - N3 EWC & CP8" },
    { title: "US EVA 5", evaName: "US EVA 5", output: "US EVA 5" },
    { title: "US EVA 50", evaName: "US EVA PFCS Relocate", output: "US EVA 50 - PFCS Relocate" },
    { title: "US EVA 51", evaName: "US EVA N2 EWC", output: "US EVA 51 - N2 EWC" },
    { title: "US EVA 52", evaName: "P4 Battery R&R", output: "US EVA 52 - P4 Battery R&R" },
    {
      title: "US EVA 53",
      evaName: "P4 Battery R&R EVA 2",
      output: "US EVA 53 - P4 Battery R&R EVA 2",
    },
    { title: "US EVA 54", evaName: "US EVA Truss Jumpers", output: "US EVA 54 - Truss Jumpers" },
    { title: "US EVA 55", evaName: "US EVA IDA3 Install", output: "US EVA 55 - IDA3 Install" },
    {
      title: "US EVA 56",
      evaName: "P6 Batteries: EVA 1",
      output: "US EVA 56 - P6 Batteries: EVA 1",
    },
    {
      title: "US EVA 57",
      evaName: "P6 Batteries: EVA 2",
      output: "US EVA 57 - P6 Batteries: EVA 2",
    },
    { title: "US EVA 58", evaName: "US EVA BCDU 2B2 R&R", output: "US EVA 58 - BCDU 2B2 R&R" },
    {
      title: "US EVA 59",
      evaName: "AMS TTCS Repair EVA 1",
      output: "US EVA 59 - AMS TTCS Repair EVA 1",
    },
    { title: "US EVA 6", evaName: "US EVA 6", output: "US EVA 6" },
    {
      title: "US EVA 60",
      evaName: "AMS TTCS Repair EVA 2",
      output: "US EVA 60 - AMS TTCS Repair EVA 2",
    },
    {
      title: "US EVA 61",
      evaName: "AMS TTCS Repair EVA 3",
      output: "US EVA 61 - AMS TTCS Repair EVA 3",
    },
    {
      title: "US EVA 62",
      evaName: "P6 Batteries: EVA 3",
      output: "US EVA 62 - P6 Batteries: EVA 3",
    },
    {
      title: "US EVA 63",
      evaName: "P6 Batteries: EVA 4",
      output: "US EVA 63 - P6 Batteries: EVA 4",
    },
    {
      title: "US EVA 64",
      evaName: "AMS TTCS Repair EVA 4",
      output: "US EVA 64 - AMS TTCS Repair EVA 4",
    },
    {
      title: "US EVA 65",
      evaName: "US EVA S6 Batteries: 1B EVA 1",
      output: "US EVA 65 - S6 Batteries: 1B EVA 1",
    },
    {
      title: "US EVA 66",
      evaName: "US EVA S6 Batteries: 1B EVA 2",
      output: "US EVA 66 - S6 Batteries: 1B EVA 2",
    },
    {
      title: "US EVA 67",
      evaName: "US EVA S6 Batteries: 3B EVA 1",
      output: "US EVA 67 - S6 Batteries: 3B EVA 1",
    },
    {
      title: "US EVA 68",
      evaName: "US EVA S6 Batteries: 3B EVA 2",
      output: "US EVA 68 - S6 Batteries: 3B EVA 2",
    },
    { title: "US EVA 69", evaName: "US EVA COL Upgrades", output: "US EVA 69 - COL Upgrades" },
    { title: "US EVA 7", evaName: "US EVA 7", output: "US EVA 7" },
    {
      title: "US EVA 70",
      evaName: "US EVA ISS Upgrades II",
      output: "US EVA 70 - ISS Upgrades II",
    },
    { title: "US EVA 71", evaName: "US EVA IROSA Prep", output: "US EVA 71 - IROSA Prep" },
    {
      title: "US EVA 72",
      evaName: "US EVA ISS Upgrades III",
      output: "US EVA 72 - ISS Upgrades III",
    },
    {
      title: "US EVA 73",
      evaName: "US EVA ISS Upgrades 3.5",
      output: "US EVA 73 - ISS Upgrades 3.5",
    },
    {
      title: "US EVA 74",
      evaName: "US EVA P6 IROSA Install EVA 1",
      output: "US EVA 74 - P6 IROSA Install EVA 1",
    },
    {
      title: "US EVA 75",
      evaName: "US EVA P6 IROSA Install EVA 2",
      output: "US EVA 75 - P6 IROSA Install EVA 2",
    },
    {
      title: "US EVA 76",
      evaName: "US EVA P6 IROSA Install EVA 3",
      output: "US EVA 76 - P6 IROSA Install EVA 3",
    },
    { title: "US EVA 77", evaName: "US EVA IROSA Prep 4A", output: "US EVA 77 - IROSA Prep 4A" },
    { title: "US EVA 78", evaName: "US EVA P1 SASA R&R", output: "US EVA 78 - P1 SASA R&R" },
    { title: "US EVA 8", evaName: "US EVA 8", output: "US EVA 8" },
    { title: "US EVA 9", evaName: "US EVA 9", output: "US EVA 9" },
    { title: "US EVA CP13", evaName: "US EVA CP13", output: "US EVA CP13" },
    {
      title: "US EVA IROSA Prep 1A & 3B",
      evaName: "US EVA IROSA Prep 1A & 3B",
      output: "US EVA IROSA Prep 1A & 3B",
    },
    { title: "US EVA MPM R&R", evaName: "US EVA MPM R&R", output: "US EVA MPM R&R" },
    { title: "US EVA MPM Stow", evaName: "US EVA MPM Stow", output: "US EVA MPM Stow" },
    {
      title: "US EVA P4/S4 IROSA Install",
      evaName: "US EVA P4/S4 IROSA Install",
      output: "US EVA P4/S4 IROSA Install",
    },
    {
      title: "US EVA RBVM Jumper Install",
      evaName: "US EVA RBVM Jumper Install",
      output: "US EVA RBVM Jumper Install",
    },
    { title: "US EVA RITS", evaName: "US EVA RITS", output: "US EVA RITS" },
    { title: "US EVA SSRMS J4 R&R", evaName: "US EVA SSRMS J4 R&R", output: "US EVA SSRMS J4 R&R" },
  ];

  for (const testCase of testCases) {
    it("should format properly for " + testCase.title, () => {
      const result = formatEVADisplayTitle({
        pageName: testCase.title,
        descriptiveTitle: testCase.evaName,
      });
      expect(result).toBe(testCase.output);
    });
  }
});
