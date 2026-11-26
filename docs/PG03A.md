# Playground handoff configuration

Apply migration 0025 before using this version. Set `TRYCOVE_PLAYGROUND_APPLICATIONS` on the Trycove server to a JSON object keyed by the public application ID in each room's prepared-resource settings. Each entry has an exact `origin` and a distinct `secret` of at least 32 characters. Do not put secrets in a room definition or browser configuration. HTTPS origins are supported; HTTP is limited to loopback for local development. The existing `TRYCOVE_PLAYGROUND_APP_ORIGIN` and `TRYCOVE_PLAYGROUND_APP_SECRET` settings remain available for rooms without an application ID.

The receiving application announces `{type: 'trycove-playground-ready', version: 1}` to its exact Trycove opener origin. Trycove responds with a single-use handoff token to the exact configured application origin. The application redeems it server to server with its application ID and bearer credential. A new handoff replaces previous tickets for the allocation; it does not change the allocation or extend its expiry. Applications must retain their own transaction reconciliation and enforce expiry. Expiry in Trycove does not revoke a blockchain key.

The project owner reported an inconsistency in QuotaCell transaction history during the earlier journey. This is feedback for the application; its cause and scope have not been independently established in this change.
