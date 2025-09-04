# Use Node.js 22 Alpine as base image
FROM node:22-alpine AS BASE

# Environment variables #1
ENV CI=1
ENV BETTER_AUTH_TELEMETRY=0
ENV BETTER_AUTH_TELEMETRY_DEBUG=0

# Environment variables #2
ENV APP_ROOT="/app"
ENV GITHUB_REPO="${APP_ROOT}/repo"
ENV APP_BUILD="${GITHUB_REPO}/.output"
ENV APP_OUTPUT="${APP_ROOT}/.output"
ENV CURRENT_COMMIT_FILE="${APP_ROOT}/.current_commit"
ENV LAST_COMMIT_FILE="${APP_ROOT}/.last_commit"
ENV BUILD_COMPLETE_FLAG="${APP_ROOT}/.build-complete.flag"

# Install git, wget, supervisor, and rsync
RUN apk add --no-cache git wget supervisor rsync

# Set working directory
WORKDIR ${APP_ROOT}

# Copy all scripts
COPY bin/ /usr/local/bin/

# Make all scripts executable
RUN chmod +x /usr/local/bin/*

# Install pnpm
RUN npm install -g pnpm nodemon
# > Use PNPM STORAGE CACHE: /root/.pnpm-store

# Create log directory
RUN mkdir -p /var/log/supervisor

# Expose port 3000
EXPOSE 3000

# Start supervisord
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
