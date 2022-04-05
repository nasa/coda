#!/usr/bin/env bash
#
# Get page info using API:Revisions
#
# ref: https://www.mediawiki.org/wiki/API:Revisions

source setup.sh

while [ -z "$TITLE" ]; do
	read -e -p "Page title (not URL encoded, yet): " TITLE
done

# FIXME: This isn't doing URL encoding

# API action to perform
QUERY="action=query&prop=revisions&titles=$TITLE&rvprop=timestamp%7Cuser%7Ccomment%7Ccontent&formatversion=2&format=json"
verbose "$QUERY"
source "$DIR/query.sh"
