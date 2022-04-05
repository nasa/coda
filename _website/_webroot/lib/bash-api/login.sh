#!/usr/bin/env bash
#
# Login to wiki. THIS SHOULD NOT BE RUN DIRECTLY. IT IS SOURCED FROM setup.sh.

if [ -z "$CA_CERT_OPTION" ]; then
	# If no CA_CERT variable defined, assume setup.sh hasn't run and exit
	# exit 1;
	verbose "Using default CA cert"
fi

#
# Login part 1: Get login token
#
verbose "Logging into $WIKIAPI as $USERNAME..."

#printf "%s" "Logging in (1/2)..."
verbose "Get login token..."
CR=$(curl -S \
	--silent \
	--location \
	${CA_CERT_OPTION} \
	--retry 2 \
	--retry-delay 5\
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
	--request "GET" "${WIKIAPI}?action=query&meta=tokens&type=login&format=json")

verbose $(echo "$CR" | jq .)

if [ -f "$LOGIN_JSON_FILE" ]; then
	rm "$LOGIN_JSON_FILE"
fi

echo "$CR" > "$LOGIN_JSON_FILE"
TOKEN=$(echo "$CR" | jq -r '.query.tokens.logintoken')

#Remove carriage return!
printf "%s" "$TOKEN" > "$TOKEN_FILE"
TOKEN=$(cat "$TOKEN_FILE" | sed 's/\r$//')



if [ "$TOKEN" == "null" ]; then
	echo "Getting a login token failed." >&2;
	exit 1
else
	verbose "Login token is $TOKEN"
fi


#
# Login part 2: Login with login token
#
verbose "Logging in..."
CR=$(curl -S \
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
	--data-urlencode "username=${USERNAME}" \
	--data-urlencode "password=${USERPASS}" \
	--data-urlencode "rememberMe=1" \
	--data-urlencode "logintoken=${TOKEN}" \
	--data-urlencode "loginreturnurl=http://en.wikipedia.org" \
	--request "POST" "${WIKIAPI}?action=clientlogin&format=json")

verbose $(echo "$CR" | jq .)

STATUS=$(echo $CR | jq '.clientlogin.status')
if [[ $STATUS == *"PASS"* ]]; then
	verbose "Successfully logged in as $USERNAME, STATUS is $STATUS."
	verbose "-----"
else
	echo "Unable to login, is logintoken ${TOKEN} correct?" >&2;
	exit
fi
