# Nuxt.js Docker Application

A containerised Nuxt.js application with automated Git-based deployment, continuous monitoring, and intelligent build management using Docker Compose and a **Bun/TypeScript orchestrator** (no Supervisor).

## 🚀 Features

- **Automated Git Deployment**: Automatically clones and updates from GitHub repositories
- **Smart Build Management**: Only rebuilds when new commits are detected (or when output is missing)
- **Continuous Monitoring**: Watches for repository changes and triggers automatic rebuilds
- **Process Management**: Single orchestrator manages Git sync, install/build, nodemon runtime, and polling
- **Persistent Storage**: Maintains application data and build cache across container restarts
- **Health Checks**: Built-in health monitoring for the application
- **Development & Production**: Separate configurations for development and production environments

## 📋 Prerequisites

- Docker and Docker Compose
- Git access to your Nuxt.js repository
- GitHub Personal Access Token (for private repositories)

## 🛠️ Quick Start

### 1. Environment Setup

Create a `.env` file for Docker environment variables:

```bash
# Docker environment variables
GITHUB_REPO_URL=https://YOUR_TOKEN@github.com/username/repository.git
DOCKER_HUB_IMAGE=your-registry/nuxt-app:latest

# Logging Configuration
VERBOSE_LOGGING=true  # Set to false to disable verbose logging (only show errors)
```

Create a `.env.app` file for application-specific environment variables:

```bash
# Application environment variables
NODE_ENV=production
# Add your Nuxt.js app-specific variables here
# e.g., API_URL, DATABASE_URL, etc.
```

### 2. Create Required Volumes

```bash
# Create external volumes for caching
docker volume create bun-cache
docker volume create pnpm-store
```

### 3. Start the Application

```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.production.yml up -d
```

The application will be available at `http://localhost:3300`

## 🏗️ Architecture

### Container Structure

The image bundles:

- **Base Image**: Node.js 22 Alpine
- **Orchestrator**: Bun + TypeScript (`/opt/orchestrator`) — Git sync, build, admin HTTP API
- **Package managers**: Bun for the cloned app (`bun install`, `bun run ci` / `bun run build`)
- **Runtime**: nodemon watching `.output` and running `.output/server/index.mjs`

### Process flow

1. **Git sync** — clone or fetch `origin/<GIT_BRANCH>` (default `main`), recover broken `.git`, force-reset when the remote moves.
2. **Build** — `bun install`, then `bun run ci` if `scripts.ci` exists; otherwise `bun run build` if `scripts.build` exists (your app must define at least one).
3. **Serve** — wait for `/app/.build-complete.flag` and `.output/server/index.mjs`, then start nodemon from `/app`.
4. **Watch** — poll Git on `WATCH_INTERVAL_MS` (default 60s); on new commits, rebuild and restart nodemon.

### Directory layout

```
/opt/orchestrator/       # Orchestrator package (image layer)
/app/                    # Mounted volume: cloned repo + Nuxt build output
├── .output/             # Built application output
├── .current_commit      # Current commit hash (record)
├── .last_commit         # Remote tip record
├── .build-complete.flag # Orchestrator signals “safe to run server”
├── package.json         # Cloned application
└── …
```

## 🔧 Configuration

### Environment Variables

#### Docker Environment (`.env`)
| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_REPO_URL` | GitHub repository URL with token | Yes |
| `DOCKER_HUB_IMAGE` | Docker image for production | Production only |
| `VERBOSE_LOGGING` | Enable verbose logging (true/false) | No (default: true) |
| `GIT_BRANCH` | Remote branch name (`origin/<branch>`) | No (default: `main`) |
| `ADMIN_BIND` | Orchestrator admin HTTP bind address | No (default: `0.0.0.0`) |
| `ADMIN_PORT` | Orchestrator admin HTTP port | No (default: `9090`) |
| `ADMIN_TOKEN` | If set, required for `POST /api/rebuild` and `POST /api/restart-app` | No |
| `WATCH_INTERVAL_MS` | Git poll interval for updates | No (default: `60000`) |

#### Application Environment (`.env.app`)
| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Node.js environment | Yes |
| `API_URL` | API endpoint URL | Optional |
| `DATABASE_URL` | Database connection string | Optional |
| `SECRET_KEY` | Application secret key | Optional |

### Volume Mounts

- `./data/app:/app` - Application data persistence
- `./data/data:/data` - Additional data storage
- `bun-cache:/root/.bun/install/cache` - Bun cache (primary)
- `pnpm-store:/root/.local/share/pnpm` - pnpm cache (alternative)

### Port Configuration

- **Nuxt (HTTP)**: container `3000` → host `3300`
- **Orchestrator admin**: container `9090` → host `127.0.0.1:9091` (see `docker-compose.yml`; bind orchestrator with `ADMIN_BIND`/`ADMIN_PORT`)

Open **http://127.0.0.1:9091/** on the host for the dashboard (when compose publishes `9091:9090`). Set `ADMIN_TOKEN` and send `Authorization: Bearer <token>` (or `?token=` on the dashboard URL) for rebuild/restart actions.

## 📝 Orchestrator source

Implementation lives in [`src/`](src/) (TypeScript, run with Bun). Entry: [`src/index.ts`](src/index.ts).

## 🚀 Deployment

### Development Deployment

```bash
# Start development environment
docker-compose up -d

# View logs
docker-compose logs -f

# Stop environment
docker-compose down
```

### Production Deployment

```bash
# Build and push image
docker build -t your-registry/nuxt-app:latest .
docker push your-registry/nuxt-app:latest

# Deploy using production compose
docker-compose -f docker-compose.production.yml up -d
```

### Health Monitoring

The application includes built-in health checks:

```bash
# Check container health
docker-compose ps

# View health check logs
docker inspect nuxt-app_nuxt-app_1 | grep -A 10 Health
```

## 🔍 Monitoring & Logs

### Container logs

```bash
docker compose logs -f nuxt-app
```

The orchestrator prints prefixed lines to stdout; nodemon output appears there while the app runs.

### Admin API

```bash
curl -s http://127.0.0.1:9091/api/status
curl -s http://127.0.0.1:9091/api/logs?n=80
# With ADMIN_TOKEN set:
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" http://127.0.0.1:9091/api/rebuild
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" http://127.0.0.1:9091/api/restart-app
```

## 🛠️ Troubleshooting

### Common Issues

1. **Repository Access Issues**
   ```bash
   # Ensure GITHUB_REPO_URL includes token in .env file
   GITHUB_REPO_URL=https://YOUR_TOKEN@github.com/username/repo.git
   ```

2. **Build Failures**
   ```bash
   docker compose logs -f nuxt-app
   ```
   Ensure `package.json` defines `scripts.ci` and/or `scripts.build`.

3. **Application Not Starting**
   ```bash
   docker compose exec nuxt-app ls -la /app/.build-complete.flag
   docker compose exec nuxt-app ls -la /app/.output/server/index.mjs
   ```

4. **Watcher / rebuild loop**
   ```bash
   curl -s http://127.0.0.1:9091/api/status
   ```
   Confirm `GIT_BRANCH` matches your default branch.

### Manual Operations

```bash
# Force rebuild via orchestrator (requires ADMIN_TOKEN if configured)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" http://127.0.0.1:9091/api/rebuild

# Shell inside container
docker compose exec nuxt-app sh
cd /app && git status
```

## 📚 Development

### Adding New Features

1. Update your Nuxt.js application in the repository
2. Commit and push changes
3. The watcher will automatically detect changes and rebuild
4. Monitor logs to ensure successful deployment

### Build expectations

The cloned app must expose **`scripts.ci` and/or `scripts.build`** in `package.json`. The orchestrator runs `bun install` before either script.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Check the troubleshooting section above
- Review the logs for error messages
- Ensure all prerequisites are met
- Verify environment variables are correctly set

---

**Last Updated**: 2026-05-03T01:42:02+0200
