#!/usr/bin/env bash
# Checks that the gateway is doing what the given lab step should do.
#
#   scripts/verify.sh basic | rewrite | canary | weighted
#
# Needs the port-forward from README step 5 to be running.
set -euo pipefail

BASE="${BASE:-http://localhost:8888}"
HOST_HEADER="${HOST_HEADER:-shop.localhost}"
step="${1:-}"
pass=0
fail=0

get() { # get <path> [extra curl args] -> response body
  local path="$1"; shift
  curl -fsS -H "Host: ${HOST_HEADER}" "$@" "${BASE}${path}"
}

expect() { # expect <description> <body> <text that must appear>
  if grep -qF -- "$3" <<<"$2"; then
    echo "  PASS  $1"; pass=$((pass + 1))
  else
    echo "  FAIL  $1   (expected to find: $3)"; fail=$((fail + 1))
  fi
}

case "$step" in
  basic)
    echo "Step 1: basic routing"
    body=$(get /api/whoami)
    expect "request to / is answered by shop-v1" "$body" '"version": "v1"'
    expect "the 'shop' HTTPRoute tagged the request" "$body" '"x-lab-route": "basic"'
    ;;
  rewrite)
    echo "Step 2: URL rewrite"
    body=$(get /legacy/api/whoami)
    expect "/legacy/api/whoami reaches the app as /api/whoami" "$body" '"path": "/api/whoami"'
    expect "the 'shop-legacy' HTTPRoute tagged the request" "$body" '"x-lab-route": "rewrite"'
    ;;
  canary)
    echo "Step 3: header-based routing"
    body=$(get /api/whoami -H 'x-canary: true')
    expect "x-canary: true is answered by shop-v2" "$body" '"version": "v2"'
    expect "the canary rule tagged the request" "$body" '"x-lab-route": "canary"'
    body=$(get /api/whoami)
    expect "without the header, shop-v1 still answers" "$body" '"version": "v1"'
    ;;
  weighted)
    echo "Step 4: weighted split (100 requests, expect about 80/20)"
    v1=0; v2=0
    for _ in $(seq 100); do
      if get /api/whoami | grep -qF '"version": "v2"'; then v2=$((v2 + 1)); else v1=$((v1 + 1)); fi
    done
    echo "  INFO  shop-v1: ${v1}   shop-v2: ${v2}"
    # Weighted choice is random, so allow a generous band around 80.
    if (( v1 >= 65 && v1 <= 95 )); then
      echo "  PASS  split is close to 80/20"; pass=$((pass + 1))
    else
      echo "  FAIL  split is far from 80/20"; fail=$((fail + 1))
    fi
    ;;
  *)
    echo "usage: $0 basic|rewrite|canary|weighted" >&2
    exit 2
    ;;
esac

echo
echo "${pass} passed, ${fail} failed"
(( fail == 0 ))
