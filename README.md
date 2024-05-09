# CODA

_Collaborative Operations Data Activation_

https://coda.fit.nasa.gov/

Consolidating the context of missions, training, and testing into an easy to use platform to relive and revisit each moment. For more info, see https://wiki.jsc.nasa.gov/exploration/index.php/CODA.

Other CODA clock tools

- **The clocksync app**: https://coda.fit.nasa.gov/clocksync/index.html
- **The clockcalc app**: https://coda.fit.nasa.gov/clockcalc/clockcalc.html

## Environments

CODA is deployed using GitLab CI/CD and FIT-provisioned VMs.

| **Branch** | **Environment** | **URL**                        |
| ---------- | --------------- | ------------------------------ |
| `prod`     | production      | https://coda.fit.nasa.gov      |
| `int`      | integration     | https://coda-int.fit.nasa.gov  |
| any        | development     | https://coda-dev.fit.nasa.gov  |
| any        | development2    | https://coda-dev2.fit.nasa.gov |

## Development

### Software Dependencies

- [NodeJS](https://nodejs.dev/) (see the [Dockerfile](./docker/nextjs/Dockerfile) for the version we're using).
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (optional)

### First Time Setup

1. Install JavaScript dependencies: `npm i`
2. Create a `.env.secret` file by running `bash ./scripts/make-dotenv.sh`. This will create a file with blank variables. Ask [someone listed as a maintainer or owner of the CODA repo](https://eegitlab.fit.nasa.gov/emss/coda/-/project_members) for the initial values if you don't have them.
3. Re-run `bash ./scripts/make-dotenv.sh` to generate a `.env` file for your local setup based on the populated `.env.secret`.
4. Get the required NOCA (NASA Operational Certification Authority) Cert. This is required so CODA will authenticate other NASA website's certs.
   1. Go to https://cset.nasa.gov/ascs/application/trust-anchor-management-ntam-for-linux/
   2. In section "Installation for Linux Desktop Use Cases (RHEL only)" (Linux variety is fine for all OSes) go to the "Manual Installation" section
   3. Download zip file
   4. Extract zip and put the `.pem` file into the CODA root directory named `.env.local.cert.pem`
5. **Elevated privileges required:** Change the hosts file to map `coda-local.fit.nasa.gov` to `127.0.0.1`. This is necessary for the direct IO API calls to work, and may be required in the future for LaunchPad authentication.
6. (Required for Docker) Create a self-signed SSL certificate by doing `bash ./scripts/make-dev-ssl-cert.sh`
7. (Optional unless you're making a lot of map requests) Get a Mapbox API key https://account.mapbox.com/. Set it to the `VITE_PUBLIC_MAXBOX_KEY` value in the `.env` file.

### Option 1: Local Dev (non-Docker)

To start CODA locally for development, run the following

```sh
npm run dev
```

Then go to (http://coda-local.fit.nasa.gov:3000)

This command sets up a hot-reloading fullstack node server. If any changes are made to the client, they should appear automatically in the browser. If any changes are made to the server, the server should automatically restart.

Bonus: When run locally, the application is already setup to work with [VS Code's debugger](https://code.visualstudio.com/docs/editor/debugging). Once the dev server is up and running, press F5 to attach to it (assuming the default keybindings haven't been changed in VS Code). Now breakpoints can be set and code execution can be inspected

Here's the [documentation](https://nextjs.org/docs/advanced-features/debugging) on how the debugger is setup.

### Option 2: Fully docker-compose (not recommended for dev)

To preview a production-like setup with a full docker environment, essentially identical to what would be deployed to one of our servers, run the following:

```sh
npm run docker:preview
```

Then go to https://coda-local.fit.nasa.gov. Note the HTTPS not HTTP, since the Docker setup is behind an nginx proxy with a self-signed certificate. Also there is no port number specified, since this is over port 443.

You will likely need to accept the self-signed certificate warning.

The first time this is run, docker will have to `npm install` all packages, even if there is a recent `node_modules` from running `npm install` locally. The packages on the Linux container may be OS-specific, so they cannot be shared with the host machine. They are cached (in `./.local/docker_node_modules`), so subsequent runs of `npm run docker:dev` won't take as long.

To be sure that the Docker images are fully rebuilt after making changes to CODA, run `npm run docker:preview:rebuild`. This is generally not required, however, and simply running `npm run docker:preview` again will be sufficient to rebuild just what is necessary (not rebuild everything). To completely rebuild without using the cache, run `npm run docker:preview:rebuild:nocache`

## Other Stuff

### How to Work with this Repo

CODA is written in JavaScript and [TypeScript](https://www.typescriptlang.org/) for the benefit of strong types and uses the following:

1. [React](https://reactjs.org/) - for structuring the front-end components
2. [Vite](https://vitejs.dev/) - for serving the front-end
3. [Express](https://expressjs.com/) - for serving the back end
4. [Redux](https://redux.js.org/) and [Redux toolkit](https://redux-toolkit.js.org/) - for managing global state

### A note about Time

- All times are stored internally in UTC
- All durations are stored internally in seconds

![XKCD #2867](src/public/images/datetime_2x.png){width=480px}

_[XKCD](https://xkcd.com/2867/) understands our pain..._

## APIs

On the server, CODA interacts with external APIs, cleans data, caches responses, and exposes its own APIs to provide nicely formatted data to clients. CODA interacts with external APIs with the code in `src/server/services`. Browser clients interact with CODA's APIs with the code in `src/http-client/`.

For more information about the APIs CODA interfaces with: https://eegitlab.fit.nasa.gov/emss/coda/-/wikis/APIs
