# PG04A existing Pudge batch

On 2026-11-28, the local PG03B inventory contained three identities. Each resource ID matched one resource in the isolated Trycove room; all three were unassigned and were disabled pending import and provider readiness. The private source file contained one provisioner key, three owner keys and three delegate keys. It did not contain either recipient key for any scenario. A user-only, hash-verified local copy was made outside the temporary directory. No keys are included in this record.

The existing `progress.json` listed the following transactions. A read-only query to `https://testnet.ckb.dev/` returned `committed` for each; the endpoint returned the expected Pudge genesis `0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606`. This confirms the node's reported transaction status; it does not establish a new tester payment or feedback.

| Step | Transaction hash |
| --- | --- |
| Owner funding | `0x241534b33e28201634bd6aae2474b41d2f8282d4d0330c0d1923b6b9755f8507` |
| Pocket 1 creation | `0x31283264488adc3d32268f3e9b9f87ac795e0de10b25d2b5c1732a82bcd82af8` |
| Pocket 1 funding | `0x7d522a175d4d30439675d714ae059b89c4f986b8a2a1aa90b8839902cfbb719b` |
| Delegate 1 fee cell | `0xe698ab2a04d36741f5b580e7e8ea16a02fce7ea23704c266c7c28173ae2a46c9` |
| Pocket 2 creation | `0xe88726d29e6547e3362c8889ee72a8077e4196c5ebf46fe381e81be542546f58` |
| Pocket 2 funding | `0x3a82847759b6f186b2e89c8481ce313dee273b5e2a6744cb7091591973e28156` |
| Delegate 2 fee cell | `0x693f921765de23bc39af1a4ab79ea3480c5f3fbc62b6b3980f3b7ccc9982e02f` |
| Pocket 3 creation | `0xaf4ad1f9f56b10bbd76e163e5a7fd271a7b08d2be8df04bd2438b14f5b73d311` |
| Pocket 3 funding | `0x2784a7b73eba70e58437e2f04a67f232484bd8f02873d19c1236542516e5e808` |
| Delegate 3 fee cell | `0x4461f586e59ad553f6affedf95feb7bfd347e4c857dd1e1909ec0a7807a251cd` |
