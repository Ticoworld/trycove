#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
image='node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5'
docker image inspect "$image" >/dev/null 2>&1 || { echo 'Pinned container image unavailable; obtain node:24-alpine at the documented digest before running.' >&2; exit 1; }
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git -c core.hooksPath=/dev/null clone --quiet https://github.com/alesfer001/CrowdCell.git "$tmp/crowdcell"
git -C "$tmp/crowdcell" checkout --quiet 0835ad42decf2c9594fa92a185eea4cee9eba622
git -c core.hooksPath=/dev/null clone --quiet https://github.com/tydeptrai21042004/CellGuard.git "$tmp/cellguard"
git -C "$tmp/cellguard" checkout --quiet 2bb3182adb1a5d00bca24e2068f790a50e8e2d70
mkdir "$tmp/trial"
node "$root/scripts/benchmarks/prepare-pledge.cjs" "$tmp/crowdcell" "$tmp/cellguard" "$tmp/trial"
cp "$root/scripts/benchmarks/pledge-worker.mjs" "$tmp/trial/pledge-worker.mjs"
chmod 755 "$tmp"
chmod -R a+rX "$tmp/trial"
printf '%s\n' 'Running reviewed extraction with synthetic mocks; Docker network disabled; no host credentials mounted.'
timeout 60s docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 32 --memory 192m --cpus 1 --user 65534:65534 --tmpfs /tmp:rw,noexec,nosuid,size=16m -v "$tmp/trial:/trial:ro" -w /trial "$image" node --max-old-space-size=128 pledge-worker.mjs
