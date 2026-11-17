# Trycove Product Contract

This document defines the product boundary used by TC-01E. It is an implementation constraint; working routes and evidence take precedence over aspirational labels.

## Product modules

| Module | Purpose | Input | Output |
|---|---|---|---|
| Product Hub | Understand existing products and their public claims | CKBdapps records, linked repositories, bounded Pulse snapshots | Product Passports with provenance and unknowns |
| Capability & Compatibility Engine | Discover complementary functional interfaces | Pinned source observations, declared requirements, network and dependency evidence | Explainable connection hypotheses, compatibility prerequisites, prior-art status |
| Integration Lab | Prepare and run bounded technical proofs | Reviewed source pins, adapter specification, fixtures, trusted execution profile | Append-only receipts, outputs, failures, reproduction instructions |
| Trial Rooms (future) | Let people exercise real applications through guided tasks | Shipped application or integration | Actual task results and tester reports; no simulated sessions in TC-01E |
| Outcomes | Track what followed a proposal or trial | Verified revisions, follow-ups, repeated tests and participation records | Evidence-backed progress; no inferred adoption |

Primary user journey: **Explore → Connect → Try → Results**. A workspace may offer a no-match or unsupported result. Empty evidence means unknown, not failure.

## Data and evidence levels

- **Imported claim:** A source states a product description, category, deployment, demo, need or capability. The source URL, source revision or content digest, observation time and original record remain attached.
- **Source observed:** A bounded analyzer found a declaration, call, dependency or configuration at an immutable repository revision. This does not prove runtime behavior or a live deployment.
- **Hypothesis:** Trycove proposes a useful relationship from a specific consumer requirement and provider interface. The exact source locations, adapter boundary, assumptions and unsupported cases must be inspectable.
- **Executed evidence:** A controlled experiment ran pinned code and records the actual command, environment, inputs, outputs and limitations. Test success is limited to that environment.
- **Independent reproduction:** A separate run or reviewer reproduces the experiment. Do not infer this from a hash or local rerun alone.
- **Adoption:** A separate party actually uses the result. Downloads, Pulse activity, a maintainer demonstration and a merged PR alone do not prove adoption.

Lifecycle/prior-art state and technical compatibility are separate. A testnet demonstration can be real while mainnet readiness remains unknown. Repository activity is activity context, not proof of operation, integration or adoption.

## Interfaces and identity

Products are canonical source records. Repository and domain links are many-to-many claims, not product identities. Use source-local identifiers such as CKBdapps slugs; resolve repository renames only from authoritative repository metadata, preserving the prior URL and resolution evidence. Do not merge products on name, keyword, website or repository similarity alone.

Candidate discovery starts from source-observed provider interfaces and consumer requirements. Issues, pull requests, releases and announcements are consulted only after a candidate exists, to reconcile prior work. Shared language, CKB network labels, CCC usage, or repository activity are insufficient to establish a connection.

## Execution and security boundaries

Dependency acquisition and source review happen outside the untrusted execution phase. Execution requires pinned full commits, inspected licenses, bounded resources, no credentials, no host home-directory access, no privilege, restricted writes, controlled output and no network by default. Public web requests never start a code execution. The existing synthetic runner remains restricted to its fixed trusted worker; a trusted upstream execution profile is a separate explicit mode and is not a general-purpose command API.

If a dependency cannot be safely prepared, the run is `not executed` and its receipt must say why. Synthetic tests, static analysis and mock services are labeled at their actual evidence level.

## TC-01E scope

TC-01E advances the Product Hub, capability-first connections, one reusable execution path, and a connected product experience. It does not claim Trial Rooms, ongoing adoption measurement, general repository understanding, or arbitrary integration support are complete. Earlier histories, opportunities, source observations and trial receipts remain append-only evidence.
