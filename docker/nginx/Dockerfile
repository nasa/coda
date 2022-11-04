# This build doesn't actually need the "AS base" except that it simplifies our .gitlab-ci.yml by
# allowing us to specify `--target base`
FROM nginx:1.23.0-alpine AS base

# Add custom entrypoint
COPY docker/nginx/docker-entrypoint.sh /
RUN dos2unix /docker-entrypoint.sh

# redundant with base nginx image? Keep anyway in case that image changes?
ENTRYPOINT [ "/docker-entrypoint.sh" ]

# Ensure images directory exists.
# Remove unneeded entrypoint files.
RUN mkdir -p /usr/share/nginx/static && \
    rm -rf /docker-entrypoint.d && \
    chmod +x /docker-entrypoint.sh

# Nginx config files
COPY /docker/nginx/nginx.conf /etc/nginx/nginx.conf

# This image is intended to be run with docker-compose. See docker-compose*.yml files for necessary
# environment variables
CMD ["nginx", "-g", "daemon off;"]
