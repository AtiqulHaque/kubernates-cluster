# Deploy on AWS — Single-Node k3s on EC2

Complete guide to run this project on **one EC2 instance** with **k3s**, using your Docker Hub images (`atiqulhaque/*`) and the existing `k8s/` manifests.

**Estimated cost:** ~$17–20/month (`t3.small` + 30 GB disk). No EKS, RDS, or load balancer required.

For the simpler Docker Compose path (no Kubernetes), see [AWS-DEPLOY.md](./AWS-DEPLOY.md).

---

## Architecture

```
Internet
   │
   ▼
EC2 public IP :80
   │
   └── nginx Ingress Controller (k3s ServiceLB)
            │
            ├── /              → client  (React)
            ├── /api/*         → server  (Express)
            └── /api/nest/*    → nestjs  (NestJS API)
                     │
               postgres + redis + worker
```

| Component | Image |
|-----------|-------|
| Client | `atiqulhaque/multi-client:latest` |
| Server | `atiqulhaque/multi-server:latest` |
| Worker | `atiqulhaque/multi-worker:latest` |
| NestJS | `atiqulhaque/multi-nest-api:latest` |
| Postgres | `postgres:14` (public) |
| Redis | `redis` (public) |

---

## Prerequisites

### On your Mac (before touching AWS)

| Requirement | Notes |
|-------------|-------|
| Docker Desktop | For building images |
| Docker Hub account | `atiqulhaque` |
| Git repo pushed | e.g. `github.com/AtiqulHaque/kubernates-cluster` |

### On AWS

| Requirement | Notes |
|-------------|-------|
| AWS account | Set a billing alert (~$20) |
| EC2 key pair | `.pem` file for SSH |
| Security group | Ports 22, 80 (443 optional) |

---

## Phase 1 — Push images to Docker Hub (Mac)

> **Critical:** If you build on an **Apple Silicon Mac**, `make publish` creates **ARM64** images. EC2 `t3` instances need **AMD64**. Always use `make publish-amd64` for AWS.

```bash
cd /path/to/complex

docker login
# Username: atiqulhaque
# Password: Docker Hub access token (https://hub.docker.com/settings/security)

make publish-amd64
```

Verify repos exist and are **Public**:

- https://hub.docker.com/r/atiqulhaque/multi-client
- https://hub.docker.com/r/atiqulhaque/multi-server
- https://hub.docker.com/r/atiqulhaque/multi-worker
- https://hub.docker.com/r/atiqulhaque/multi-nest-api

After code changes, re-run `make publish-amd64`, then restart pods on EC2 (Phase 6).

---

## Phase 2 — Launch EC2

1. **AWS Console → EC2 → Launch instance**

| Setting | Value |
|---------|--------|
| Name | `k3s-fibflow` |
| AMI | Ubuntu Server 22.04 LTS |
| Instance type | **t3.small** (2 GB RAM) or t3.micro + swap |
| Storage | 30 GB gp3 |
| Key pair | Your `.pem` file |

2. **Security group — inbound rules**

| Type | Port | Source |
|------|------|--------|
| SSH | 22 | My IP |
| HTTP | 80 | 0.0.0.0/0 |
| HTTPS | 443 | 0.0.0.0/0 (optional) |

3. Launch and note the **Public IPv4 address**.

4. *(Optional)* Attach an **Elastic IP** for a stable address.

---

## Phase 3 — Install k3s on EC2

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

### System prep

```bash
sudo apt-get update && sudo apt-get upgrade -y

# Swap (recommended on t3.micro)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Install k3s (disable built-in Traefik — we use nginx ingress)

```bash
curl -sfL https://get.k3s.io | sh -s - --disable traefik --write-kubeconfig-mode 644
```

### Fix kubectl permissions

Without this step, `kubectl` fails with `permission denied` on `/etc/rancher/k3s/k3s.yaml`:

```bash
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER:$USER ~/.kube/config
chmod 600 ~/.kube/config
echo 'export KUBECONFIG=$HOME/.kube/config' >> ~/.bashrc
source ~/.bashrc

kubectl get nodes
# Expected: STATUS Ready
```

---

## Phase 4 — Install nginx Ingress

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.3/deploy/static/provider/cloud/deploy.yaml

kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=300s
```

k3s **ServiceLB** exposes the ingress controller on the node's public IP (port 80).

---

## Phase 5 — Get project files on EC2

Pick **one** method.

### Option A — HTTPS clone (public repo, easiest)

```bash
cd ~
git clone https://github.com/AtiqulHaque/kubernates-cluster.git
cd kubernates-cluster
```

### Option B — SSH clone (private repo)

```bash
ssh-keygen -t ed25519 -C "ec2-k3s" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
# Add this key at GitHub → Settings → SSH and GPG keys

ssh -T git@github.com
git clone git@github.com:AtiqulHaque/kubernates-cluster.git
cd kubernates-cluster
```

### Option C — Copy from Mac (no GitHub on EC2)

```bash
# On Mac
scp -i your-key.pem -r /path/to/complex ubuntu@YOUR_EC2_PUBLIC_IP:~/kubernates-cluster
```

### Install Make (needed for helper commands)

```bash
sudo apt-get install -y make
```

---

## Phase 6 — Deploy the app

### Scale replicas for single-node EC2

Default manifests use 3 replicas for client and server. Reduce to 1:

```bash
sed -i 's/replicas: 3/replicas: 1/g' k8s/client-deployment.yaml k8s/server-deployment.yaml
```

### Create Postgres secret

```bash
make create-secret PGPASSWORD='change-this-to-a-strong-password'
```

### Apply all manifests

```bash
make deploy
make wait
make status
```

### Expected pods (all `Running`, `1/1`)

```
client-deployment-...
server-deployment-...
nestjs-deployment-...
worker-deployment-...
postgres-deployment-...
redis-deployment-...
ingress-nginx-controller-...   (ingress-nginx namespace)
```

---

## Phase 7 — Open the app

```
http://YOUR_EC2_PUBLIC_IP
```

| Feature | URL |
|---------|-----|
| React UI | `/` |
| Express API | `/api/` |
| NestJS values | `/api/nest/values` |
| NestJS notes | `/api/nest/notes` |

Quick test from EC2 or Mac:

```bash
curl http://YOUR_EC2_PUBLIC_IP/api/
curl http://YOUR_EC2_PUBLIC_IP/api/nest/values
```

---

## Updating the app

**On Mac** (after code changes):

```bash
make publish-amd64
# Or with a version tag:
make publish-amd64 IMAGE_TAG=v2
```

**On EC2**:

```bash
kubectl rollout restart deployment/client-deployment
kubectl rollout restart deployment/server-deployment
kubectl rollout restart deployment/worker-deployment
kubectl rollout restart deployment/nestjs-deployment
make wait
```

If you used a new tag (e.g. `v2`), update image references in `k8s/*.yaml` first, then `make deploy`.

---

## Makefile reference (AWS-relevant)

| Command | Where | Purpose |
|---------|-------|---------|
| `make publish-amd64` | Mac | Build + push **amd64** images for EC2 |
| `make publish` | Mac | Build + push for your Mac's CPU (not for t3 EC2) |
| `make create-secret` | EC2 | Postgres password secret |
| `make deploy` | EC2 | Apply all `k8s/` manifests |
| `make wait` | EC2 | Wait for pods to be ready |
| `make status` | EC2 | Show pods, services, ingress |
| `make fix-postgres` | EC2 | Reset Postgres PVC if crashing |
| `make delete-all` | EC2 | Remove all resources |

---

## Troubleshooting

### `permission denied` on k3s.yaml

```bash
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER:$USER ~/.kube/config
export KUBECONFIG=$HOME/.kube/config
```

Or use: `sudo k3s kubectl get pods`

---

### `ImagePullBackOff` / `ErrImagePull`

**Cause 1 — ARM images on AMD EC2 (most common on Mac)**

Images built with `make publish` on Apple Silicon are ARM64. EC2 `t3` needs AMD64.

```bash
# On Mac
make publish-amd64

# On EC2
kubectl rollout restart deployment/client-deployment deployment/server-deployment deployment/worker-deployment deployment/nestjs-deployment
```

**Cause 2 — Images not on Docker Hub**

Run `make publish-amd64` on Mac. Ensure repos are **Public**.

**Cause 3 — Private repos**

```bash
kubectl create secret docker-registry dockerhub-secret \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=atiqulhaque \
  --docker-password=YOUR_DOCKERHUB_TOKEN \
  --docker-email=your@email.com

kubectl patch serviceaccount default \
  -p '{"imagePullSecrets":[{"name":"dockerhub-secret"}]}'
```

Test pull on EC2:

```bash
sudo k3s ctr images pull docker.io/atiqulhaque/multi-client:latest
```

---

### `503 Service Temporarily Unavailable` (nginx)

Ingress is up but backend pods are not ready.

```bash
kubectl get pods
kubectl get endpoints
```

Fix the failing pods first (usually ImagePullBackOff or Postgres crash). Endpoints must show IP addresses, not `<none>`.

---

### Postgres `CrashLoopBackOff`

```bash
make fix-postgres
make wait
kubectl rollout restart deployment/server-deployment
kubectl rollout restart deployment/nestjs-deployment
```

---

### Page loads forever

The React app calls `/api/values/all` on load. If Postgres or the API is down, the page hangs.

```bash
kubectl logs -l component=server --tail=50
kubectl logs -l component=postgres --tail=50
```

---

### Out of memory (t3.micro)

```bash
free -h
kubectl get pods
```

Add swap (Phase 3), scale to 1 replica, or upgrade to **t3.small**.

---

### Git clone `Permission denied (publickey)`

EC2 has no GitHub SSH key. Use HTTPS clone or add an EC2 deploy key (Phase 5).

---

## Security checklist

- [ ] Change default `PGPASSWORD` from `postgres_password`
- [ ] Restrict SSH (port 22) to your IP
- [ ] Do not expose k3s API (6443) to the internet
- [ ] Keep Docker Hub repos public **or** use pull secrets
- [ ] Set AWS billing alert

---

## Teardown

**On EC2:**

```bash
cd ~/kubernates-cluster
make delete-all
```

**In AWS Console:**

1. Terminate EC2 instance
2. Release Elastic IP (if allocated)
3. Delete unused security groups

---

## Full command cheat sheet

### Mac

```bash
docker login
make publish-amd64
```

### EC2 (first-time setup)

```bash
curl -sfL https://get.k3s.io | sh -s - --disable traefik --write-kubeconfig-mode 644
mkdir -p ~/.kube && sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config && sudo chown $USER:$USER ~/.kube/config
echo 'export KUBECONFIG=$HOME/.kube/config' >> ~/.bashrc && source ~/.bashrc

kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.3/deploy/static/provider/cloud/deploy.yaml
kubectl wait -n ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=300s

git clone https://github.com/AtiqulHaque/kubernates-cluster.git && cd kubernates-cluster
sudo apt-get install -y make
sed -i 's/replicas: 3/replicas: 1/g' k8s/client-deployment.yaml k8s/server-deployment.yaml
make create-secret PGPASSWORD='your-strong-password'
make deploy && make wait && make status
```

Open **http://YOUR_EC2_PUBLIC_IP**

---

## Related files

| File | Purpose |
|------|---------|
| `k8s/` | Kubernetes manifests |
| `Makefile` | Deploy helpers, `publish-amd64` |
| `AWS-DEPLOY.md` | Cheaper Docker Compose path (no k3s) |
| `README.md` | Local dev + minikube |
