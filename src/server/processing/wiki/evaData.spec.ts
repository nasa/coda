import { getISSEvaData } from "./evaData";
import { getAllEVAs, getAllAsExecuted, getAllCrew } from "./evaQueries";

vi.mock("./evaQueries");
vi.mock("./auth", () => ({ WIKI_BASE_URL: "https://wiki.example" }));

it("collapses identical Cargo EVA rows while preserving distinct events and dates", async () => {
  const eva = {
    pageName: "US EVA 95",
    "EVA title": "US EVA SSRMS J5 R&amp;R",
    "Maestro event uuid": "e61af2e5",
    "Start date": "2026-06-30",
    "Start hour": "12",
    "Start minute": "00",
    "Duration hour": null,
    "Duration minute": null,
  };
  vi.mocked(getAllEVAs).mockResolvedValue([
    eva,
    { ...eva },
    { ...eva },
    { ...eva, pageName: "US EVA 96" },
    { ...eva, "Start date": "2026-06-29" },
  ]);
  vi.mocked(getAllAsExecuted).mockResolvedValue([]);
  vi.mocked(getAllCrew).mockResolvedValue([]);

  const response = await getISSEvaData();

  expect(response.fetchMetadata.success).toBe(true);
  expect(response.data).toHaveLength(3);
  expect(response.data?.map(({ name, startDate }) => [name, startDate])).toEqual([
    ["US EVA 95", "2026-06-30"],
    ["US EVA 96", "2026-06-30"],
    ["US EVA 95", "2026-06-29"],
  ]);
  expect(response.data?.[0].displayTitle).toBe("US EVA 95 - SSRMS J5 R&R");
});
