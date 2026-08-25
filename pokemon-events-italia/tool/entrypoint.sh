#!/bin/sh
# Replaces xvfb-run, which hung silently under Apify's restricted container
# permissions with zero output (never even reached the Python process) -
# starting Xvfb explicitly gives visibility into each step instead of one
# opaque wrapper.
set -e

echo "entrypoint: starting Xvfb on :99"
Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp &
XVFB_PID=$!

echo "entrypoint: waiting for X socket"
for i in $(seq 1 20); do
    if [ -e /tmp/.X11-unix/X99 ]; then
        echo "entrypoint: X socket ready after ${i}00ms"
        break
    fi
    sleep 0.1
done

export DISPLAY=:99
echo "entrypoint: DISPLAY=$DISPLAY, launching: $*"
exec "$@"
