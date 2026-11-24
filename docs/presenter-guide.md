# Presenter guide

About 15 minutes. The browser does the talking, so keep it on screen the whole time.

## Before the talk

1. Run README steps 1 to 5 the day before, so the cluster and images are ready.
2. Open two things on the screen: the browser at `http://shop.localhost:8888` and a terminal running the port-forward.
3. Check each step once with `scripts/verify.sh`. Reset the cluster afterwards so the live run starts clean.
4. If the port-forward dies mid-talk, restart the command from step 5. The browser tab just needs a refresh.

## Talk track

**Opening (1 min).** A Gateway is where traffic enters the cluster. An HTTPRoute is the rule for where it goes. Show the 404 from Envoy: "Nothing routes this yet."

**Step 1: basic routing (2 min).** Apply `01-basic.yaml`, then refresh.
- Point at *Route that matched*: `basic` came from the gateway, not from the app.
- Point at *Headers the backend received*: `host` and `x-lab-route` are what the gateway adds or passes on.
- Reload two or three times. The pod name changes because two pods sit behind one Service.

**Step 2: URL rewrite (2 min).** Apply `02-url-rewrite.yaml`, then open `/legacy/`.
- Point at the path arrow: the browser asked for `/legacy/api/whoami`, and the app received `/api/whoami`.
- Say it plainly: the app didn't change. The gateway did.

**Step 3: header canary (3 min).** Apply `03-header-canary.yaml`.
- Plain refresh: still shop v1.
- Click *Send 50 with x-canary: true*: 50 of 50 land on shop v2.
- Point out that the browser can't set this header itself. The page's JavaScript does it, the same way an API client would.

**Step 4: weighted split (3 min).** Apply `04-weighted.yaml`.
- Click *Send 50 requests* and look at the bars.
- Explain that the weight is per Service, not per pod.
- Run `scripts/verify.sh weighted` to show the larger sample (100 requests).

**Recap (2 min).** The app image never changed. Only the HTTPRoute files did. Every route tags requests with `x-lab-route`, so the browser shows exactly which rule matched.

## Likely questions

- **Why Envoy Gateway?** It's the implementation from our tutorial. The HTTPRoute files use standard Gateway API fields, so they should work with another implementation that has its own GatewayClass. Check each feature (rewrites, header matches, weights) against that implementation's documentation.
- **Why port-forward instead of a LoadBalancer?** kind has no external load balancer IP unless you add something like MetalLB. Port-forward works with no extra setup.
- **Can I send a different header?** Yes. Change the `headers` match in `03-header-canary.yaml`, then apply it again.

## If something breaks on stage

- Browser fails: run `scripts/verify.sh <step>` in the terminal. It prints a PASS or FAIL line for each check.
- Port-forward dropped: restart it and refresh.
- Cluster is unusable: explain the step with the YAML on screen, then move on.
