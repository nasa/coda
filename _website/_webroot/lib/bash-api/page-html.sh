#!/usr/bin/env bash
#
# Get page info, including wikitext, using API:Revisions
#
# ref: https://www.mediawiki.org/wiki/API:Revisions

source setup.sh

while [ -z "$TITLE" ]; do
	read -e -p "Page title (not URL encoded, yet): " TITLE
done

# FIXME: This isn't doing URL encoding

# API action to perform
QUERY="action=parse&page=$TITLE&prop=text&formatversion=2&format=json"
verbose "$QUERY"
source "$DIR/query.sh"



