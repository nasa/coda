import { rest } from "msw";
import { GET_EVAS_QUERY } from "services/iss-wiki";
import getEVAs from "./fakedata/getEVAs.json";

export const handlers = [
  rest.get("http://wiki-mock/eva/api.php", (req, res, ctx) => {
    const query = req.url.searchParams.get("query");
    if (query.includes(GET_EVAS_QUERY)) {
      return res(ctx.json(getEVAs));
    }
  }),
  rest.get("/reviews", (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: "60333292-7ca1-4361-bf38-b6b43b90cb16",
          author: "John Maverick",
          text:
            "Lord of The Rings, is with no absolute hesitation, my most favored and adored book by‑far. The triology is wonderful‑ and I really consider this a legendary fantasy series. It will always keep you at the edge of your seat‑ and the characters you will grow and fall in love with!",
        },
      ])
    );
  }),
];
