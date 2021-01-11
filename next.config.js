require('dotenv').config()

const envs = {
  local: {
    TITLE: 'CODA (local)',
    COOKIE_JAR: "foobar",
    CA_CERT: "something",
    HOST: 'coda-iss.develop',
    IO_API_URL: 'https://io.jsc.nasa.gov/api/search/rpp=500',
    IO_HOST: 'https://io.jsc.nasa.gov',
    IO_KEY: process.env.IO_KEY,
    WIKI_API_URL: 'http://wiki-mock/eva/api.php',
    WIKI_USER: 'none',
    WIKI_PASSWORD: 'none'
  },
  dev: {
    TITLE: 'CODA (dev)',
    COOKIE_JAR: "foobar",
    CA_CERT: "something",
    HOST: 'coda-dev.fit.nasa.gov',
    IO_API_URL: 'https://io.jsc.nasa.gov/api/search/rpp=500',
    IO_HOST: 'https://io.jsc.nasa.gov',
    IO_KEY: process.env.IO_KEY,
    WIKI_API_URL: 'https://wiki-dev.fit.nasa.gov/iss/api.php',
    WIKI_USER: process.env.WIKI_USER_DEV,
    WIKI_PASSWORD: process.env.WIKI_PASSWORD_DEV,
  },
  prod: {
    TITLE: 'CODA',
    COOKIE_JAR: "foobar",
    CA_CERT: "something",
    HOST: 'coda.fit.nasa.gov',
    IO_API_URL: 'https://io.jsc.nasa.gov/api/search/rpp=500',
    IO_HOST: 'https://io.jsc.nasa.gov',
    IO_KEY: process.env.IO_KEY,
    WIKI_API_URL: 'https://wiki.jsc.nasa.gov/eva/api.php',
    WIKI_USER: process.env.WIKI_USER,
    WIKI_PASSWORD: process.env.WIKI_PASSWORD,
  },
};

module.exports = {
  env: envs[process.env.APP_ENV || 'local']
}
