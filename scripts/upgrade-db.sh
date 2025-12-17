#!/bin/bash
set -e

# This script upgrades the database when a major Postgres version change is detected
# It is run on the deployment host by CI/CD before deploying the new container version

# Load environment variables
if [ -f .env ]; then
  source .env
fi

# Configuration
DOCKER_DB_DATA_DIR=${DOCKER_DB_DATA_DIR:-/d1/coda/postgres}
DOCKER_DB_INIT_DIR=${DOCKER_DB_INIT_DIR:-/d1/coda/db-init}
LOG_DATA_APP_ID=${LOG_DATA_APP_ID:-coda}
CONTAINER_NAME="${LOG_DATA_APP_ID}--database"
DB_NAME=${DB_NAME:-coda}

echo "Starting database upgrade check for container: $CONTAINER_NAME"

# 1. Determine Target Version from docker-compose.yml
if [ ! -f docker-compose.yml ]; then
  echo "Error: docker-compose.yml not found. Cannot determine target version."
  exit 1
fi

# Extract the image line for the 'database' service
# We look for '  database:' (exactly 2-space indented, as a top-level service) and then the first 'image:' line inside it
# The pattern ensures we match the database SERVICE, not 'database:' appearing in depends_on blocks
TARGET_IMAGE_LINE=$(awk '/^  database:$/{flag=1} flag && /^    image:/{print $0; exit}' docker-compose.yml)
# Clean up to get just the image name (remove 'image:', quotes, spaces)
TARGET_IMAGE_RAW=$(echo $TARGET_IMAGE_LINE | sed 's/image://;s/"//g;s/ //g')
# Expand environment variables in the image string
TARGET_IMAGE=$(eval echo $TARGET_IMAGE_RAW)

echo "Target image found in docker-compose.yml: $TARGET_IMAGE"

# Extract major version (digits after the first colon)
TARGET_MAJOR_VERSION=$(echo $TARGET_IMAGE | sed -E 's/.*:([0-9]+).*/\1/')

if ! [[ "$TARGET_MAJOR_VERSION" =~ ^[0-9]+$ ]]; then
  echo "Error: Could not extract integer major version from image string '$TARGET_IMAGE'. Skipping upgrade check."
  exit 0
fi

echo "Target Postgres Major Version: $TARGET_MAJOR_VERSION"

# 2. Get Running Version
if ! docker ps | grep -q "$CONTAINER_NAME"; then
  echo "Container $CONTAINER_NAME is not running. Skipping upgrade."
  exit 0
fi

RUNNING_VERSION_FULL=$(docker exec $CONTAINER_NAME psql -U postgres -t -c "SHOW server_version;" | tr -d ' \r\n')
RUNNING_MAJOR_VERSION=$(echo $RUNNING_VERSION_FULL | cut -d. -f1)
echo "Running Postgres Version (from container): $RUNNING_VERSION_FULL (Major: $RUNNING_MAJOR_VERSION)"

# 3. Compare and Migrate
if [ -n "$RUNNING_MAJOR_VERSION" ] && [ "$RUNNING_MAJOR_VERSION" -lt "$TARGET_MAJOR_VERSION" ]; then
  echo "Detected upgrade needed from $RUNNING_MAJOR_VERSION to $TARGET_MAJOR_VERSION..."

  echo "1. Dumping database..."
  # Dump to a temporary file first
  # Using --clean to drop objects before recreating, and --if-exists to avoid errors if objects don't exist
  if ! docker exec $CONTAINER_NAME pg_dump -U postgres -d "$DB_NAME" --clean --if-exists > dump.sql; then
    echo "CRITICAL ERROR: Database dump failed. Aborting upgrade to prevent data loss."
    rm -f dump.sql
    exit 1
  fi

  # Verify the dump file is not empty and contains data
  if [ ! -s dump.sql ]; then
    echo "CRITICAL ERROR: Database dump file is empty. Aborting upgrade to prevent data loss."
    rm -f dump.sql
    exit 1
  fi

  DUMP_SIZE=$(wc -c < dump.sql)
  echo "   Dump completed successfully. Size: $DUMP_SIZE bytes"

  echo "2. Preparing init directory..."
  # Clear and recreate init directory to ensure clean state
  echo "$DEPLOY_SUDO_PASS" | sudo -S rm -rf "$DOCKER_DB_INIT_DIR"
  echo "$DEPLOY_SUDO_PASS" | sudo -S mkdir -p "$DOCKER_DB_INIT_DIR"
  # Move dump to init directory
  # PostgreSQL entrypoint runs .sql files against $POSTGRES_DB (set in docker-compose.yml)
  echo "$DEPLOY_SUDO_PASS" | sudo -S mv dump.sql "$DOCKER_DB_INIT_DIR/restore-dump.sql"
  echo "$DEPLOY_SUDO_PASS" | sudo -S chmod 644 "$DOCKER_DB_INIT_DIR/restore-dump.sql"

  echo "3. Stopping database container..."
  docker stop $CONTAINER_NAME
  docker rm $CONTAINER_NAME

  echo "4. Removing old data directory..."
  # We remove the old data directory so the new container can start fresh
  # and import the dump we just created in step 2.
  echo "$DEPLOY_SUDO_PASS" | sudo -S rm -rf "$DOCKER_DB_DATA_DIR"

  echo "Upgrade preparation complete."
  echo "The next deployment step will start the new Postgres $TARGET_MAJOR_VERSION container."
  echo "The new container will initialize with an empty data directory and import $DOCKER_DB_INIT_DIR/restore-dump.sql."

elif [ "$RUNNING_MAJOR_VERSION" -eq "$TARGET_MAJOR_VERSION" ]; then
  echo "Database is already on version $TARGET_MAJOR_VERSION. No upgrade needed."
else
  echo "Running version ($RUNNING_MAJOR_VERSION) is newer than target ($TARGET_MAJOR_VERSION). Skipping upgrade."
fi
