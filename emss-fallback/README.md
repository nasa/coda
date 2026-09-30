# `@emss/*` fallbacks (public build)

These are minimal stand-ins for private `@emss/*` packages hosted on NASA's
internal package registry. They support local development with mock
authentication and local-only logging; they do not provide NASA authentication,
remote logging, or internal service access.

`npm run setup:public` installs dependencies, then copies these ESM packages
into `node_modules/@emss` if the optional private packages were unavailable.
Existing CODA imports therefore work without source aliases. Internal developers
can continue to use `npm install` and the real packages.

Keep a fallback's runtime exports and declarations synchronized whenever a new
`@emss/*` API is imported by CODA.