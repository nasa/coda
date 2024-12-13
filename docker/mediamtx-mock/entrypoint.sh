#!/bin/sh
# Explicitly set FONTCONFIG_FILE environment variable
export FONTCONFIG_FILE=/etc/fonts/fonts.conf

# Set up a cron job to delete empty folders in /recordings because mediamtx doesn't clean up after itself
echo "*/5 * * * * find /recordings -type d -empty -delete" > /etc/cron.d/delete_empty_folders

# Set up a cron job to delete HLS files older than 26 hours
echo "*/5 * * * * find /hls -type f -mmin +1560 -delete" > /etc/cron.d/delete_old_hls_files

chmod 0644 /etc/cron.d/delete_empty_folders
crontab /etc/cron.d/delete_empty_folders
cron &

# Execute MediaMTX with the default command
exec "$@"
