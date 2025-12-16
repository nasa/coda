FROM bluenviron/mediamtx:1.15.4-ffmpeg

# add dejavu font
RUN apk add --no-cache \
    font-dejavu=2.37-r6

# add entrypoint script
COPY ./docker/mediamtx-mock/entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

CMD ["/mediamtx", "/mediamtx.yml"]
