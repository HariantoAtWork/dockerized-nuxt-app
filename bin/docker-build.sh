#!/bin/sh

set -e

echo "[BUILD] === BUILD PHASE STARTED ==="

# Check if GITHUB_REPO_URL is provided
if [ -z "$GITHUB_REPO_URL" ]; then
    echo "[BUILD] Error: GITHUB_REPO_URL environment variable is required"
    echo "[BUILD] Format: https://TOKEN@github.com/username/repository.git"
    exit 1
fi

echo "[BUILD] Repository URL: ${GITHUB_REPO_URL}"

# Function to force pull from remote (handles force pushes)
force_pull() {
    echo "[BUILD] Force pulling from remote..."
    git fetch origin
    git reset --hard origin/main
    git clean -fd # Remove untracked files
}

# Check if we need to build
BUILD_NEEDED=false

# Check if repository exists
if [ -d "${GITHUB_REPO}" ] && [ -d "${GITHUB_REPO}/.git" ]; then
    echo "[BUILD] Repository exists. Checking for updates..."
    cd ${GITHUB_REPO}

    # Get current commit hash
    CURRENT_COMMIT=$(git rev-parse HEAD)
    echo "[BUILD] Current commit: $CURRENT_COMMIT"
    echo "[BUILD] $CURRENT_COMMIT" >${CURRENT_COMMIT_FILE}

    # Fetch latest changes
    git fetch origin

    # Get latest commit hash
    LATEST_COMMIT=$(git rev-parse origin/main)
    echo "[BUILD] Latest commit: $LATEST_COMMIT"
    echo "[BUILD] $LATEST_COMMIT" >${LAST_COMMIT_FILE}

    # Check if there are new commits
    if [ "$CURRENT_COMMIT" != "$LATEST_COMMIT" ]; then

        echo "[BUILD] Resetting existing build..."
        git reset --hard HEAD

        echo "[BUILD] New commits found. Force updating repository..."
        # Handle force pushes by resetting to remote
        force_pull

        # Check if the update was successful
        if git status --porcelain | grep -q "^UU\|^AA\|^DD"; then
            echo "[BUILD] Warning: Merge conflicts detected. Using current version."
        else
            echo "[BUILD] Repository updated successfully."
            BUILD_NEEDED=true
        fi
    else
        echo "[BUILD] Repository is up to date."

        # Check if build exists
        if [ ! -d "${APP_BUILD}" ] || [ ! -f "${APP_BUILD}/server/index.mjs" ]; then
            echo "[BUILD] Build directory missing or incomplete. Rebuild needed."
            BUILD_NEEDED=true
        else
            echo "[BUILD] Build exists and is up to date."
        fi
    fi
else
    echo "[BUILD] Repository not found. Cloning for the first time..."

    # Clone the repository
    git clone --depth 1 "$GITHUB_REPO_URL" ${GITHUB_REPO}
    cd ${GITHUB_REPO}
    BUILD_NEEDED=true
fi

# Build if needed
if [ "$BUILD_NEEDED" = true ]; then
    echo "[BUILD] Building application..."

    # Remove build complete flag if it exists
    [ -f "${BUILD_COMPLETE_FLAG}" ] && rm "${BUILD_COMPLETE_FLAG}"

    # Install bun if not already installed
    if ! command -v bun >/dev/null 2>&1; then
        echo "[BUILD] Installing bun..."
        npm install -g bun
    fi

    # Install dependencies
    echo "[BUILD] Installing dependencies..."
    rm -rf node_modules
    bun ci
    # bun install --frozen-lockfile

    # Build the application
    echo "[BUILD] Building Nuxt application..."
    bun run build

    # Copy build to persistent location
    echo "[BUILD] Saving build to persistent storage...${APP_ROOT}"
    # Use rsync to avoid "Resource busy" errors with volume mounts
    # rsync -av --delete ${APP_BUILD} ${APP_ROOT}

    # Run build script
    echo "[BUILD] Running build script..."
    if [ -f "${PROJECT_BUILD_SCRIPT}" ]; then
        chmod +x ${PROJECT_BUILD_SCRIPT}
        ${PROJECT_BUILD_SCRIPT}
    else
        echo "[BUILD] Project build script not found. Skipping..."
    fi

    # Copy data to persistent storage
    echo "[BUILD] Copying data to persistent storage..."
    # if [ ! -d "${APP_ROOT}/.data" ]; then
    #     mkdir -p ${APP_ROOT}/.data
    # fi

    echo "[BUILD] Build completed successfully!"
else
    echo "[BUILD] No build needed. Using existing build."
fi

# if [ -d "${GITHUB_REPO}/.data" ]; then
#     rsync -av --ignore-existing ${GITHUB_REPO}/.data/. ${APP_ROOT}/.data
# else
#     echo "[BUILD] \`${GITHUB_REPO}/.data\` directory not found. Skipping..."
# fi

# # Create necessary directories
# mkdir -p ${APP_ROOT}/.data

echo "[BUILD] === BUILD PHASE COMPLETED ==="

# Signal that build is complete and app can start
touch ${BUILD_COMPLETE_FLAG}
