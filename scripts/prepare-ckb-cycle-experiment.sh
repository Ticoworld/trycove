#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM="$ROOT/.data/ckb-explorer-cycle/upstream"
EXPLORER_REV="b6aef5571bbe5a112b4809881a1b6229095f6da7"
CYCLES_REV="23182e2abce64d0574cae7acd3229bc87424d0d0"
mkdir -p "$UPSTREAM"
tmp="$(mktemp -d "$UPSTREAM/.prepare-XXXXXX")"
cleanup() { rm -rf "$tmp"; }
trap cleanup EXIT

prepare_one() {
  local name="$1" url="$2" revision="$3" destination="$UPSTREAM/$1"
  if [[ -e "$destination" ]]; then
    [[ -d "$destination/.git" ]] || { echo "$destination exists but is not a Git checkout" >&2; return 1; }
    local current
    current="$(git -C "$destination" rev-parse HEAD)"
    [[ "$current" == "$revision" ]] || { echo "$name checkout is at $current; expected $revision; leaving it untouched" >&2; return 1; }
    return 0
  fi
  git clone --no-tags "$url" "$tmp/$name"
  git -C "$tmp/$name" checkout --detach "$revision"
  [[ "$(git -C "$tmp/$name" rev-parse HEAD)" == "$revision" ]]
  npm --prefix "$tmp/$name" ci --ignore-scripts --no-audit --no-fund
  [[ -f "$tmp/$name/package-lock.json" ]]
  mv "$tmp/$name" "$destination"
}

prepare_one ckb-devnet-explorer https://github.com/wildanrhmn/ckb-devnet-explorer.git "$EXPLORER_REV"
prepare_one ckb-cycle-tools https://github.com/luongthanhtung03/ckb-cycle-tools.git "$CYCLES_REV"
echo "Pinned upstream checkouts and lockfile dependencies are ready under $UPSTREAM"
