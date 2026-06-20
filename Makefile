# Multi-container Fibonacci app — Kubernetes helpers
# Requires: kubectl and a running cluster (Docker Desktop, minikube, kind, etc.)

K8S_DIR       := k8s
PGPASSWORD    ?= postgres_password
SECRET_NAME   := pgpassword
NAMESPACE     ?=
DOCKER_USER   ?= atiqulhaque
IMAGE_TAG     ?= latest
PLATFORM      ?= linux/amd64
BUILDX        ?= docker buildx build --platform $(PLATFORM)

KUBECTL       := kubectl $(if $(NAMESPACE),-n $(NAMESPACE),)

CLIENT_IMAGE  := $(DOCKER_USER)/multi-client:$(IMAGE_TAG)
SERVER_IMAGE  := $(DOCKER_USER)/multi-server:$(IMAGE_TAG)
WORKER_IMAGE  := $(DOCKER_USER)/multi-worker:$(IMAGE_TAG)
NESTJS_IMAGE  := $(DOCKER_USER)/multi-nest-api:$(IMAGE_TAG)
NGINX_IMAGE   := $(DOCKER_USER)/multi-nginx:$(IMAGE_TAG)

INGRESS_URL   := https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.3/deploy/static/provider/cloud/deploy.yaml

.PHONY: check-cluster
check-cluster:
	@$(KUBECTL) cluster-info >/dev/null 2>&1 || ( \
		echo "ERROR: Cannot connect to the Kubernetes cluster."; \
		echo ""; \
		echo "Current context: $$($(KUBECTL) config current-context 2>/dev/null || echo unknown)"; \
		echo ""; \
		echo "Start your cluster first:"; \
		echo "  minikube:       make start-minikube"; \
		echo "  Docker Desktop: Settings → Kubernetes → Enable Kubernetes"; \
		echo ""; \
		exit 1 \
	)

.PHONY: start-minikube
start-minikube: ## Start minikube (your current kubectl context)
	minikube start

.PHONY: help
help: ## Show available targets
	@echo "Usage: make <target>"
	@echo ""
	@grep -E '^[a-zA-Z0-9_.-]+:.*?## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

.PHONY: create-secret
create-secret: check-cluster ## Create or update the Postgres password secret
	$(KUBECTL) create secret generic $(SECRET_NAME) \
		--from-literal=PGPASSWORD=$(PGPASSWORD) \
		--dry-run=client -o yaml | $(KUBECTL) apply -f -

.PHONY: deploy
deploy: create-secret ## Apply all manifests (PVC → data stores → app → ingress)
	$(KUBECTL) apply -f $(K8S_DIR)/database-persistent-volume-claim.yaml
	$(KUBECTL) apply -f $(K8S_DIR)/postgres-cluster-ip-service.yaml
	$(KUBECTL) apply -f $(K8S_DIR)/postgres-deployment.yaml
	$(KUBECTL) apply -f $(K8S_DIR)/redis-cluster-ip-service.yaml
	$(KUBECTL) apply -f $(K8S_DIR)/redis-deployment.yaml
	$(KUBECTL) apply -f $(K8S_DIR)/server-cluster-ip-service.yaml
	$(KUBECTL) apply -f $(K8S_DIR)/server-deployment.yaml
	$(KUBECTL) apply -f $(K8S_DIR)/nestjs-cluster-ip-service.yaml
	$(KUBECTL) apply -f $(K8S_DIR)/nestjs-deployment.yaml
	$(KUBECTL) apply -f $(K8S_DIR)/worker-deployment.yaml
	$(KUBECTL) apply -f $(K8S_DIR)/client-cluster-ip-service.yaml
	$(KUBECTL) apply -f $(K8S_DIR)/client-deployment.yaml
	$(KUBECTL) apply -f $(K8S_DIR)/ingress.yaml
	@echo ""
	@echo "Deployed. Run 'make tunnel' then open http://localhost:8080"
	@echo "Or run: make open"

.PHONY: delete
delete: ## Remove all Kubernetes resources
	$(KUBECTL) delete -f $(K8S_DIR)/ --ignore-not-found
	@echo "Resources deleted. Secret '$(SECRET_NAME)' was not removed (run 'make delete-secret' to remove it)."

.PHONY: delete-secret
delete-secret: ## Remove the Postgres password secret
	$(KUBECTL) delete secret $(SECRET_NAME) --ignore-not-found

.PHONY: delete-all
delete-all: delete delete-secret ## Remove manifests and the secret

.PHONY: status
status: check-cluster ## Show pods, services, deployments, PVCs, and ingress
	$(KUBECTL) get pods,services,deployments,pvc,ingress

.PHONY: wait
wait: check-cluster ## Wait until all pods in the default namespace are ready
	$(KUBECTL) wait --for=condition=ready pod --all --timeout=300s

.PHONY: install-ingress
install-ingress: check-cluster ## Install the nginx ingress controller (once per cluster)
	@if [ "$$($(KUBECTL) config current-context)" = "minikube" ]; then \
		echo "Enabling minikube ingress addon..."; \
		minikube addons enable ingress; \
	else \
		echo "Installing ingress-nginx for cloud/Docker Desktop..."; \
		$(KUBECTL) apply -f $(INGRESS_URL); \
		echo "Waiting for ingress controller..."; \
		$(KUBECTL) wait --namespace ingress-nginx \
			--for=condition=ready pod \
			--selector=app.kubernetes.io/component=controller \
			--timeout=300s; \
	fi

.PHONY: tunnel
tunnel: check-cluster ## Forward ingress to http://localhost:8080 (keep this terminal open)
	@echo "App available at http://localhost:8080"
	$(KUBECTL) port-forward -n ingress-nginx service/ingress-nginx-controller 8080:80

.PHONY: tunnel-bg
tunnel-bg: check-cluster ## Start ingress port-forward in the background
	@pgrep -f "port-forward.*ingress-nginx-controller.*8080:80" >/dev/null 2>&1 || \
		($(KUBECTL) port-forward -n ingress-nginx service/ingress-nginx-controller 8080:80 >/dev/null 2>&1 & sleep 2)
	@echo "Ingress tunnel running at http://localhost:8080"

.PHONY: open
open: tunnel-bg ## Open the app in the browser
	@open http://localhost:8080
	@echo "Opened http://localhost:8080"
	@echo "If the page does not load, run 'make tunnel' in another terminal."

.PHONY: port-forward
port-forward: ## Port-forward client (3000) and server (5000) without ingress
	@echo "Client: http://localhost:3000  |  API: http://localhost:5000"
	$(KUBECTL) port-forward service/client-cluster-ip-service 3000:3000 &
	$(KUBECTL) port-forward service/server-cluster-ip-service 5000:5000

.PHONY: logs-server
logs-server: ## Tail server pod logs
	$(KUBECTL) logs -l component=server --tail=100 -f

.PHONY: logs-client
logs-client: ## Tail client pod logs
	$(KUBECTL) logs -l component=web --tail=100 -f

.PHONY: logs-worker
logs-worker: ## Tail worker pod logs
	$(KUBECTL) logs -l component=worker --tail=100 -f

.PHONY: logs-postgres
logs-postgres: ## Tail postgres pod logs
	$(KUBECTL) logs -l component=postgres --tail=100 -f

.PHONY: logs-nestjs
logs-nestjs: ## Tail NestJS API logs
	$(KUBECTL) logs -l component=nestjs --tail=100 -f

.PHONY: fix-postgres
fix-postgres: check-cluster ## Reset postgres PVC and redeploy (fixes CrashLoopBackOff)
	$(KUBECTL) delete deployment postgres-deployment --ignore-not-found
	$(KUBECTL) delete pvc database-persistent-volume-claim --ignore-not-found
	$(KUBECTL) apply -f $(K8S_DIR)/database-persistent-volume-claim.yaml
	$(KUBECTL) apply -f $(K8S_DIR)/postgres-deployment.yaml
	$(KUBECTL) rollout restart deployment/server-deployment
	@echo "Postgres reset. Run 'make wait' then 'make open'."

.PHONY: build
build: ## Build all production Docker images locally
	docker build -t $(CLIENT_IMAGE) ./client
	docker build -t $(SERVER_IMAGE) ./server
	docker build -t $(WORKER_IMAGE) ./worker
	docker build -t $(NESTJS_IMAGE) ./nestjs-server
	docker build -t $(NGINX_IMAGE) ./nginx

.PHONY: push
push: ## Push all images to Docker Hub (run 'docker login' first)
	docker push $(CLIENT_IMAGE)
	docker push $(SERVER_IMAGE)
	docker push $(WORKER_IMAGE)
	docker push $(NESTJS_IMAGE)
	docker push $(NGINX_IMAGE)

.PHONY: publish
publish: build push ## Build and push all images to Docker Hub

.PHONY: setup-buildx
setup-buildx: ## Create/use a buildx builder (required for cross-platform builds)
	@docker buildx inspect multiarch >/dev/null 2>&1 || \
		docker buildx create --name multiarch --use
	@docker buildx use multiarch

.PHONY: publish-amd64
publish-amd64: setup-buildx ## Build and push linux/amd64 images for AWS EC2 (t3/t2)
	$(BUILDX) -t $(CLIENT_IMAGE) ./client --push
	$(BUILDX) -t $(SERVER_IMAGE) ./server --push
	$(BUILDX) -t $(WORKER_IMAGE) ./worker --push
	$(BUILDX) -t $(NESTJS_IMAGE) ./nestjs-server --push
	$(BUILDX) -t $(NGINX_IMAGE) ./nginx --push
	@echo ""
	@echo "Pushed amd64 images for EC2. On the server run:"
	@echo "  kubectl rollout restart deployment/client-deployment deployment/server-deployment deployment/worker-deployment deployment/nestjs-deployment"

.PHONY: minikube-build
minikube-build: ## Build images inside minikube's Docker daemon
	eval $$(minikube docker-env) && $(MAKE) build IMAGE_TAG=local

.PHONY: set-local-images
set-local-images: check-cluster create-secret ## Apply all manifests, then point deployments at local images
	@echo "Applying all Kubernetes manifests..."
	$(KUBECTL) apply -f $(K8S_DIR)/
	@echo "Setting local images..."
	$(KUBECTL) set image deployment/client-deployment client=$(CLIENT_IMAGE)
	$(KUBECTL) set image deployment/server-deployment server=$(SERVER_IMAGE)
	$(KUBECTL) set image deployment/worker-deployment worker=$(WORKER_IMAGE)
	$(KUBECTL) set image deployment/nestjs-deployment nestjs=$(NESTJS_IMAGE)
	$(KUBECTL) patch deployment client-deployment -p '{"spec":{"template":{"spec":{"containers":[{"name":"client","imagePullPolicy":"Never"}]}}}}'
	$(KUBECTL) patch deployment server-deployment -p '{"spec":{"template":{"spec":{"containers":[{"name":"server","imagePullPolicy":"Never"}]}}}}'
	$(KUBECTL) patch deployment worker-deployment -p '{"spec":{"template":{"spec":{"containers":[{"name":"worker","imagePullPolicy":"Never"}]}}}}'
	$(KUBECTL) patch deployment nestjs-deployment -p '{"spec":{"template":{"spec":{"containers":[{"name":"nestjs","imagePullPolicy":"Never"}]}}}}'

.PHONY: rebuild-nestjs
rebuild-nestjs: check-cluster ## Rebuild NestJS image and restart pods
	$(eval NEST_TAG := local-$(shell date +%Y%m%d%H%M%S))
	@echo "Building $(DOCKER_USER)/multi-nest-api:$(NEST_TAG) ..."
	eval $$(minikube docker-env) && docker build --no-cache -t $(DOCKER_USER)/multi-nest-api:$(NEST_TAG) ./nestjs-server
	$(KUBECTL) set image deployment/nestjs-deployment nestjs=$(DOCKER_USER)/multi-nest-api:$(NEST_TAG)
	$(KUBECTL) patch deployment nestjs-deployment -p '{"spec":{"template":{"spec":{"containers":[{"name":"nestjs","imagePullPolicy":"Never"}]}}}}'
	$(KUBECTL) rollout status deployment/nestjs-deployment --timeout=120s
	@echo "NestJS updated: $(DOCKER_USER)/multi-nest-api:$(NEST_TAG)"

.PHONY: rebuild-app
rebuild-app: rebuild-nestjs rebuild-client ## Rebuild NestJS + client images

.PHONY: rebuild-client
rebuild-client: check-cluster ## Rebuild client image and force pods to pick it up
	$(eval CLIENT_TAG := local-$(shell date +%Y%m%d%H%M%S))
	@echo "Building $(DOCKER_USER)/multi-client:$(CLIENT_TAG) ..."
	eval $$(minikube docker-env) && docker build --no-cache -t $(DOCKER_USER)/multi-client:$(CLIENT_TAG) ./client
	$(KUBECTL) set image deployment/client-deployment client=$(DOCKER_USER)/multi-client:$(CLIENT_TAG)
	$(KUBECTL) patch deployment client-deployment -p '{"spec":{"template":{"spec":{"containers":[{"name":"client","imagePullPolicy":"Never"}]}}}}'
	$(KUBECTL) rollout status deployment/client-deployment --timeout=120s
	@echo ""
	@echo "Client updated: $(DOCKER_USER)/multi-client:$(CLIENT_TAG)"
	@echo "Hard-refresh browser (Cmd+Shift+R) or use Incognito, then: make open"

.PHONY: deploy-local
deploy-local: minikube-build set-local-images rollout wait ## Build in minikube, set local images, and restart
	@echo "Local images deployed. Run 'make open' to access the app."

.PHONY: rollout
rollout: ## Restart all app deployments to pick up new images
	$(KUBECTL) rollout restart deployment/client-deployment
	$(KUBECTL) rollout restart deployment/server-deployment
	$(KUBECTL) rollout restart deployment/worker-deployment
	$(KUBECTL) rollout restart deployment/nestjs-deployment
	$(KUBECTL) rollout restart deployment/postgres-deployment
	$(KUBECTL) rollout restart deployment/redis-deployment

.PHONY: setup
setup: start-minikube install-ingress deploy wait tunnel-bg ## First-time setup: start minikube + ingress + deploy
	@echo ""
	@echo "Ready at http://localhost:8080"
	@$(MAKE) open
