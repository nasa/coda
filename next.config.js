const envs = {
  local: {
    TITLE: 'CODA (local)',
    HOST: 'coda-iss.develop',
    HOST_IO: 'io.jsc.nasa.gov',
    WIKI_API: 'https://wiki.jsc.nasa.gov/eva/api.php'
  },
  dev: {
    TITLE: 'CODA (dev)',
    HOST: 'coda-dev.fit.nasa.gov',
    HOST_IO: 'io.jsc.nasa.gov',
    WIKI_API: 'https://wiki.jsc.nasa.gov/eva/api.php'
  },
  prod: {
    TITLE: 'CODA',
    HOST: 'coda.fit.nasa.gov',
    HOST_IO: 'io.jsc.nasa.gov',
    WIKI_API: 'https://wiki.jsc.nasa.gov/eva/api.php'
  },
};

module.exports = {
  env: envs[process.env.NODE_ENV || 'local']
}
