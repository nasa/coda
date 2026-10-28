#!/bin/bash
#
# Creates a self-signed SSL certificate for the purpose of local development

set -euo pipefail
CN="${1:-coda-local.fit.nasa.gov}"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
LOCAL_DIR="${SCRIPT_DIR}/../.local"
CERTS_DIR="${LOCAL_DIR}/certs"
PRIVATE_DIR="${LOCAL_DIR}/private"

mkdir -p "${CERTS_DIR}"
mkdir -p "${PRIVATE_DIR}"

MSYS2_ARG_CONV_EXCL="/C=;subjectAltName=" openssl req -x509 -newkey rsa:4096 \
    -keyout "${PRIVATE_DIR}/nginx.key" \
    -out "${CERTS_DIR}/nginx.crt" \
    -days 365 -nodes \
    -subj "/C=US/ST=Texas/L=Houston/O=NASA/CN=${CN}" \
    -addext "subjectAltName=DNS:${CN},DNS:localhost,IP:127.0.0.1"
