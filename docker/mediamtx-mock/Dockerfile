# Local MediaMTX mock with FFmpeg 6.x from deb-multimedia
FROM debian:bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      wget \
      gnupg \
      dirmngr \
      lsb-release \
 && wget -qO /tmp/deb-multimedia-keyring.deb \
      https://www.deb-multimedia.org/pool/main/d/deb-multimedia-keyring/\
deb-multimedia-keyring_2024.9.1_all.deb \
 && dpkg -i /tmp/deb-multimedia-keyring.deb \
 && rm /tmp/deb-multimedia-keyring.deb \
 \
 # Create deb822 source for deb-multimedia
 && printf 'Types: deb\n\
URIs: https://www.deb-multimedia.org\n\
Suites: %s\n\
Components: main non-free\n\
Signed-By: /usr/share/keyrings/deb-multimedia-keyring.pgp\n\
Enabled: yes\n' "$(lsb_release -c -s)" \
    > /etc/apt/sources.list.d/dmo.sources \
 \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      ffmpeg \
      fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

# Verify font installation
RUN fc-list

# Copy MediaMTX binary & entrypoint
COPY --from=bluenviron/mediamtx:1.11.2 /mediamtx /mediamtx
COPY ./docker/mediamtx-mock/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/mediamtx", "/mediamtx.yml"]
