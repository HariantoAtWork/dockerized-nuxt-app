#!/bin/sh

set -e

echo "=== BUILD PHASE STARTED ==="

# Check if GITHUB_REPO_URL is provided
if [ -z "$GITHUB_REPO_URL" ]; then
    echo "Error: GITHUB_REPO_URL environment variable is required"
    echo "Format: https://TOKEN@github.com/username/repository.git"
    exit 1
fi

echo "Repository URL: ${GITHUB_REPO_URL}"

# Check if we need to build
BUILD_NEEDED=false

# Check if repository exists
if [ -d "${GITHUB_REPO}" ] && [ -d "${GITHUB_REPO}/.git" ]; then
    echo "Repository exists. Checking for updates..."
    cd ${GITHUB_REPO}
    
    # Get current commit hash
    CURRENT_COMMIT=$(git rev-parse HEAD)
    echo "Current commit: $CURRENT_COMMIT"
    echo "$CURRENT_COMMIT" > ${CURRENT_COMMIT_FILE}
    
    # Fetch latest changes
    git fetch origin
    
    # Get latest commit hash
    LATEST_COMMIT=$(git rev-parse origin/main)
    echo "Latest commit: $LATEST_COMMIT"
    echo "$LATEST_COMMIT" > ${LAST_COMMIT_FILE}

    # Check if there are new commits
    if [ "$CURRENT_COMMIT" != "$LATEST_COMMIT" ]; then

        echo "Resetting existing build..."
        git reset --hard HEAD

        echo "New commits found. Updating repository..."
        git pull origin main
        
        # Check for merge conflicts
        if git status --porcelain | grep -q "^UU\|^AA\|^DD"; then
            echo "Warning: Merge conflicts detected. Using current version."
        else
            echo "Repository updated successfully."
            BUILD_NEEDED=true
        fi
    else
        echo "Repository is up to date."
        
        # Check if build exists
        if [ ! -d "${APP_BUILD}" ] || [ ! -f "${APP_BUILD}/server/index.mjs" ]; then
            echo "Build directory missing or incomplete. Rebuild needed."
            BUILD_NEEDED=true
        else
            echo "Build exists and is up to date."
        fi
    fi
else
    echo "Repository not found. Cloning for the first time..."
    
    # Clone the repository
    git clone --depth 1 "$GITHUB_REPO_URL" ${GITHUB_REPO}
    cd ${GITHUB_REPO}
    BUILD_NEEDED=true
fi

# Build if needed
if [ "$BUILD_NEEDED" = true ]; then
    echo "Building application..."

    # Remove build complete flag if it exists
    [ -f "${BUILD_COMPLETE_FLAG}" ] && rm "${BUILD_COMPLETE_FLAG}"
    
    # Install bun if not already installed
    if ! command -v bun >/dev/null 2>&1; then
        echo "Installing bun..."
        npm install -g bun
    fi
    
    # Install dependencies
    echo "Installing dependencies..."
    rm -rf node_modules
    bun install
    # bun install --frozen-lockfile
    
    # Build the application
    echo "Building Nuxt application..."
    bun run build

    # Copy build to persistent location
    echo "Saving build to persistent storage...${APP_ROOT}"
    # Use rsync to avoid "Resource busy" errors with volume mounts
    rsync -av --progress --delete ${APP_BUILD} ${APP_ROOT}

    # Run build script
    echo "Running build script..."
    if [ -f "${PROJECT_BUILD_SCRIPT}" ]; then
        chmod +x ${PROJECT_BUILD_SCRIPT}
        ${PROJECT_BUILD_SCRIPT}
    else
        echo "Project build script not found. Skipping..."
    fi

    # Copy data to persistent storage
    echo "Copying data to persistent storage..."
    if [ ! -d "${APP_ROOT}/.data" ]; then
        mkdir -p ${APP_ROOT}/.data
    fi

    if [ -d "${GITHUB_REPO}/.data" ]; then
        rsync -av --ignore-existing --progress ${GITHUB_REPO}/.data ${APP_ROOT}/.data
    else
        echo "\`${GITHUB_REPO}/.data\` directory not found. Skipping..."
    fi
    
    
    
    echo "Build completed successfully!"
else
    echo "No build needed. Using existing build."
fi

# # Create necessary directories
# mkdir -p ${APP_ROOT}/.data

echo "=== BUILD PHASE COMPLETED ==="

# Signal that build is complete and app can start
touch ${BUILD_COMPLETE_FLAG}
