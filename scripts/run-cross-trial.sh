#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git clone -q https://github.com/tydeptrai21042004/CellGuard.git "$tmp/cellguard"
git -C "$tmp/cellguard" checkout -q 2bb3182adb1a5d00bca24e2068f790a50e8e2d70
git clone -q https://github.com/alesfer001/CrowdCell.git "$tmp/crowdcell"
git -C "$tmp/crowdcell" checkout -q 0835ad42decf2c9594fa92a185eea4cee9eba622
CELLGUARD_DIR="$tmp/cellguard" CROWDCELL_DIR="$tmp/crowdcell" "$root/node_modules/.bin/tsx" "$root/scripts/cross-project-trial.ts"
