#!/usr/bin/env bash
#
# Use all pages API
#
# ref: https://www.mediawiki.org/wiki/API:Allpages

source setup.sh

while [ -z "$LIMIT" ]; do
	read -e -p "Integer value of records to return: " LIMIT
done

re='^[0-9]+$'
if ! [[ $LIMIT =~ $re ]] ; then
   echo "error: '$LIMIT' is not a number" >&2; exit 1
fi

# FIXME: This isn't doing URL encoding
if [ ! -z "$START" ]; then
	START="apfrom=$START&"
else
	START=""
fi

# API action to perform
QUERY="action=query&list=allpages&${START}aplimit=$LIMIT&format=json"
verbose "$QUERY"
source "$DIR/query.sh"
