#!/usr/bin/env bash
set -euo pipefail
revision=2bb3182adb1a5d00bca24e2068f790a50e8e2d70
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git clone --quiet https://github.com/tydeptrai21042004/CellGuard.git "$tmp/cellguard"
git -C "$tmp/cellguard" checkout --quiet "$revision"
cd "$tmp/cellguard"
node --test tests/crowdcell-bridge.test.mjs
