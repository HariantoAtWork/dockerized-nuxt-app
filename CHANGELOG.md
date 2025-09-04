# Changelog

All notable changes to this project will be documented in this file.

## [2025-09-04T21:58:58+0200]

### Added
- Added force pull functionality to handle `git push -f` scenarios in `docker-build.sh`
- Created `force_pull()` function that uses `git fetch origin` and `git reset --hard origin/main`

### Changed
- Updated git pull logic to use force pull when new commits are detected
- Replaced `git pull origin main` with `force_pull()` function for better force push handling

### Technical Details
- Added `force_pull()` function: `git fetch origin && git reset --hard origin/main && git clean -fd`
- This handles scenarios where remote repository has been force pushed (`git push -f`)
- Ensures local repository is always in sync with remote, even after history rewrites

## [2025-09-04T19:52:27+0200]

### Fixed
- Fixed supervisord socket configuration by adding missing `[unix_http_server]` and `[supervisorctl]` sections
- Improved supervisord readiness check in `docker-watch.sh` to use `supervisorctl status` instead of socket file check
- Resolved infinite wait issue for supervisord socket

### Changed
- Added explicit socket configuration in `supervisord.conf`: `file=/run/supervisord.sock`
- Updated watch script to check supervisord readiness with `supervisorctl status` command
- Reverted to nodemon in `docker-run.sh` as per user preference

### Technical Details
- Added `[unix_http_server]` section with `file=/run/supervisord.sock` and `chmod=0700`
- Added `[supervisorctl]` section with `serverurl=unix:///run/supervisord.sock`
- Changed socket wait from file check to functional check: `while ! supervisorctl status >/dev/null 2>&1; do sleep 1; done`

## [2025-09-04T19:22:21+0200]

### Fixed
- Fixed supervisorctl socket issue in `docker-watch.sh` by adding socket wait before using supervisorctl commands
- Updated `docker-run.sh` to use Bun instead of nodemon for better performance and built-in watch functionality

### Changed
- Replaced `nodemon --watch ${APP_OUTPUT} --cwd ${APP_ROOT} .output/server/index.mjs` with `bun --watch ${APP_OUTPUT} --exec "bun ${APP_OUTPUT}/server/index.mjs"`
- Added socket availability check in watch script to prevent "no such file" errors

### Technical Details
- Added `while [ ! -S /run/supervisord.sock ]; do sleep 1; done` to wait for supervisord socket
- Updated server startup to use Bun's built-in watch mode instead of external nodemon
- Maintained backward compatibility with commented alternatives
