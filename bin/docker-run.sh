#!/bin/sh

echo "=== RUN PHASE STARTED ==="

# Wait for build to complete
echo "Waiting for build to complete..."
while [ ! -f "${APP_ROOT}/.build-complete.flag" ]; do
    sleep 2
done

echo "Build complete. Starting application..."

echo "Waiting for generated output folder to be created..."
while [ ! -d "${APP_OUTPUT}" ]; do
    sleep 2
done

# Change to repository directory (where dependencies are properly installed)
cd ${APP_ROOT}

# Start the Node.js server from the .output directory
echo "Starting NODEMON for Node.js server..."
exec nodemon --watch ${APP_OUTPUT} --cwd ${APP_ROOT} .output/server/index.mjs
# exec bun --watch /app/.output --exec "bun /app/.output/server/index.mjs"
# exec node ${APP_ROOT}/.output/server/index.mjs
