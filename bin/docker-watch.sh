#!/bin/sh

echo "=== WATCH PHASE STARTED ==="

# Wait for supervisord to be ready by checking if supervisorctl works
echo "Waiting for supervisord to be ready..."
while ! supervisorctl status >/dev/null 2>&1; do
    sleep 1
done

echo "Supervisord is ready. Proceeding with watch phase..."

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

# Function to force pull from remote (handles force pushes)
force_pull() {
    echo "Force pulling from remote..."
    git fetch origin
    git reset --hard origin/main
    git clean -fd  # Remove untracked files
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
            # git reset --hard HEAD

            # Pull latest changes
            # git pull origin main
           
           # -----
echo "Repository updated successfully. Rebuilding..."
                rm -rf ${BUILD_COMPLETE_FLAG}
                
                # Stop the app
                # supervisorctl stop app
                
                # Trigger rebuild
                supervisorctl restart build
                
                # Wait for build to complete
                echo "Waiting for build to complete..."
                while [ ! -f "${BUILD_COMPLETE_FLAG}" ]; do
                    sleep 2
                done
                
                # Start the app
                # supervisorctl start app
                
                echo "--- Application restarted with latest changes!"

           #-----
            
            # Check for merge conflicts
            # if git status --porcelain | grep -q "^UU\|^AA\|^DD"; then
            #     echo "Warning: Merge conflicts detected. Skipping update."
            # else
            #     echo "Repository updated successfully. Rebuilding..."
            #     rm -rf ${BUILD_COMPLETE_FLAG}
                
            #     # Stop the app
            #     # supervisorctl stop app
                
            #     # Trigger rebuild
            #     supervisorctl restart build
                
            #     # Wait for build to complete
            #     echo "Waiting for build to complete..."
            #     while [ ! -f "${BUILD_COMPLETE_FLAG}" ]; do
            #         sleep 2
            #     done
                
            #     # Start the app
            #     # supervisorctl start app
                
            #     echo "--- Application restarted with latest changes!"
            # fi
        else
            echo "No updates available."
        fi
    else
        echo "Repository not found. Skipping update check."
    fi
    
    # Wait 5 minutes before next check
    echo "Waiting 1 minute before next check..."
    sleep 60
done
