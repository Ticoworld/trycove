# Working in Trycove

Use the existing checkout; cloud tasks are already isolated. Read README and docs/TC-01.md. Preserve the distinction between upstream claims, hypotheses, independent tests and adoption. Never invent chain identifiers, test results or maintainer responses. Do not execute user-submitted code in the server. Migrate schema changes and test behavior. Do not expose the unauthenticated ledger publicly.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
