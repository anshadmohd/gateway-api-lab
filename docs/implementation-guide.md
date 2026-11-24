# Implementation guide: from zero to a working Gateway API lab

Follow these steps in order on a machine that has nothing installed yet. If you already have a tool, skip its step and confirm the version.

## Part A: Install the tools

### A1. Docker

Install Docker Desktop (macOS, Windows) or Docker Engine (Linux). Start it, then confirm:

```bash
docker version
```

Both the Client and Server sections must print. If Server is missing, Docker isn't running.

### A2. kind (Kubernetes in Docker)

- macOS with Homebrew: `brew install kind`
- Linux or Windows: follow the install steps at https://kind.sigs.k8s.io/docs/user/quick-start/

```bash
kind version
```

### A3. kubectl

- macOS with Homebrew: `brew install kubectl`
- Otherwise: https://kubernetes.io/docs/tasks/tools/

```bash
kubectl version --client
```

### A4. Helm 3

- macOS with Homebrew: `brew install helm`
- Otherwise: https://helm.sh/docs/intro/install/

```bash
helm version
```

### A5. Shell

Use a bash-compatible shell: macOS or Linux Terminal, WSL on Windows, or Git Bash. The commands in this guide assume bash.

## Part B: Create the cluster

### B1. Create a kind cluster

```bash
kind create cluster --name gateway-lab
```

This takes a minute or two. It sets kubectl's context to `kind-gateway-lab`.

### B2. Confirm kubectl can reach it

```bash
kubectl config current-context    # kind-gateway-lab
kubectl get nodes                 # one node, STATUS Ready
```

If you already have a kind cluster, use its name everywhere below instead of `gateway-lab`.

## Part C: Get the lab

### C1. Put the lab folder on your machine

Unzip `gateway-apils-lab.zip` and open a terminal in the folder that contains `app/`, `manifests/`, and `scripts/`.

```bash
ls            # should show: app  docs  manifests  scripts  README.md
```

## Part D: Install Envoy Gateway

### D1. Install the controller

```bash
helm install eg oci://docker.io/envoyproxy/gateway-helm --version v1.6.1 \
  -n envoy-gateway-system --create-namespace
```

### D2. Wait until it is ready

```bash
kubectl wait --timeout=5m -n envoy-gateway-system deployment/envoy-gateway --for=condition=Available
```

Skip D1 if you already have Envoy Gateway installed. Check with `helm list -n envoy-gateway-system`.

## Part E: Build and deploy the sample app

### E1. Build the image

```bash
docker build -t gateway-lab/shop:1.0 app/
```

### E2. Load the image into kind

```bash
kind load docker-image gateway-lab/shop:1.0 --name gateway-lab
```

Kind nodes can't see images on your Docker host unless you load them, so this step is required.

### E3. Deploy the two app versions

```bash
kubectl apply -f manifests/02-app/
kubectl rollout status deployment/shop-v1
kubectl rollout status deployment/shop-v2
```

### E4. Check the pods

```bash
kubectl get pods -l app=shop
```

You should see three pods (two `shop-v1`, one `shop-v2`), all `Running` and `1/1` ready.

## Part F: Create the Gateway

### F1. Apply the GatewayClass and Gateway

```bash
kubectl apply -f manifests/03-gateway/
```

### F2. Wait until it is programmed

```bash
kubectl get gateway lab-gateway
```

Wait until `PROGRAMMED` shows `True`. Re-run the command every few seconds if needed.

## Part G: Open the app in your browser

### G1. Start the port-forward

Leave this terminal open for the rest of the lab.

```bash
ENVOY_SVC=$(kubectl get svc -n envoy-gateway-system \
  --selector=gateway.envoyproxy.io/owning-gateway-namespace=default,gateway.envoyproxy.io/owning-gateway-name=lab-gateway \
  -o jsonpath='{.items[0].metadata.name}')

kubectl -n envoy-gateway-system port-forward "svc/$ENVOY_SVC" 8888:80
```

### G2. Check the empty gateway

Open **http://shop.localhost:8888**. A 404 from Envoy is correct: no routes exist yet.

## Part H: Add the routes, one step at a time

For each step: apply the file, refresh the browser, then run the check.

### H1. Basic routing

```bash
kubectl apply -f manifests/04-routes/01-basic.yaml
scripts/verify.sh basic
```

Browser: the page shows **Shop v1** and route `basic`.

### H2. URL rewrite

```bash
kubectl apply -f manifests/04-routes/02-url-rewrite.yaml
scripts/verify.sh rewrite
```

Browser: open **http://shop.localhost:8888/legacy/**. The path card shows `/legacy/api/whoami` becoming `/api/whoami`.

### H3. Header-based canary

```bash
kubectl apply -f manifests/04-routes/03-header-canary.yaml
scripts/verify.sh canary
```

Browser: click **Send 50 with x-canary: true**. All 50 go to Shop v2.

### H4. Weighted split

```bash
kubectl apply -f manifests/04-routes/04-weighted.yaml
scripts/verify.sh weighted
```

Browser: click **Send 50 requests**. The bars should be near 80% / 20%.

## Part I: Confirm the resources

```bash
kubectl get gatewayclass,gateway,httproute
```

Each HTTPRoute should show `Accepted: True` when described (`kubectl describe httproute shop`).

## Part J: Clean up

```bash
kubectl delete -f manifests/04-routes/
kubectl delete -f manifests/03-gateway/
kubectl delete -f manifests/02-app/
kind delete cluster --name gateway-lab
```

Stop the port-forward with Ctrl+C. The `kind delete` line removes the whole cluster; skip it if you want to keep it.

## If something goes wrong

| Symptom | Fix |
|---|---|
| `docker version` shows no Server | Start Docker Desktop or the Docker service. |
| `kind create cluster` fails | Confirm Docker is running and that port and disk space are available. |
| `helm install` can't pull the chart | Check internet access; the chart comes from `docker.io`. |
| Gateway never becomes `PROGRAMMED: True` | `kubectl describe gateway lab-gateway`; check `kubectl get pods -n envoy-gateway-system`. |
| `ENVOY_SVC` is empty | Wait for the Gateway to be programmed, then re-run G1. |
| Pods show `ErrImagePull` | Repeat E2 with the right cluster name. |
| 404 in the browser after applying a route | Use `shop.localhost`, not `localhost`, in the URL. Check `kubectl get httproute`. |
| `shop.localhost` doesn't resolve | Add `127.0.0.1 shop.localhost` to your hosts file, or use curl with `-H "Host: shop.localhost"`. |
| Port 8888 in use | Use `8080:80` in G1, open `http://shop.localhost:8080`, and set `BASE=http://localhost:8080` for `verify.sh`. |

For the full explanations and the concepts table, see `README.md`. For the talk track, see `docs/presenter-guide.md`.
