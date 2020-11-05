#!/usr/bin/env bash
#
# Get recent changes

source setup.sh

# API action to perform
QUERY="action=query&list=watchlist&format=json"
source "$DIR/query.sh"
