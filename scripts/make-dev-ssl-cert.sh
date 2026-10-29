#!/bin/bash
#
# Creates a self-signed SSL certificate for the purpose of local development

set -euo pipefail
umask 077
CN="${1:-coda-local.fit.nasa.gov}"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
LOCAL_DIR="${SCRIPT_DIR}/../.local"
CERTS_DIR="${LOCAL_DIR}/certs"
PRIVATE_DIR="${LOCAL_DIR}/private"

mkdir -p "${CERTS_DIR}"
mkdir -p "${PRIVATE_DIR}"

CERT="${CERTS_DIR}/nginx.crt"
KEY="${PRIVATE_DIR}/nginx.key"

certificate_is_current() {
    [ -f "${CERT}" ] && [ -f "${KEY}" ] || return 1
    openssl x509 -in "${CERT}" -checkend 2592000 -noout >/dev/null 2>&1 || return 1
    openssl x509 -in "${CERT}" -checkhost "${CN}" -noout >/dev/null 2>&1 || return 1
    # Browsers require the hostname in Subject Alternative Name, even if the CN matches.
    case "$(openssl x509 -in "${CERT}" -noout -ext subjectAltName 2>/dev/null)" in
        *"DNS:${CN}"*) ;;
        *) return 1 ;;
    esac
    local cert_public_key key_public_key
    cert_public_key=$(openssl x509 -in "${CERT}" -pubkey -noout | openssl sha256) || return 1
    key_public_key=$(openssl pkey -in "${KEY}" -passin pass: -pubout 2>/dev/null | openssl sha256) || return 1
    [ "${cert_public_key}" = "${key_public_key}" ]
}

if certificate_is_current; then
    echo "Existing certificate for ${CN} is valid for at least another 30 days."
else
    NEW_CERT="${CERT}.tmp.$$"
    NEW_KEY="${KEY}.tmp.$$"
    trap 'rm -f "${NEW_CERT}" "${NEW_KEY}"' EXIT

    MSYS2_ARG_CONV_EXCL="/C=;subjectAltName=" openssl req -x509 -newkey rsa:4096 \
        -keyout "${NEW_KEY}" \
        -out "${NEW_CERT}" \
        -days 365 -nodes \
        -subj "/C=US/ST=Texas/L=Houston/O=NASA/CN=${CN}" \
        -addext "subjectAltName=DNS:${CN},DNS:localhost,IP:127.0.0.1"

    if [ -f "${CERT}" ] || [ -f "${KEY}" ]; then
        BACKUP_DIR="${LOCAL_DIR}/cert-backups/$(date -u +%Y%m%dT%H%M%SZ)-$$"
        mkdir -p "${BACKUP_DIR}"
        [ ! -f "${CERT}" ] || cp "${CERT}" "${BACKUP_DIR}/nginx.crt"
        [ ! -f "${KEY}" ] || cp "${KEY}" "${BACKUP_DIR}/nginx.key"
        echo "Previous certificate and key backed up to ${BACKUP_DIR}"
    fi
    mv "${NEW_CERT}" "${CERT}"
    mv "${NEW_KEY}" "${KEY}"
    echo "Created a new local certificate for ${CN}."
fi

openssl x509 -in "${CERT}" -noout -subject -dates -ext subjectAltName
echo "Trust ${CERT} in your browser, then restart Vite and open https://${CN}:3000."
