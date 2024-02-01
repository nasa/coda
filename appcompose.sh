#!/bin/sh


export DOCKER_SCAN_SUGGEST=false

if [ "${1}" = 'dev' ]; then
  docker compose -f docker-compose.yml -f docker-compose.dev.yml "${@:2}"
elif [ "${1}" = "preview" ]; then
  docker compose -f docker-compose.yml -f docker-compose.preview.yml "${@:2}"
else
  echo "Must specify 'dev' or 'preview'"
fi
