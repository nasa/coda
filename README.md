# CODA

Contextual Operations Data Activation

https://coda.fit.nasa.gov/

Consolidating the context of missions, training, and testing into an easy to use platform to relive and revisit each moment. For more info, see https://wiki.jsc.nasa.gov/exploration/index.php/CODA.

Other CODA clock tools

- **The clocksync app**: https://coda.fit.nasa.gov/clocksync/index.html
- **The clockcalc app**: https://coda.fit.nasa.gov/clockcalc/clockcalc.html

## Setup Outside NASA

CODA is open source, but its production deployment integrates with NASA-only
authentication, data services, documentation, and package registries. Public
development uses mock authentication, local logging, and offline responses for
those integrations.

### Prerequisites

- Node.js 24 (the version used by [`docker/apiv1/Dockerfile`](docker/apiv1/Dockerfile))
- Docker Desktop with Docker Compose

### First-time setup

1. Install dependencies and local stand-ins for any unavailable private
   `@emss/*` packages:

   ```sh
   npm run setup:public
   ```

   The stand-ins are documented in
   [`emss-fallback/README.md`](emss-fallback/README.md). They preserve CODA's
   imports but intentionally do not provide NASA authentication or remote logging.

2. Copy [`.env.template`](.env.template) to `.env`:

   ```sh
   cp .env.template .env
   ```

3. Start PostgreSQL and the optional local MediaMTX mock:

   ```sh
   npm run docker:services:public
   ```

4. Create the database schema:

   ```sh
   npm run migration:up
   ```

5. Start CODA:

   ```sh
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

The public setup starts with an empty database. CODA will load, and database-backed
admin features remain available, but NASA mission media and operational data are not
included. With `OFFLINE_MODE=true`, CODA does not automatically contact Imagery
Online, TOPO, the NASA wiki, Talkybot, the internal map service, or another CODA
deployment. A personal Mapbox token may be added to `VITE_PUBLIC_MAPBOX_KEY` if that
map is needed.

Public setup does **not** require NASA credentials, the NASA CA certificate, a hosts
file change, or access to the internal npm/container registries. The fully Dockerized
preview remains intended for the NASA deployment environment.

### Optional: Download the help video

The welcome overlay's help video is available as a separate `CODA_public_assets.zip`
download. Public setup works without it and does not request the NASA-hosted video.

1. Download [CODA_public_assets.zip](https://ares-aegis.s3.us-gov-west-1.amazonaws.com/CODA_public_assets.zip)
   and place it in the repository root, or run:

   ```sh
   curl -fL -o CODA_public_assets.zip \
     https://ares-aegis.s3.us-gov-west-1.amazonaws.com/CODA_public_assets.zip
   ```

2. Extract the pack into Vite's public assets folder:

   ```sh
   unzip CODA_public_assets.zip -d src/public
   ```

   On Windows PowerShell, use:

   ```powershell
   Expand-Archive -LiteralPath CODA_public_assets.zip -DestinationPath src/public
   ```

   This creates `src/public/media/coda-help-video.mp4`.
3. Set the following value in `.env`:

   ```dotenv
   VITE_PUBLIC_HELP_VIDEO_URL="/media/coda-help-video.mp4"
   ```

4. Restart `npm run dev`. The welcome overlay now plays the local video. If building
   CODA instead, run `npm run build` again so the setting and video are included.

The pack contains only the help video and installation notes; it does not seed the
database or include mission data. Leave `VITE_PUBLIC_HELP_VIDEO_URL` empty to omit
the video. NASA developers without this setting continue to use the hosted video.

## Environments

CODA is deployed using GitLab CI/CD and FIT-provisioned VMs.

| **Branch** | **Environment** | **URL**                         |
| ---------- | --------------- | ------------------------------- |
| `prod`     | production      | https://coda.fit.nasa.gov       |
| `int`      | integration     | https://coda-int.fit.nasa.gov   |
| any        | development     | Any EMSS dev server (see below) |

EMSS dev servers all have element names, and are:

- https://carbon-emss-dev.fit.nasa.gov
- https://gold-emss-dev.fit.nasa.gov
- https://iron-emss-dev.fit.nasa.gov
- https://neon-emss-dev.fit.nasa.gov
- https://oxygen-emss-dev.fit.nasa.gov

## Development Within NASA

> These instructions require access to NASA's internal package registry,
> credentials, certificates, services, and documentation. External contributors
> should use [Setup Outside NASA](#setup-outside-nasa).

### Software Dependencies

- [NodeJS](https://nodejs.dev/) (see the [Dockerfile](./docker/apiv1/Dockerfile) for the version we're using).
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (optional)

### First Time Setup

1. Install JavaScript dependencies: `npm i`
2. Get the secret values from another CODA developer and paste them into a new file called `env.secret.ts`.
3. Create a `./.env` file by running `npm run make-dotenv` in the terminal.
4. Get the required NOCA (NASA Operational Certification Authority) Cert. This is required so CODA will authenticate other NASA website's certs.
   1. Go to https://cset.nasa.gov/ascs/application/trust-anchor-management-ntam-for-linux/
   2. In section "Installation for Linux Desktop Use Cases (RHEL only)" (Linux variety is fine for all OSes) go to the "Manual Installation" section
   3. Download zip file
   4. Extract zip and put the `.pem` file into the CODA root directory named `.env.local.cert.pem`

5. **Elevated privileges required:** Change the hosts file to map `coda-local.fit.nasa.gov` to `127.0.0.1`. This is necessary for the direct IO API calls to work, and may be required in the future for LaunchPad authentication.
6. (Required for Docker) Create a self-signed SSL certificate by doing `bash ./scripts/make-dev-ssl-cert.sh`
7. (Optional unless you're making a lot of map requests) Get a Mapbox API key https://account.mapbox.com/. Set it to the `VITE_PUBLIC_MAPBOX_KEY` value in the `.env` file.

### Option 1: Local Dev (non-Docker)

To start CODA locally for development, run the following

```sh
npm run docker:services
npm run dev
```

Then go to (http://coda-local.fit.nasa.gov:3000)

This command sets up a hot-reloading fullstack node server. If any changes are made to the client, they should appear automatically in the browser. If any changes are made to the server, the server should automatically restart.

Bonus: When run locally, the application is already setup to work with [VS Code's debugger](https://code.visualstudio.com/docs/editor/debugging). Once the dev server is up and running, press F5 to attach to it (assuming the default keybindings haven't been changed in VS Code). Now breakpoints can be set and code execution can be inspected. The `.vscode/launch.json` file in this repo includes the debugger configuration.

### Option 2: Fully docker-compose (not recommended for dev)

To preview a production-like setup with a full docker environment, essentially identical to what would be deployed to one of our servers, run the following

```sh
npm run docker:preview
```

Then go to https://coda-local.fit.nasa.gov. Note the HTTPS not HTTP, since the Docker setup is behind an nginx proxy with a self-signed certificate. Also there is no port number specified, since this is over port 443.

You will likely need to accept the self-signed certificate warning.

To be sure that the Docker images are fully rebuilt after making changes to CODA, run `npm run docker:preview:rebuild`. This is generally not required, however, and simply running `npm run docker:preview` again will be sufficient to rebuild just what is necessary (not rebuild everything). To completely rebuild without using the cache, run `npm run docker:preview:rebuild:nocache`

## Other Stuff

### How to Work with this Repo

CODA is written in JavaScript and [TypeScript](https://www.typescriptlang.org/) for the benefit of strong types and uses the following:

1. [React](https://reactjs.org/) - for structuring the front-end components
2. [Vite](https://vitejs.dev/) - for serving the front-end
3. [Express](https://expressjs.com/) - for serving the back end
4. [Redux](https://redux.js.org/) and [Redux toolkit](https://redux-toolkit.js.org/) - for managing global state

### Postgres Version Upgrades

When the Postgres version is updated in `docker-compose.yml`, the database must be migrated:

**For Dev Environments (e.g., gold, iron, etc.):**
For dev environments, when the database version is updated, the database has to be manually migrated by exporting the production database and importing it into the dev environment. This is because we don't know if CODA is already deployed on each dev server so an in-place upgrade might not work--so we don't try.

1. Deploy to the dev environment (e.g., gold)
2. Run the manual CI job `z:db-export:prod` to export the production database
3. Run the manual CI job `z:db-import:<env>` to import the database to the dev environment

**For Integration and Production:**
This does in-place upgrades automatically on every deployment because CODA is always deployed to these environments.

The [`scripts/upgrade-db.sh`](./scripts/upgrade-db.sh) script automatically handles version upgrades on every deployment. It compares the running Postgres version against the target version in `docker-compose.yml` and performs an in-place upgrade if needed (dump → remove old data → reimport on new version).

### A note about Time

- All times are stored internally in UTC
- All durations are stored internally in seconds

![XKCD #2867](src/public/images/datetime_2x.png){width=480px}

_[XKCD](https://xkcd.com/2867/) understands our pain..._

## APIs

On the server, CODA interacts with external APIs, cleans data, caches responses, provides its data to the client-side via sockets, and exposes its own APIs to provide nicely formatted data to other clients. CODA interacts with external APIs with the code in `src/server/services`.

For more information about the APIs CODA interfaces with: https://eegitlab.fit.nasa.gov/emss/coda/-/wikis/APIs
