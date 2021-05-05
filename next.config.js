const envs = {
  local: {
    NEXT_PUBLIC_APP_ENV: "local",
    TITLE: "CODA (local)",
    HOST: "http://coda-local.nasa.gov:3000",
    IO_API_URL: "https://io.jsc.nasa.gov/api/search/rpp=500",
    IO_HOST: "https://emss.s3-us-gov-east-1.amazonaws.com",
    IO_MOCK_MEDIA_URL: "https://emss.s3-us-gov-east-1.amazonaws.com/coda_data/",
    WIKI_API_URL: "http://wiki-mock/eva/api.php",
    SPACETRACK_API_URL: "http://coda-data.apolloinrealtime.org/spacetrack_iss/get_iss.php",
  },
  development: {
    NEXT_PUBLIC_APP_ENV: "development",
    TITLE: "CODA (dev)",
    HOST: "https://coda-dev2.fit.nasa.gov",
    IO_API_URL: "https://io.jsc.nasa.gov/api/search/rpp=500",
    IO_HOST: "https://io.jsc.nasa.gov",
    // FYI, this is the dev wiki, which can be useful for testing changes to the info we're pulling from the wiki
    // WIKI_API_URL: "https://wiki-dev.fit.nasa.gov/iss/api.php",
    WIKI_API_URL: "https://wiki.jsc.nasa.gov/iss/api.php",
    // seconds to keep the server-side API hits cached (assuming we get a response)
    CACHE_AGE: "300",
    CACHE_ROOT: "./server/.cache/",
  },
  production: {
    NEXT_PUBLIC_APP_ENV: "prod",
    TITLE: "CODA",
    HOST: "https://coda.fit.nasa.gov",
    IO_API_URL: "https://io.jsc.nasa.gov/api/search/rpp=500",
    IO_HOST: "https://io.jsc.nasa.gov",
    WIKI_API_URL: "https://wiki.jsc.nasa.gov/iss/api.php",
    // FYI, this is the dev wiki, which can be useful for testing changes to the info we're pulling from the wiki
    // WIKI_API_URL: "https://wiki-dev.fit.nasa.gov/iss/api.php",
    // SPACETRACK_API_URL: "https://coda-dev.fit.nasa.gov/coda_server/spacetrack_iss/get_iss.php",
  },
};

module.exports = {
  env: envs[process.env.NODE_ENV || "production"],
};
