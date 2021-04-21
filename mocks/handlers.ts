import { rest } from "msw";
import getAllEVAsRes from "./fakedata/getAllEVAs.json";
import getAllAsExecutedRes from "./fakedata/getAllAsExecuted.json";
import getAllCrewRes from "./fakedata/getAllCrew.json";

export const handlers = [
  rest.get("http://wiki-mock/eva/api.php", (req, res, ctx) => {
    const action = req.headers.get("x-mock-action");
    console.log(`Mocking request for: ${action}...`);
    switch (action) {
      case "getAllEVAs":
        return res(ctx.json(getAllEVAsRes));
      case "getAllAsExecuted":
        return res(ctx.json(getAllAsExecutedRes));
      case "getAllCrew":
        return res(ctx.json(getAllCrewRes));
      default:
        return res(ctx.json({}));
    }
  }),
];
