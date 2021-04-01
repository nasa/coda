const envs = {
  local: {
    NEXT_PUBLIC_APP_ENV: "local",
    TITLE: "CODA (local)",
    IO_HOST: "https://emss.s3-us-gov-east-1.amazonaws.com",
    IO_MOCK_WEBPATH: "/coda/CODA_data/US_EVA_55",
    WIKI_API_URL: "http://wiki-mock/eva/api.php",
    SPACETRACK_API_URL: "https://coda-dev.fit.nasa.gov/coda_server/spacetrack_iss/get_iss.php",
  },
  dev: {
    NEXT_PUBLIC_APP_ENV: "dev",
    TITLE: "CODA (dev)",
    IO_API_URL: "https://io.jsc.nasa.gov/api/search/rpp=500",
    IO_HOST: "https://io.jsc.nasa.gov",
    PROXY_ORIGIN: "https://coda-dev.fit.nasa.gov",
    WIKI_API_URL: "https://wiki-dev.fit.nasa.gov/iss/api.php",
    SPACETRACK_API_URL: "https://coda-dev.fit.nasa.gov/coda_server/spacetrack_iss/get_iss.php",
  },
  prod: {
    NEXT_PUBLIC_APP_ENV: "prod",
    TITLE: "CODA",
    IO_API_URL: "https://io.jsc.nasa.gov/api/search/rpp=500",
    IO_HOST: "https://io.jsc.nasa.gov",
    PROXY_ORIGIN: "https://coda-dev.fit.nasa.gov",
    WIKI_API_URL: "https://wiki.jsc.nasa.gov/iss/api.php",
    SPACETRACK_API_URL: "https://coda-dev.fit.nasa.gov/coda_server/spacetrack_iss/get_iss.php",
  },
};

module.exports = {
  env: envs[process.env.APP_ENV || "local"],
  basePath: "/coda_node",
};
