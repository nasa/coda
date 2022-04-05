#!/usr/bin/env bash
#
# Remove login files

source ./paths.sh

if [ -f "$COOKIE_JAR" ]; then
	rm "$COOKIE_JAR"
fi

if [ -f "$TOKEN_FILE" ]; then
	rm "$TOKEN_FILE"
fi

if [ -f "$LOGIN_JSON_FILE" ]; then
	rm "$LOGIN_JSON_FILE"
fi

echo "Logout complete"
