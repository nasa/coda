import { Source } from "utils/enums";

export default function RedirectPage() {
  return null;
}

export async function getServerSideProps({ req, query }) {
  let redirectUrl = null;
  if (req) {
    const protocol =
      req.headers["x-forwarded-proto"] || req.connection.encrypted ? "https" : "http";
    const host = req.headers.host;

    // create query string from query object
    let queryString = Object.keys(query)
      .map((key) => `${key}=${query[key]}`)
      .join("&");

    if (queryString === "undefined") {
      queryString = "";
    }
    const source = Source.NBL;
    redirectUrl = `${protocol}://${host}/view?${queryString}&source=${source}`;
  }
  return {
    redirect: {
      destination: redirectUrl,
      permanent: false,
    },
  };
}
