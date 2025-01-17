# This instance of mediamtx is only used for local stream mocks
# and is not used for any other purpose
# and is only run in the npm run docker:services command.

# Use Debian as the base image for better FFmpeg support
FROM debian:latest

# Add the deb-multimedia repository for newer FFmpeg packages
RUN apt-get update && \
    apt-get install -y wget gnupg procps cron && \
    wget https://www.deb-multimedia.org/pool/main/d/deb-multimedia-keyring/deb-multimedia-keyring_2016.8.1_all.deb && \
    apt-get install -y ./deb-multimedia-keyring_2016.8.1_all.deb && \
    echo "deb http://www.deb-multimedia.org bookworm main non-free" >> /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y ffmpeg fonts-dejavu-core && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Optional: Verify the font is installed
RUN fc-list


# Copy MediaMTX binary from the original image
COPY --from=bluenviron/mediamtx:1.11.1 /mediamtx /mediamtx

# Copy the entrypoint script into the container
COPY ./docker/mediamtx-mock/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set the entrypoint to the custom script
ENTRYPOINT ["/entrypoint.sh"]

# Default command to start MediaMTX
CMD ["/mediamtx", "/mediamtx.yml"]
