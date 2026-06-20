# Multi-Container Fibonacci App

A full-stack Fibonacci calculator built with React, Express, Redis, PostgreSQL, and a background worker. The project supports **local development with Docker Compose** and **production-style deployment with Kubernetes (minikube)**.

## Architecture

```
Browser
   │
   ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │     │   API    │────▶│ Postgres │
│ (React)  │     │ (Express)│     └──────────┘
└──────────┘     └────┬─────┘
                      │
                 ┌────▼─────┐     ┌──────────┐
                 │  Redis   │◀────│  Worker  │
                 └──────────┘     └──────────┘
```

**Request flow:**

1. User submits a Fibonacci index in the React UI.
2. The API stores the index in Postgres and publishes a message to Redis.
3. The worker listens on Redis, computes the Fibonacci number, and stores the result in Redis.
4. The API reads calculated values from Redis and returns them to the client.

---

## Prerequisites

| Tool | Purpose |
|------|---------|
| [Docker](https://www.docker.com/) | Run containers locally |
| [Docker Compose](https://docs.docker.com/compose/) | Multi-container dev environment |
| [kubectl](https://kubernetes.io/docs/tasks/tools/) | Kubernetes CLI |
| [minikube](https://minikube.sigs.k8s.io/docs/start/) | Local Kubernetes cluster (optional) |
| [Make](https://www.gnu.org/software/make/) | Shortcut commands for Kubernetes |

---

## Project Structure

```
complex/
├── client/          # React frontend
├── server/          # Express API
├── nestjs-server/   # NestJS API (reads all Postgres values)
├── worker/          # Redis worker (Fibonacci calculator)
├── nginx/           # Reverse proxy (Docker Compose only)
├── k8s/             # Kubernetes manifests
├── docker-compose.yml
├── docker-compose.prod.yml   # Production stack for AWS (single EC2)
├── AWS-DEPLOY.md             # AWS install — Docker Compose on EC2
├── AWS-K3S-DEPLOY.md         # AWS install — single-node k3s on EC2
├── Makefile         # Kubernetes helper commands
└── README.md
```

---

## Option 3: AWS (Minimum Cost)

Deploy the full stack on a **single EC2 instance** (~$0–15/month) using production Docker Compose.

See **[AWS-DEPLOY.md](./AWS-DEPLOY.md)** for step-by-step instructions.

Quick start on EC2:

```bash
export PGPASSWORD='your-strong-password'
docker compose -f docker-compose.prod.yml up -d --build
```

App runs on **http://YOUR_EC2_PUBLIC_IP** (port 80).

---

## Option 4: AWS — k3s on EC2 (Kubernetes)

Run the same `k8s/` manifests on a **single EC2 instance** with k3s (~$17–20/month). Uses Docker Hub images and nginx ingress.

See **[AWS-K3S-DEPLOY.md](./AWS-K3S-DEPLOY.md)** for the full step-by-step guide.

Quick overview:

```bash
# Mac — push amd64 images (required for t3 EC2)
make publish-amd64

# EC2 — install k3s, ingress, deploy
make create-secret PGPASSWORD='your-strong-password'
make deploy && make wait
```

App runs on **http://YOUR_EC2_PUBLIC_IP** (port 80).

---

## Option 1: Docker Compose (Local Development)

Best for active development with hot reload.

### Start the app

```bash
docker compose up --build
```

### Open the app

**http://localhost:3050**

> Do **not** use the internal Docker IP shown in client logs (e.g. `http://172.20.0.x`). That address is only reachable inside the Docker network.

### Stop the app

```bash
docker compose down
```

### Reset everything (including volumes)

```bash
docker compose down -v
docker compose up --build
```

### Docker Compose services

| Service | Description | Exposed port |
|---------|-------------|--------------|
| `nginx` | Reverse proxy | **3050** → 80 |
| `client` | React dev server | internal only |
| `api` | Express API | internal only |
| `worker` | Fibonacci worker | internal only |
| `nest-api` | NestJS API (Postgres read) | internal only |
| `postgres` | Database | internal only |
| `redis` | Cache / pub-sub | internal only |

### Nginx routing (dev)

| Path | Destination |
|------|-------------|
| `/` | React client (`client:3000`) |
| `/sockjs-node` | WebSocket proxy for hot reload |
| `/api/*` | Express API (`api:5000`) |
| `/api/nest/*` | NestJS API (`nest-api:3001`) |

### NestJS API

A separate **NestJS** server reads all rows from the Postgres `values` table.

| Endpoint | Description |
|----------|-------------|
| `GET /api/nest/values` | All indexes stored in Postgres |
| `GET /api/nest/` | Health check |

In the React app, open **NestJS Data** from the nav to view this data.

### Common Docker Compose issues

**`ERR_OSSL_EVP_UNSUPPORTED` (client crash)**  
Old `react-scripts` does not work on Node 17+. Dev Dockerfiles use `node:16-alpine`.

**`Cannot find module 'node:zlib'` (API crash)**  
Caused by Node 14 with a newer `body-parser`. Server uses Node 16 and a pinned `body-parser` version.

**Page loads forever**  
Usually the API crashed. Check logs:

```bash
docker compose logs api
docker compose logs client
```

**Client routing not working**  
Always use **http://localhost:3050**, not the container IP.

---

## Option 2: Kubernetes (minikube)

Best for learning Kubernetes deployment patterns.

### Quick start (first time)

```bash
make setup
```

This will:

1. Start minikube
2. Enable the ingress addon
3. Create the Postgres secret
4. Deploy all manifests
5. Wait for pods to be ready
6. Start an ingress tunnel and open the browser

### Open the app

**http://localhost:8080**

> On minikube with the Docker driver (Mac), the minikube IP (`192.168.49.x`) is **not** reachable from your browser. You must use the port-forward tunnel (`make tunnel` or `make open`).

### Step-by-step (manual)

```bash
# 1. Start the cluster
make start-minikube

# 2. Install ingress controller (once per cluster)
make install-ingress

# 3. Deploy all resources
make deploy

# 4. Wait for pods
make wait

# 5. Start tunnel (keep this terminal open)
make tunnel

# 6. Open browser (in another terminal)
make open
```

---

## Makefile Reference

Run `make help` to see all targets.

### Setup & deploy

| Command | Description |
|---------|-------------|
| `make help` | List all available commands |
| `make setup` | Full first-time setup (minikube + ingress + deploy + open) |
| `make start-minikube` | Start the minikube cluster |
| `make install-ingress` | Install nginx ingress (minikube addon or cloud manifest) |
| `make deploy` | Create secret and apply all `k8s/` manifests |
| `make create-secret` | Create/update the `pgpassword` Kubernetes secret |
| `make wait` | Wait until all pods are ready |
| `make status` | Show pods, services, deployments, PVCs, and ingress |

### Access the app

| Command | Description |
|---------|-------------|
| `make tunnel` | Port-forward ingress to **http://localhost:8080** (foreground) |
| `make tunnel-bg` | Start port-forward in the background |
| `make open` | Start tunnel and open **http://localhost:8080** in the browser |
| `make port-forward` | Forward client (`:3000`) and API (`:5000`) directly, bypassing ingress |

### Logs

| Command | Description |
|---------|-------------|
| `make logs-server` | Tail API server logs |
| `make logs-client` | Tail client logs |
| `make logs-worker` | Tail worker logs |
| `make logs-postgres` | Tail Postgres logs |

### Cleanup

| Command | Description |
|---------|-------------|
| `make delete` | Remove all Kubernetes resources from `k8s/` |
| `make delete-secret` | Remove the Postgres password secret |
| `make delete-all` | Remove resources and secret |

### Build & custom images

| Command | Description |
|---------|-------------|
| `make build` | Build production Docker images locally |
| `make minikube-build` | Build images inside minikube's Docker daemon |
| `make set-local-images` | Point deployments at your locally built images |
| `make rollout` | Restart all deployments to pick up new images |

### Troubleshooting

| Command | Description |
|---------|-------------|
| `make fix-postgres` | Reset Postgres PVC and redeploy (fixes CrashLoopBackOff) |

### Variables

Override defaults when running make:

```bash
make deploy PGPASSWORD=mysecret
make build DOCKER_USER=myuser IMAGE_TAG=v1
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PGPASSWORD` | `postgres_password` | Postgres password (secret + env) |
| `DOCKER_USER` | `cygnetops` | Docker image namespace for local builds |
| `IMAGE_TAG` | `local` | Tag for locally built images |
| `NAMESPACE` | _(empty)_ | Kubernetes namespace (default namespace if empty) |

---

## Kubernetes Manifests (`k8s/`)

| File | Kind | Description |
|------|------|-------------|
| `database-persistent-volume-claim.yaml` | PVC | 2Gi persistent storage for Postgres |
| `postgres-deployment.yaml` | Deployment | Postgres database (`postgres:14`) |
| `postgres-cluster-ip-service.yaml` | Service | Internal DNS: `postgres-cluster-ip-service:5432` |
| `redis-deployment.yaml` | Deployment | Redis cache / pub-sub |
| `redis-cluster-ip-service.yaml` | Service | Internal DNS: `redis-cluster-ip-service:6379` |
| `server-deployment.yaml` | Deployment | Express API (3 replicas) |
| `server-cluster-ip-service.yaml` | Service | Internal DNS: `server-cluster-ip-service:5000` |
| `worker-deployment.yaml` | Deployment | Fibonacci worker |
| `client-deployment.yaml` | Deployment | React frontend (3 replicas) |
| `client-cluster-ip-service.yaml` | Service | Internal DNS: `client-cluster-ip-service:3000` |
| `ingress.yaml` | Ingress | Routes `/` → client, `/api/nest/*` → nestjs, `/api/*` → server |
| `nestjs-deployment.yaml` | Deployment | NestJS API (reads Postgres) |
| `nestjs-cluster-ip-service.yaml` | Service | Internal DNS: `nestjs-cluster-ip-service:3001` |

### Pre-built images (default)

| Component | Image |
|-----------|-------|
| Client | `stephengrider/multi-client` |
| Server | `cygnetops/multi-server-pgfix-5-11` |
| Worker | `stephengrider/multi-worker` |
| NestJS | `cygnetops/multi-nest-api` (build locally with `make build`) |
| Postgres | `postgres:14` |
| Redis | `redis` |

### Required secret

Postgres and the server need a Kubernetes secret that is **not** stored in git:

```bash
kubectl create secret generic pgpassword \
  --from-literal=PGPASSWORD=postgres_password
```

`make deploy` and `make create-secret` handle this automatically.

### Ingress routing

| Path | Backend |
|------|---------|
| `/` | `client-cluster-ip-service:3000` |
| `/api/*` | `server-cluster-ip-service:5000` (prefix stripped) |
| `/api/nest/*` | `nestjs-cluster-ip-service:3001` (prefix stripped) |

---

## Building Your Own Images

To deploy your local code instead of pre-built Docker Hub images:

```bash
# Build inside minikube's Docker daemon
make minikube-build

# Point deployments at local images
make set-local-images

# Restart pods
make rollout
```

Custom image names default to:

- `cygnetops/multi-client:local`
- `cygnetops/multi-server:local`
- `cygnetops/multi-worker:local`
- `cygnetops/multi-nest-api:local`

Override with:

```bash
make minikube-build DOCKER_USER=myuser IMAGE_TAG=v1
make set-local-images DOCKER_USER=myuser IMAGE_TAG=v1
```

---

## Troubleshooting

### Kubernetes: `connection refused` when running make commands

Your cluster is not running.

```bash
make start-minikube
# or enable Kubernetes in Docker Desktop → Settings
```

### Kubernetes: browser page keeps loading

**Cause 1 — wrong URL**  
Use **http://localhost:8080**, not the minikube IP.

```bash
make tunnel    # keep terminal open
make open
```

**Cause 2 — Postgres is down**  
Check pod status:

```bash
make status
```

If `postgres-deployment` shows `CrashLoopBackOff`:

```bash
make fix-postgres
make wait
make open
```

**Cause 3 — API hanging**  
The React app calls `/api/values/all` on load. If Postgres is unavailable, the page hangs.

```bash
make logs-server
make logs-postgres
```

### Docker Compose: page loads forever

```bash
docker compose logs api
docker compose ps
```

Ensure the API shows `Listening` and the client shows `Compiled successfully!`.

### Docker Compose: rebuild after Dockerfile changes

```bash
docker compose down -v
docker compose build --no-cache
docker compose up
```

### Check all pods are healthy

```bash
make status
kubectl get pods
```

All pods should show `STATUS: Running` and `READY: 1/1`.

---

## Development Notes

- **Node version:** All services use `node:16-alpine` for compatibility with legacy dependencies.
- **Postgres:** Pinned to `postgres:14` in Kubernetes. `postgres:latest` (v18+) breaks the existing volume mount configuration.
- **Docker Compose postgres** still uses `postgres:latest`; for consistency you may want to pin it to `postgres:14` in `docker-compose.yml`.
- **Production client image** bundles nginx and serves the built React app on port 3000 (no separate nginx pod in Kubernetes).

---

## License

Educational project based on the Stephen Grider Docker and Kubernetes course.
