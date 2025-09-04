# Changelog

All notable changes to this project will be documented in this file.

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
