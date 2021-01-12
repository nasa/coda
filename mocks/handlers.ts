import { rest } from "msw";
import getEVAsRes from "./fakedata/getEVAs.json";
import getEVADetailsRes from "./fakedata/getEVADetailsUS_EVA_55.json";
import getAsExecutedEV1Res from "./fakedata/getAsExecutedUS_EVA_55EV1.json";
import getAsExecutedEV2Res from "./fakedata/getAsExecutedUS_EVA_55EV2.json";
import getDayNightRes from "./fakedata/daynight.json";
import getCrewRes from "./fakedata/getCrewUS_EVA_55.json";
import ioRes from "./fakedata/io.json";

export const handlers = [
  rest.get("http://wiki-mock/eva/api.php", (req, res, ctx) => {
    const action = req.headers.get("x-mock-action");
    console.log(`Mocking request for: ${action}...`);
    switch (action) {
      case "getEVAs":
        return res(ctx.json(getEVAsRes));
      case "getEVADetails":
        return res(ctx.json(getEVADetailsRes));
      case "getAsExecutedEV1":
        return res(ctx.json(getAsExecutedEV1Res));
      case "getAsExecutedEV2":
        return res(ctx.json(getAsExecutedEV2Res));
      case "getDayNight":
        return res(ctx.json(getDayNightRes));
      case "getCrew":
        return res(ctx.json(getCrewRes));
      default:
        return res(ctx.json({}));
    }
  }),
  rest.get("http://io-mock/api/search/*", (req, res, ctx) => {
    return res(ctx.json(ioRes));
  }),
];
