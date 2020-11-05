# CODA

_Collaborative Operations Data Activation_

Consolidating the context of missions, training, and testing into an easy to use platform to relive and revisit each moment. For more info, see https://wiki.jsc.nasa.gov/exploration/index.php/CODA.

## Development

This site is all static files. All you need to do is spin up a server to serve them. If you don't have a preferred static server, here's a quick Python script to whip one up on port 8000.

```sh
python -m http.server
```

Then head over to `http://localhost:8000` and click through to `_website/_webroot/index.html` to see the site.
