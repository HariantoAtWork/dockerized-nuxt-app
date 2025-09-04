#!/bin/sh

echo "=== RUN PHASE STARTED ==="

# Wait for build to complete
echo "Waiting for build to complete..."
while [ ! -f "${APP_ROOT}/.build-complete.flag" ]; do
    sleep 2
done

echo "Build complete. Starting application..."

# Change to repository directory (where dependencies are properly installed)
cd ${APP_ROOT}

# Start the Node.js server from the .output directory
echo "Starting NODEMON for Node.js server..."
exec nodemon --cwd ${APP_ROOT} --watch ${APP_OUTPUT} .output/server/index.mjs
