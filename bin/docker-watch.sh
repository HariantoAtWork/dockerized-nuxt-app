#!/bin/sh

echo "=== WATCH PHASE STARTED ==="

# Wait for initial build to complete
echo "Waiting for initial build to complete..."
while [ ! -f "${BUILD_COMPLETE_FLAG}" ]; do
    sleep 5
done

echo "Starting update watcher..."

# Function to restart the app process
restart_app() {
    echo "Restarting application..."
    supervisorctl restart app
}

# Main watch loop
while true; do
    echo "Checking for updates..."
    
    # Check if repository exists
    if [ -d "${GITHUB_REPO}" ] && [ -d "${GITHUB_REPO}/.git" ]; then
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
            echo "New commits found! Triggering rebuild..."
            
            echo "Resetting existing build..."
            git reset --hard HEAD

            # Pull latest changes
            git pull origin main
            
            # Check for merge conflicts
            if git status --porcelain | grep -q "^UU\|^AA\|^DD"; then
                echo "Warning: Merge conflicts detected. Skipping update."
            else
                echo "Repository updated successfully. Rebuilding..."
                
                # Stop the app
                supervisorctl stop app
                
                # Trigger rebuild
                supervisorctl start build
                
                # Wait for build to complete
                while [ ! -f "${BUILD_COMPLETE_FLAG}" ]; do
                    sleep 2
                done
                
                # Start the app
                supervisorctl start app
                
                echo "Application restarted with latest changes!"
            fi
        else
            echo "No updates available."
        fi
    else
        echo "Repository not found. Skipping update check."
    fi
    
    # Wait 5 minutes before next check
    echo "Waiting 5 minutes before next check..."
    sleep 300
done
