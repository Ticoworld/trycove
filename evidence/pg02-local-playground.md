# PG02 local Playground acceptance

On 2026-11-26 an isolated Neon branch and local development servers were used for a browser-driven acceptance run. A fresh, retired-on-claim identity opened QuotaCell through an allocation-bound, single-use handoff without a wallet extension. The browser reviewed and submitted a 61 CKB Pudge payment, then recorded and published a tester-approved feedback report on the isolated database.

Transaction `0x13456777cb3a4dfb92c3a7bf9fbff4dc478c7cc639fc2dd7399359ed154477e2` was committed in canonical block `0x8131b61012be1cf513ce2a84c8b75d2de19937bd6fd657590f805e92de17e4c3`. The resulting policy and fund cells were live: 195 CKB protected, 61 CKB paid to the approved recipient, and 61/122 CKB used for both shared and delegate allowances. This is a testnet observation through the primary Pudge RPC, not a security audit or proof of finality.

The exchange tests cover invalid session authorization, wrong application origin or credential, replay, expiry and concurrent redemption. The local receiver is enabled only in development and production remains gated. The test identity and handoff credentials are not contained in this record.
