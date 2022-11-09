#!/bin/sh

# Fail script immediately on errors, don't allow unset variables, and print each command (debugging)
# https://explainshell.com/explain?cmd=set+-eu
set -eu

# In dev we wan to run `npm i` when the container starts. This is because the dependencies could
# change from the time the docker image was built to the time the image was used to create the
# container. In prod the dependencies are locked, so we don't need to re-run.
if [ "${RUN_NPM_INSTALL_ON_START}" = "yes" ]; then
  npm i
else
  echo "RUN_NPM_INSTALL_ON_START=${RUN_NPM_INSTALL_ON_START}. Not running 'npm i' at container start"
fi

# CODA doesn't yet have a database. This code is taken from AEGIS, and will likely need to be
# uncommented if/when CODA adds a database.
# Wait for database to be fully up and running before continuing.
# while ! node ./scripts/test-db.js; do
#   echo "Retry database in 3 seconds"
#   sleep 3
# done
# Now that the database is up and running, ensure that it has the latest schema
# npm run migrate:up

# From https://stackoverflow.com/a/39082923/2782380:
# take any command line arguments passed to entrypoint.sh and exec them as a command. The intention
# is basically "Do everything in this .sh script, then in the same shell run the command the user
# passes in on the command line".
echo "docker-entrypoint.sh complete, running command: $@"
exec "$@"
