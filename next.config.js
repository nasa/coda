require('dotenv').config()

const envs = {
  local: {
    TITLE: 'CODA (local)',
    IO_API_URL: 'http://io-mock/api/search/rpp=500',
    IO_HOST: 'https://emss.s3-us-gov-east-1.amazonaws.com',
    IO_KEY: process.env.IO_KEY,
    IO_MOCK_WEBPATH: '/coda/CODA_data/US_EVA_55',
    WIKI_API_URL: 'http://wiki-mock/eva/api.php',
    WIKI_USER: 'none',
    WIKI_PASSWORD: 'none'
  },
  dev: {
    TITLE: 'CODA (dev)',
    IO_API_URL: 'https://io.jsc.nasa.gov/api/search/rpp=500',
    IO_HOST: 'https://io.jsc.nasa.gov',
    IO_KEY: process.env.IO_KEY,
    WIKI_API_URL: 'https://wiki-dev.fit.nasa.gov/iss/api.php',
    WIKI_USER: process.env.WIKI_USER,
    WIKI_PASSWORD: process.env.WIKI_PASSWORD,
  },
  prod: {
    TITLE: 'CODA',
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
