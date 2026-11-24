# Gateway API Lab: Envoy Gateway on kind

A hands-on lab for learning the Kubernetes Gateway API.

You deploy one small sample app, a shop with a stable and a canary version. Then you apply four HTTPRoute changes, one at a time. After each change, you refresh a browser page that shows which pod answered and what the gateway did to the request.

The lab covers the same ideas as the tutorial repo (basic routing, URL rewrite, traffic splitting, header matching). It uses its own app, not the echo-basic image.

## How it fits together

```
Browser  ──►  http://shop.localhost:8888
                    │  kubectl port-forward (step 5)
                    ▼
              Envoy proxy  ◄── Gateway "lab-gateway" (GatewayClass "eg")
                    │  HTTPRoute rules choose the backend
                    ├──►  Service shop-v1  ──►  2 pods  (stable)
                    └──►  Service shop-v2  ──►  1 pod   (canary)
```

## Prerequisites

- Docker is running
- A kind cluster (an existing one is fine)
- `kubectl`, `helm` 3, and a bash shell (macOS, Linux, WSL, or Git Bash on Windows)
- Local port 8888 is free

Check that kubectl points at your kind cluster:

```bash
kubectl config current-context    # should print kind-<cluster-name>
```

## Steps

### 1. Install Envoy Gateway

Skip this if you already installed it for the tutorial.

```bash
helm install eg oci://docker.io/envoyproxy/gateway-helm --version v1.6.1 \
  -n envoy-gateway-system --create-namespace

kubectl wait --timeout=5m -n envoy-gateway-system deployment/envoy-gateway --for=condition=Available
```

### 2. Build the app image and load it into kind

```bash
docker build -t gateway-lab/shop:1.0 app/
kind load docker-image gateway-lab/shop:1.0 --name <your-cluster-name>
```

`kind get clusters` lists your cluster names. The default name is `kind`. The image must be loaded into kind because the cluster can't pull a locally built image from Docker Hub.

### 3. Deploy the two app versions

```bash
kubectl apply -f manifests/02-app/
kubectl rollout status deployment/shop-v1
kubectl rollout status deployment/shop-v2
```

Both versions run the same image. Only their environment variables differ (name, color, and version label).

### 4. Create the GatewayClass and the Gateway

```bash
kubectl apply -f manifests/03-gateway/
kubectl get gateway lab-gateway
```

Wait until the `PROGRAMMED` column shows `True`.

### 5. Open the port-forward and the browser

```bash
ENVOY_SVC=$(kubectl get svc -n envoy-gateway-system \
  --selector=gateway.envoyproxy.io/owning-gateway-namespace=default,gateway.envoyproxy.io/owning-gateway-name=lab-gateway \
  -o jsonpath='{.items[0].metadata.name}')

kubectl -n envoy-gateway-system port-forward "svc/$ENVOY_SVC" 8888:80
```

Leave this terminal running, then open **http://shop.localhost:8888** in your browser.

At this point you should see a **404 page from Envoy**. There are no routes yet, so the gateway has nowhere to send the request. That's the starting point for the demo.

### 6. Step 1: basic routing

```bash
kubectl apply -f manifests/04-routes/01-basic.yaml
```

Refresh the browser. You should see **Shop v1 · stable** and route `basic`. Reload a few times. The pod name changes between the two shop-v1 pods, because the Service spreads requests across them.

Check it: `scripts/verify.sh basic`

### 7. Step 2: URL rewrite

```bash
kubectl apply -f manifests/04-routes/02-url-rewrite.yaml
```

Open **http://shop.localhost:8888/legacy/**. The "Path" card shows `/legacy/api/whoami` going in and `/api/whoami` arriving at the app. The route is `rewrite`.

Check it: `scripts/verify.sh rewrite`

### 8. Step 3: header-based canary

```bash
kubectl apply -f manifests/04-routes/03-header-canary.yaml
```

Refresh the browser. You still get shop v1. Click **Send 50 with x-canary: true**. All 50 requests go to shop v2, and the route is `canary`.

A browser address bar can't add custom headers, which is why the page has this button. Any API client could send the same header.

Check it: `scripts/verify.sh canary`

### 9. Step 4: weighted traffic split

```bash
kubectl apply -f manifests/04-routes/04-weighted.yaml
```

Click **Send 50 requests**. The bars should land near 80% / 20%. Small samples vary, so `verify.sh` runs 100 requests.

Weights are set per Service, not per pod. Shop v1 has two pods, and its 80% share is spread across them.

Check it: `scripts/verify.sh weighted`

## Concepts at a glance

| Resource | What it is | In this lab |
|---|---|---|
| GatewayClass | Names the controller that runs Gateways of this kind | `eg` (Envoy Gateway) |
| Gateway | An entry point with listeners (ports, protocols) | `lab-gateway`, port 80 |
| HTTPRoute | Rules that match requests and send them to backends | `shop`, `shop-legacy` |
| matches | Conditions on a request: path, headers | path prefix, header `x-canary: true` |
| filters | Changes made to a request on the way through | `URLRewrite`, `RequestHeaderModifier` |
| backendRefs and weight | Which Service gets the request, and what share | `shop-v1` 80, `shop-v2` 20 |

Every route in this lab sets the header `x-lab-route`. That's how the app reports which rule matched.

## Cleanup

```bash
kubectl delete -f manifests/04-routes/
kubectl delete -f manifests/03-gateway/   # also removes the GatewayClass "eg"; skip if you use it elsewhere
kubectl delete -f manifests/02-app/
```

Stop the port-forward with Ctrl+C. Delete the whole cluster with `kind delete cluster --name <your-cluster-name>` if you like.

## Troubleshooting

- **404 after a route is applied.** The Host header must be `shop.localhost`. Use `http://shop.localhost:8888`, not `http://localhost:8888`. Check that `kubectl get httproute` shows `Accepted: True`.
- **`shop.localhost` doesn't open in your browser.** Some browsers don't resolve `*.localhost`. Add `127.0.0.1 shop.localhost` to your hosts file (`/etc/hosts`, or `C:\Windows\System32\drivers\etc\hosts`). Or test with curl: `curl -H "Host: shop.localhost" http://localhost:8888/api/whoami`.
- **Gateway never shows `PROGRAMMED: True`.** Run `kubectl describe gateway lab-gateway` and `kubectl get gatewayclass eg` (`ACCEPTED` should be `True`). Check that the controller is running: `kubectl get pods -n envoy-gateway-system`.
- **`ENVOY_SVC` is empty.** Envoy creates its Service after the Gateway is programmed. Wait a moment and run the command again.
- **Pods show `ErrImagePull`.** The image isn't in kind. Repeat step 2 with the correct cluster name.
- **Port 8888 is already in use.** Forward a different local port, such as `8080:80`, and open `http://shop.localhost:8080`. For the verify script, set `BASE=http://localhost:8080`.

## Repository layout

```
app/                    sample app: Node.js, no dependencies, Dockerfile, tests
manifests/02-app/       two app versions (Deployments and Services)
manifests/03-gateway/   GatewayClass and Gateway
manifests/04-routes/    one HTTPRoute change per lab step
scripts/verify.sh       checks the behaviour of each step
docs/presenter-guide.md talk track for presenting the lab to a team
```

To run the app tests without a cluster: `cd app && npm test`.
