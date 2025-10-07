FROM bluenviron/mediamtx:1.11.2-ffmpeg

# add dejavu font
RUN apk add --no-cache \
    font-dejavu=2.37-r5

# add entrypoint script
COPY ./docker/mediamtx-mock/entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

CMD ["/mediamtx", "/mediamtx.yml"]
