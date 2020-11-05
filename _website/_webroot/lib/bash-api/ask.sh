#!/usr/bin/env bash
#
# Get recent changes

source setup.sh

if [ -z "$1" ]; then
	echoerr "Run this script with an ask query as first argument:"
	echoerr 'askquery.sh "[[Category:EVA skill element]] | limit = 5"'
	exit 1
fi

# API action to perform
ASKQUERY="$1"
verbose "Pre URL encode: $ASKQUERY"
ASKQUERY=$(echo "{\"text\":\"$ASKQUERY\"}" | jq -rc '@uri "\(.text)"')
verbose "Post URL encode: $ASKQUERY"

QUERY="action=ask&format=json&query=$ASKQUERY"
verbose "Query string: $QUERY"
source "$DIR/query.sh"
