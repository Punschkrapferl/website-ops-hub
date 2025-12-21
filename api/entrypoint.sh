#!/bin/sh
set -eu

# Ensure the mounted volume path exists and is writable for the app user.
mkdir -p /data
chown -R app:app /data

# Drop privileges and start the server.
exec su-exec app node dist/index.js
