#!/usr/bin/env bash
#
# Establish static defaults used by all scripts


# Path to this file's directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Current timestamp
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# Path to directory to store things like cookies and tokens
META="$DIR/meta"

# Where to store cookies
COOKIE_JAR="$META/wikicj"

# File/directory paths
TOKEN_FILE="$META/token.txt"
LOGIN_JSON_FILE="$META/login.json"
OUTPUT_DIR="$DIR/output"
OUTPUT_FILE="$OUTPUT_DIR/output-$TIMESTAMP.json"

