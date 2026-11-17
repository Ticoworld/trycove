#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM="$ROOT/.data/ckb-explorer-cycle/upstream"
EXPLORER="$UPSTREAM/ckb-devnet-explorer"
CYCLES="$UPSTREAM/ckb-cycle-tools"
IMAGE="node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5"
EXPECTED_EXPLORER="b6aef5571bbe5a112b4809881a1b6229095f6da7"
EXPECTED_CYCLES="23182e2abce64d0574cae7acd3229bc87424d0d0"
for entry in "$EXPLORER:$EXPECTED_EXPLORER" "$CYCLES:$EXPECTED_CYCLES"; do
  path="${entry%:*}"; revision="${entry##*:}"
  [[ "$(git -C "$path" rev-parse HEAD)" == "$revision" ]] || { echo "Pinned source mismatch at $path" >&2; exit 1; }
done
docker image inspect "$IMAGE" >/dev/null

STAGE_ROOT="$ROOT/.data/ckb-explorer-cycle/staging"
mkdir -p "$STAGE_ROOT"
STAGE="$(mktemp -d "$STAGE_ROOT/run-XXXXXX")"
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT
mkdir "$STAGE/fixtures"
cp "$ROOT/experiments/ckb-explorer-cycle/run.mts" "$STAGE/run.mts"
cp "$ROOT/experiments/ckb-explorer-cycle/missing-dependencies.ts" "$STAGE/missing-dependencies.ts"
cp "$ROOT/experiments/ckb-explorer-cycle/fixtures/replay-testnet.json.br" "$STAGE/fixtures/replay-testnet.json.br"
chmod 755 "$STAGE" "$STAGE/fixtures"
chmod 644 "$STAGE/run.mts" "$STAGE/missing-dependencies.ts" "$STAGE/fixtures/replay-testnet.json.br"

OUT_DIR="$ROOT/evidence/ckb-explorer-cycle"
mkdir -p "$OUT_DIR"
docker run --rm \
  --pull=never \
  --network=none \
  --read-only \
  --cap-drop=ALL \
  --security-opt=no-new-privileges \
  --pids-limit=32 \
  --memory=768m \
  --cpus=1 \
  --user="$(id -u):$(id -g)" \
  --tmpfs=/tmp:rw,noexec,nosuid,size=32m \
  --mount "type=bind,src=$STAGE,dst=/workspace,readonly" \
  --mount "type=bind,src=$EXPLORER,dst=/upstream/ckb-devnet-explorer,readonly" \
  --mount "type=bind,src=$CYCLES,dst=/upstream/ckb-cycle-tools,readonly" \
  --workdir=/workspace \
  --env TRYCOVE_EXPLORER_ROOT=/upstream/ckb-devnet-explorer \
  --env TRYCOVE_CYCLE_TOOLS_ROOT=/upstream/ckb-cycle-tools \
  --env "TRYCOVE_RUNNER_USER=$(id -u):$(id -g)" \
  "$IMAGE" \
  /upstream/ckb-cycle-tools/node_modules/.bin/tsx /workspace/run.mts > "$STAGE/result.json"
digest="$(sha256sum "$STAGE/result.json" | cut -d' ' -f1)"
OUT="$OUT_DIR/execution.json"
if [[ -f "$OUT" ]]; then
  existing="$(sha256sum "$OUT" | cut -d' ' -f1)"
  if [[ "$existing" != "$digest" ]]; then OUT="$OUT_DIR/execution-$digest.json"; fi
fi
if [[ -f "$OUT" ]]; then
  [[ "$(sha256sum "$OUT" | cut -d' ' -f1)" == "$digest" ]] || { echo "Refusing to overwrite differing execution receipt $OUT" >&2; exit 1; }
else
  cp "$STAGE/result.json" "$OUT"
fi
sha256sum "$OUT" > "$OUT.sha256"
echo "Wrote $OUT"
cat "$OUT.sha256"
