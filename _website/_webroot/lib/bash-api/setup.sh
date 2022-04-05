#!/usr/bin/env bash
#
# Establish defaults, some dynamic, used by all scripts

source ./paths.sh

verbose () {
	if [ "$VERBOSE" = "true" ]; then
		echo "$1"
	fi
}

echoerr () {
	echo "$@" 1>&2;
}

# Source config.sh if exists; else exit
if [ -f "$DIR/config.sh" ]; then
	# echo "Loading config.sh..."
	source "$DIR/config.sh"
	verbose "Username: $USERNAME"
	# echo "Wiki API path: $WIKIAPI"
else
	echo
	echo "File 'config.sh' not found! Exiting." >&2; exit 1
fi

# If CA_CERT not included in config.sh, assume default location
if [ -z "$CA_CERT" ]; then
	verbose ""
	verbose "No CA cert found in $DIR/cacert.pem, assume not required"
	CA_CERT_OPTION=""
else
	if [ ! -f "$CA_CERT" ]; then
		echo
		echo "Specified CA Cert not a valid file:" >&2;
		echo "  $CA_CERT" >&2;
		echo
	fi
	CA_CERT_OPTION="--cacert $CA_CERT"
fi
verbose "CA Cert: $CA_CERT"


# FIXME: Need check to determine if token and cookies still valid
if [ -f "$TOKEN_FILE" ]; then
	verbose "Token exists."
	TOKEN=$(cat "$TOKEN_FILE" | sed 's/\r$//')
else
	verbose "Token does not exits. Logging in."
	verbose "UTF8 check: ☠"
	source "$DIR/login.sh"
fi
