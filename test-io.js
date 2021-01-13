const fetch = require('node-fetch');
const url = "https://io.jsc.nasa.gov/api/search/rpp=500&s_dt=08-21-2019&e_dt=08-21-2019&as=2?key=3E0556F2-EB15-69B9-4D8C0C12E07E8D37&format=json"
const options = {
  headers: {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Accept-Encoding": "gzip,deflate,br",
    "Accept-Language": "en-US,en;q=0.9",
    Connection: "keep-alive",
    Origin: "https://coda-dev.fit.nasa.gov",
  }
};

fetch(url, options).then(res => res.json()).catch(console.error).then(console.log);
