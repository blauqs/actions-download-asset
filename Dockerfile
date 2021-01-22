FROM alpine:latest

RUN	apk add \
  bash \
  ca-certificates \
  curl \
  jq

COPY entrypoint.sh /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
