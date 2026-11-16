#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
container=trycove-semantic-${tmp##*/}
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap cleanup EXIT
chmod 755 "$tmp"
mkdir "$tmp/git-template"
git -c init.templateDir="$tmp/git-template" init -q "$tmp/dripfund"
git -c init.templateDir="$tmp/git-template" init -q "$tmp/cellora"
GIT_TERMINAL_PROMPT=0 timeout 90s git -C "$tmp/dripfund" -c core.hooksPath=/dev/null -c protocol.file.allow=never fetch -q --depth 1 --no-tags https://github.com/adisuyash/ckb-notes.git 34241019e35f4e4f00f505f5b6aac24619a1f400
GIT_TERMINAL_PROMPT=0 timeout 90s git -C "$tmp/cellora" -c core.hooksPath=/dev/null -c protocol.file.allow=never fetch -q --depth 1 --no-tags https://github.com/Antismart/cellora.git a534c38f248c0406eeafee94adadb8c2c9072f8a
test "$(git -C "$tmp/dripfund" rev-parse FETCH_HEAD)" = 34241019e35f4e4f00f505f5b6aac24619a1f400
test "$(git -C "$tmp/cellora" rev-parse FETCH_HEAD)" = a534c38f248c0406eeafee94adadb8c2c9072f8a
mkdir -p "$tmp/dripfund/buy-me-a-coffee/backend/services" "$tmp/cellora/crates/api/src/routes" "$tmp/cellora/crates/db/src"
git -C "$tmp/dripfund" show 34241019e35f4e4f00f505f5b6aac24619a1f400:buy-me-a-coffee/backend/services/indexer.ts > "$tmp/dripfund/buy-me-a-coffee/backend/services/indexer.ts"
git -C "$tmp/dripfund" show 34241019e35f4e4f00f505f5b6aac24619a1f400:buy-me-a-coffee/backend/package-lock.json > "$tmp/dripfund/buy-me-a-coffee/backend/package-lock.json"
git -C "$tmp/cellora" show a534c38f248c0406eeafee94adadb8c2c9072f8a:crates/api/src/routes/cells.rs > "$tmp/cellora/crates/api/src/routes/cells.rs"
git -C "$tmp/cellora" show a534c38f248c0406eeafee94adadb8c2c9072f8a:crates/db/src/cells.rs > "$tmp/cellora/crates/db/src/cells.rs"
git -C "$tmp/cellora" show a534c38f248c0406eeafee94adadb8c2c9072f8a:LICENSE.md > "$tmp/cellora/LICENSE.md"
timeout 90s npm pack @ckb-ccc/core@1.12.2 --ignore-scripts --silent --pack-destination "$tmp" >/dev/null
node "$root/scripts/semantic-check-source.cjs" "$tmp/cellora" "$tmp/ckb-ccc-core-1.12.2.tgz" "$tmp/dripfund/buy-me-a-coffee/backend/package-lock.json"
mkdir "$tmp/input"
node "$root/scripts/semantic-prepare.cjs" "$tmp/dripfund/buy-me-a-coffee/backend/services/indexer.ts" "$tmp/input/dripfund-indexer.js"
cp "$root/scripts/semantic-fixture.cjs" "$tmp/input/semantic-fixture.cjs"
chmod -R a+rX "$tmp/input"
image='node@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5'
docker image inspect "$image" >/dev/null
sha256sum "$tmp/input/dripfund-indexer.js" "$tmp/input/semantic-fixture.cjs" | sed "s#$tmp/input/##"
printf 'Executing reviewed DripFund function in network-disabled container; image %s\n' "$image"
timeout --signal=TERM --kill-after=5s 30s docker run --rm --name "$container" --pull=never --network none --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 64 --memory 128m --cpus 1 --user 65534:65534 --mount "type=bind,src=$tmp/input,dst=/input,readonly" --tmpfs /tmp:rw,noexec,nosuid,size=16m "$image" node /input/semantic-fixture.cjs
