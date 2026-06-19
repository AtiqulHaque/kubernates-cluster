# Deploy FibFlow on AWS (Minimum Cost)

This guide deploys the full stack (React, Express, NestJS, Worker, Redis, Postgres, nginx) on AWS for the **lowest practical cost** — typically **$0–15/month**.

---

## Cost comparison (approximate)

| Option | Monthly cost | Best for |
|--------|--------------|----------|
| **EC2 t3.micro + Docker Compose** (recommended) | **$0** (free tier 12 mo) then ~$8 | Learning, demos, low traffic |
| **EC2 t3.small + Docker Compose** | ~$15 | More stable under load |
| **Lightsail $5 plan** | $5 fixed | Simple billing, small apps |
| **Elastic Beanstalk (multi-container)** | ~$20–40+ | Managed deploys, less ops |
| **EKS (Kubernetes)** | ~$75+ | Production at scale — **not minimum cost** |

**Avoid for minimum cost:** EKS, ECS Fargate (multiple tasks), RDS, ElastiCache, NAT Gateway, Application Load Balancer.

This guide uses **one EC2 instance** running everything via `docker-compose.prod.yml`.

---

## Architecture on AWS

```
Internet
   │
   ▼
EC2 (port 80)
   │
   └── nginx ──┬── client (React)
               ├── api (Express)
               └── nest-api (NestJS)
                     │
               postgres + redis + worker
```

All services run on **one machine**. Postgres and Redis are **not** on RDS/ElastiCache (saves ~$15–30/month).

---

## Prerequisites

- AWS account
- SSH key pair (.pem file)
- Your project code (git clone or upload)
- Domain name (optional; you can use the EC2 public IP)

---

## Step 1 — Launch an EC2 instance

1. Open **AWS Console → EC2 → Launch instance**
2. Settings:

| Setting | Value |
|---------|--------|
| Name | `fibflow-app` |
| AMI | **Ubuntu Server 22.04 LTS** |
| Instance type | **t3.micro** (free tier) or **t3.small** (recommended if not on free tier) |
| Key pair | Create or select existing |
| Storage | **20 GB** gp3 (free tier includes 30 GB) |

3. **Security group** — allow inbound:

| Type | Port | Source |
|------|------|--------|
| SSH | 22 | My IP |
| HTTP | 80 | 0.0.0.0/0 |
| HTTPS | 443 | 0.0.0.0/0 (optional, for SSL later) |

4. Launch the instance and note the **Public IPv4 address**.

---

## Step 2 — Connect and install Docker

```bash
# Replace with your key and EC2 public IP
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

On the EC2 instance:

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu

# Install Docker Compose plugin
sudo apt-get install -y docker-compose-plugin

# Log out and back in so docker group applies
exit
```

SSH in again, then verify:

```bash
docker --version
docker compose version
```

### Optional: add swap (helps on t3.micro with 1 GB RAM)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Step 3 — Deploy the application

```bash
# Clone your repo (or upload with scp)
git clone https://github.com/YOUR_USER/complex.git
cd complex

# Set a strong Postgres password
export PGPASSWORD='change-this-to-a-strong-password'
echo "PGPASSWORD=$PGPASSWORD" > .env

# Build and start production stack
docker compose -f docker-compose.prod.yml up -d --build
```

First build takes **10–20 minutes** on a small instance.

Check status:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f nginx
```

Open in browser:

```
http://YOUR_EC2_PUBLIC_IP
```

---

## Step 4 — Verify all features

| Feature | URL |
|---------|-----|
| App home | `http://YOUR_EC2_PUBLIC_IP/` |
| NestJS values | `http://YOUR_EC2_PUBLIC_IP/nestjs-data` |
| Notes CRUD | `http://YOUR_EC2_PUBLIC_IP/notes` |
| Express API | `http://YOUR_EC2_PUBLIC_IP/api/` |
| NestJS API | `http://YOUR_EC2_PUBLIC_IP/api/nest/notes` |

Quick API test:

```bash
curl http://YOUR_EC2_PUBLIC_IP/api/
curl -X POST http://YOUR_EC2_PUBLIC_IP/api/nest/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"AWS test","content":"Deployed on EC2"}'
curl http://YOUR_EC2_PUBLIC_IP/api/nest/notes
```

---

## Step 5 — Auto-start on reboot

```bash
cd ~/complex

# Create a systemd service
sudo tee /etc/systemd/system/fibflow.service << 'EOF'
[Unit]
Description=FibFlow Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu/complex
EnvironmentFile=/home/ubuntu/complex/.env
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable fibflow
```

Adjust `WorkingDirectory` if your clone path differs.

---

## Step 6 — Optional: free HTTPS with Let's Encrypt

Use a domain pointed to your EC2 IP (Route 53 or any DNS provider).

```bash
sudo apt-get install -y certbot

# Stop nginx container temporarily
docker compose -f docker-compose.prod.yml stop nginx

# Get certificate (replace example.com)
sudo certbot certonly --standalone -d example.com

# Mount certs into nginx — extend docker-compose.prod.yml ports/volumes
# Or use Caddy/Traefik as reverse proxy in front
```

**Easier alternative (free):** put **Cloudflare** in front of your domain (free plan) and enable proxy + SSL without managing certs on the server.

---

## Updating the app

```bash
cd ~/complex
git pull

docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

---

## Alternative: AWS Lightsail ($5/month)

If you prefer fixed pricing over EC2:

1. **Lightsail → Create instance**
2. OS: **Linux / Ubuntu 22.04**
3. Plan: **$5/month** (512 MB — tight) or **$10/month** (1 GB — better)
4. Open port **80** in Networking → Firewall
5. SSH in and follow **Steps 2–5** above (same Docker Compose commands)

---

## Alternative: Elastic Beanstalk (not minimum cost)

The repo includes `Dockerrun.aws.json` from the original course. It does **not** include NestJS, Postgres, or Redis. For minimum cost, **prefer EC2 + Docker Compose** instead.

If you still use Beanstalk:

- You need **external** Postgres and Redis (adds cost), or an updated `Dockerrun.aws.json`
- Minimum ~$20–40/month with a single-instance environment

---

## Cost-saving checklist

- [ ] Use **one EC2** instance — no EKS, no Fargate
- [ ] Run Postgres + Redis **on the same instance** (not RDS/ElastiCache)
- [ ] Use **t3.micro** on free tier, or **t3.small** if you need stability
- [ ] No NAT Gateway (not needed for single public EC2)
- [ ] No Application Load Balancer (nginx on EC2 is enough)
- [ ] Stop the instance when not in use (dev/demo only)
- [ ] Set **billing alerts** in AWS Billing → Budgets

---

## Teardown (delete everything)

```bash
# On EC2
cd ~/complex
docker compose -f docker-compose.prod.yml down -v
```

Then in AWS Console:

1. **EC2 → Instances → Terminate** the instance
2. **EC2 → Elastic IPs → Release** (if you allocated one and don't need it)
3. **EC2 → Security Groups → Delete** unused groups
4. **EC2 → Key Pairs → Delete** if no longer needed

---

## Troubleshooting

### App not loading

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs nginx
docker compose -f docker-compose.prod.yml logs api
```

Ensure security group allows **port 80** from `0.0.0.0/0`.

### Out of memory (t3.micro)

```bash
free -h
docker stats
```

Add swap (see Step 2) or upgrade to **t3.small**.

### Postgres data lost after restart

Ensure the `postgres_data` volume exists:

```bash
docker volume ls
```

Never run `docker compose down -v` in production unless you intend to wipe the database.

### Build fails on small instance

```bash
# Build one service at a time
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml build client
docker compose -f docker-compose.prod.yml up -d
```

---

## Quick reference

```bash
# Start
docker compose -f docker-compose.prod.yml up -d --build

# Stop
docker compose -f docker-compose.prod.yml down

# Logs
docker compose -f docker-compose.prod.yml logs -f

# Restart one service
docker compose -f docker-compose.prod.yml restart api
```

---

## Related files

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Production stack for AWS |
| `docker-compose.yml` | Local development (hot reload) |
| `k8s/` | Kubernetes (minikube) — not for minimum-cost AWS |
| `Makefile` | Kubernetes helpers only |

For local development, see [README.md](./README.md).
