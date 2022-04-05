#!/usr/bin/env bash
#
# Run an API query. THIS SCRIPT SHOULD NOT BE ENVOKED DIRECTLY.

if [ -z "$QUERY" ]; then
	echo "You must specify \$QUERY" >&2;
	exit 1
fi

API_URL="${WIKIAPI}?${QUERY}"

verbose "Fetching $API_URL"
CR=$(curl -S \
	--globoff \
	--silent \
	--location \
	${CA_CERT_OPTION} \
	--cookie $COOKIE_JAR \
	--cookie-jar $COOKIE_JAR \
	--user-agent "Curl Shell Script" \
	--keepalive-time 60 \
	--header "Accept-Language: en-us" \
	--header "Accept-Encoding: gzip,deflate" \
	--header "User-Agent: bash-api-$USERNAME" \
	--header "Connection: keep-alive" \
	--header "X-SKIP-SAML: True" \
	--compressed \
	--request "GET" "$API_URL")


# this is not verbose...
echo "$CR" | jq .

echo "$CR" > "$OUTPUT_FILE"
