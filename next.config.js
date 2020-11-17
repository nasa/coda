const envs = {
  local: {
    TITLE: 'CODA (local)',
    COOKIE_JAR: "foobar",
    CA_CERT: "something",
    HOST: 'coda-iss.develop',
    IO_HOST: 'io-mock',
    IO_KEY: 'notarealkey',
    WIKI_API_URL: 'http://wiki-mock/eva/api.php',
  },
  dev: {
    TITLE: 'CODA (dev)',
    COOKIE_JAR: "foobar",
    CA_CERT: "something",
    HOST: 'coda-dev.fit.nasa.gov',
    IO_HOST: 'io.jsc.nasa.gov',
    IO_KEY: '3E0556F2-EB15-69B9-4D8C0C12E07E8D37', // TODO env var
    WIKI_API_URL: 'https://wiki.jsc.nasa.gov/eva/api.php'
  },
  prod: {
    TITLE: 'CODA',
    COOKIE_JAR: "foobar",
    CA_CERT: "something",
    HOST: 'coda.fit.nasa.gov',
    IO_HOST: 'io.jsc.nasa.gov',
    IO_KEY: '3E0556F2-EB15-69B9-4D8C0C12E07E8D37', // TODO env var
    WIKI_API_URL: 'https://wiki.jsc.nasa.gov/eva/api.php'
  },
};

module.exports = {
  env: envs[process.env.APP_ENV || 'local']
}
