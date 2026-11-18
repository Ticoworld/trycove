# Trycove: Locked Product Direction and Delivery Roadmap

**Status:** Authoritative product roadmap, approved 2026-11-18  
**Repository:** `Ticoworld/trycove`  
**Implementation baseline:** `511e2a820bbb9b755a8762357c36d6450e648ef2` (TC-01E partial)  
**Companion contract:** [TRYCOVE_PRODUCT_CONTRACT.md](./TRYCOVE_PRODUCT_CONTRACT.md)

## 2026-11-18 milestone decision

**Verified remote baseline before this roadmap amendment:** `3d5ebbf759ffd21b5de559618911037978bc7801`. Codex Local completed the one bounded follow-up TC-01E Gate C attempt in `evidence/tc-01e/gate-c-functional/report.md`. The frozen query cohort produced 15 source-level hypotheses but no selected functional integration, adapter, or runtime experiment. TC-01E remains **PARTIAL**, with Gate C incomplete. The query matcher currently rejects all exact-operation matches for unproven added value; this result does not establish that the ecosystem contains no useful compositions.

**Decision:** Stop repeated TC-01E discovery scans. Preserve its existing code and evidence, retain functional integration as an unresolved product gap, and proceed directly to **TC-02 Guided Trial Rooms (Product → People)**. Prefer CrowdCell's published testnet application as the initial pilot, subject to confirming its live usability from the local browser. Do not infer a human tester from automated checks. After TC-02, implement TC-03 follow-through. Revisit meaningful product-to-product proof before any Tovarishch readiness claim, by explicit product decision rather than automatic further scanning.

**Execution environment:** Codex **Local**, working from the user's `main` checkout. Future work orders must be direct, targeted, and inspect only necessary files. Preserve necessary security and meaningful validation; do not re-read historical plans or repeat broad research.


## Non-negotiable mission

Trycove is the CKB ecosystem's **product connection, testing, and post-launch follow-through platform**. It helps software builders find complementary products, check whether real code can work together, put shipped products in front of real testers, document friction, and establish whether fixes and connections produced continued use.

The problem to solve is what happens **after software ships**: a working demo may have few users; compatible builders may never find each other; nobody records who tried the app, where they struggled, or whether they returned.

Trycove is not a GitHub issue tracker, PR tracker, activity dashboard, directory clone, matchmaking-only chatbot, or general software build farm.

Two first-class paths feed the same Outcome system:

1. **Product → Product:** Understand capabilities and consumer requirements, discover potentially useful functional connections, execute supported integrations, and track whether a builder adopted them.
2. **Product → People:** Make a real shipped app accessible to testers, guide genuine tasks, collect step-level observations, and track fixes and repeat participation. No second product or new SDK is required for this path.

Neither path is optional to the finished product.

## Permanent modules and experience

1. **Product Hub:** Canonical product identities, source-backed purpose, availability, demos, repository and version history. Reuse existing ecosystem infrastructure rather than rebuild it.
2. **Capability & Compatibility Engine:** Observe actual exports, RPC/API contracts, CKB script boundaries, transaction flows, configuration and consumer operations. A proposal must answer what A provides, what B needs, why it matters, through which exact interface and with which constraints.
3. **Integration Lab:** Reviewed and pinned source, restricted execution, actual consumer-to-provider behavior, positive and negative cases, adapter/configuration artifacts, reproducible receipts.
4. **Guided Trial Rooms:** Actual shipped app or permitted testnet experience, usable without a local CKB toolchain where practical, tasks tied to application/version and consented human feedback. Browser automation can assist but does not count as a human tester.
5. **Outcomes:** Append-only source/version history, observed runs and trial steps, follow-up state, re-tests, verified external integration/adoption and repeat participation. Distinguish these claims instead of conflating them.

Primary user journey: **Explore → Connect or Try → Results → Follow Through**. There are two paths, not a requirement that every app must first integrate something.

## Reuse and differentiation

| External service/tool | Reuse | What it cannot establish for Trycove |
| --- | --- | --- |
| [CKBdapps](https://ckbdapps.com/projects.json) | Project metadata, categories, demo and repo links, source inventory | The app actually works today, users completed a workflow, or two apps are compatible |
| [CKB Pulse](https://pulse-lab.lusocryptolabs.com/) | Source activity, freshness, newly followed repositories, contributors | App usability, integration success, user adoption or retained users |
| GitHub source and releases | Pinned implementation, interfaces, integration history and changes | Functional fitness from PR/issue mentions alone |
| [OffCKB](https://github.com/ckb-devrel/offckb), ckb-testtool, ckb-debugger, CCC | CKB local execution, protocol testing, application operations as needed | End-user value or external adoption |
| [Spark Verify](https://github.com/Akane-CN/spark-verify) | Optional declarative transaction acceptance checks when applicable | A sandbox for arbitrary source, product trials, or adopter evidence |
| [CKBoost](https://nervoscatalyst.org/ckboost) | Potential future source of tester campaigns and incentives | An integrated in-product trial environment or independently verified step-level friction |

**Fact correction:** Spark Verify's Spark grant proposal was rejected on 2026-11-05, but its repository describes it as independently maintained and released at v0.1.1 as of this roadmap. Do not assert that it died. Do not treat unverified claims about any other project's omissions as established fact.

Trycove's differentiation is the **connected discovery → usable test/integration → evidence → follow-through journey**, not the mere existence of matching, tests, activity charts, SDKs, or code generation.

## Current known implementation

At the TC-01E baseline `511e2a8`:

- CKBdapps ingestion and CKB Pulse snapshots feed a sourced Product Hub.
- Pinned source footprints and a narrow capability matcher exist.
- Grid3 → CKB Viz was found without a supplied target pair, but only demonstrates a read-only URL/deep-link adapter with pinned source and a declared CellDep hash. It does **not** prove a Grid3 transaction flow, actual provider deployment, CKB execution, user improvement, or new collaboration between unrelated builders. The two repositories have the same owner.
- Product Passports, connection and receipt navigation exist.
- The general synthetic trial runner and a separate offline script-group CKB experiment exist. Neither is a universally safe runnable integration environment.
- **No completed real Guided Trial Room, external participation, repeat-use evidence or verified adoption.**
- TC-01E Gate C remains **PARTIAL**. Do not upgrade its verdict merely because its URL tests passed.

Freeze the existing Grid3 URL example as a regression and fallback. Do not erase or embellish it. Do not select it as the flagship.

## Locked delivery order

### Phase 1: Close TC-01E, genuine Product → Product composition

**One bounded Codex Local engineering attempt (completed, PARTIAL).** Use existing repository and source evidence; do not start another indefinite discovery audit loop.

- Expand real source capability support beyond deep links to an appropriate **RPC/data-query** or **transaction/session-middleware** family. Exact choice must follow available real interfaces, not a predetermined named pair.
- Form and pin a fresh, independently selected, bounded evaluation cohort using explicit rules established *before* inspecting outcomes. Preserve prior cohort and evidence unchanged. Reject easy self/affiliate-only pairing as evidence of previously isolated builder collaboration.
- Find a functional consumer operation and a provider interface that together create a **new observable capability or measurable improvement** relative to the consumer's original execution. Just sharing CKB, CCC or a similar description is not enough.
- After discovery, check for existing implementation/prior art. PRs/issues are verification, never the starting-point selection algorithm.
- Execute the **actual consumer application logic through the actual provider SDK, RPC/data handler, or transaction-processing interface** under a constrained, reviewed execution profile. Use positive, negative and integration-specific cases.
- Output a real adapter/config/diff where applicable, pinned commits, all prerequisites, executable commands, expected vs observed results and honest evidence limitations.
- A public CKB transaction is **not always mandatory**. A genuine SDK-level, CKB-VM, local devnet, RPC or off-chain Fiber operation can count if the real source code and relevant behavior are exercised.
- Deep-link-only, format-only, static fixture-only, provider-alone, mock-only or hardcoded constants cases **cannot** close Gate C.
- Confirm a usable Product Passport → connection → Lab result path. Real user improvement must be demonstrated, not merely asserted.
- Preserve dependency and license restrictions; do not redistribute unlicensed upstream code. Do not weaken execution isolation or run arbitrary repository code from a public web request.

**Gate C PASS:** A new, source-backed, functionally meaningful composition between real consumer and provider behavior with reproducible positive/negative/integration outcomes, a real before/after functional difference, and an inspectable UI receipt.

**If blocked:** Preserve the best sound engineering result and publish specific failed attempts and technical constraints. Mark PARTIAL/FAIL/BLOCKED as appropriate. Do not manufacture PASS, cherry-pick a convenient pair, or loop endlessly. Return for a product decision instead of silently redefining the milestone.

### Phase 2: TC-02, Guided Trial Room, Product → People

Start from the preserved Phase 1 code and existing Product Hub. Select an actually accessible shipped CKB app based on demonstrable testnet/demo usability, supported browser/wallet boundaries and legal terms, not based on an open GitHub issue or PR.

Deliver:

- A real guided testing session linked to pinned app version/deployment where available.
- 3–4 genuine tasks that a human can attempt on the real application.
- Step-level outcomes: completed, failed, skipped, stuck, with optional notes, screenshots/logs or transaction evidence obtained with consent.
- Clear security boundaries. Never request secrets or automatically approve wallet signatures.
- Versioned, inspectable, append-only Session Receipts.
- Real human participation separated from automated Playwright checks. Do not fabricate testers, sessions or user friction.
- A usable tester journey, not a static checklist in a polished wrapper.

**TC-02 PASS** requires at least one actual tester session on a supported shipped app and accurate retained task/friction evidence. Automated checks alone are insufficient.

### Phase 3: TC-03, Outcomes and Return Loop

Unify Integration Lab and Trial Room records under versioned project identities and releases:

- Original trial or integration run and its specific problem.
- Maintainer change or new adapter/revision (verify rather than infer adoption).
- Repeat trial and comparison using equivalent tasks.
- Human return usage and external builder adoption, when independently observed.
- Explicit unknowns where no response, participation, or follow-through exists.

**TC-03 PASS** requires a genuine before/after outcome and a real return/re-test; never invent 3 users, a fix or a success story as illustrative data displayed as production evidence.

## Readiness to show Tovarishch

**Not ready at `511e2a8`.** A successful CI build, test count, SDK import, matched pair, container run, polished UI, public link or explanatory demo is not a sufficient case.

Show Tovarishch only when, on at least **two real CKB products or product journeys**, a reviewer can independently navigate the actual platform and see:

1. What the product is and why the capability or trial is relevant.
2. A functional connection with real execution evidence **or** a real guided user task, as appropriate.
3. What happened, including failure and source/version context.
4. Actual step-level participation and a documented re-test or follow-up outcome.
5. Accurate limits without screenshots masquerading as working software.

At least one credible Product → Product result and one credible Product → People result must be present across the readiness evidence. A real follow-up is essential.

Before approval, compare the work with the strongest plausible competing platform, not only its internal PASS checklist. If the system merely duplicates existing directory, activity, verification or matchmaking behavior, say NO.

## Engineering and review discipline

- Maintain the locked architecture and two-path mission. No drift into issue triage, PR watching, directory polishing, outreach-only service, or synthetic showcase.
- No unsupported confidence, inferred user demand, unverified deployment claims or invented adoption.
- Do not label challenges impossible until a bounded, safe attempt or direct technical evidence demonstrates the blocker. Equally, do not claim feasibility before it is proven.
- Make the smallest reusable change that produces a real capability, not the highest feature count.
- Protect previously passing work as a fallback and preserve reproducible evidence.
- Never call something done solely because tests, build, GitHub push, or route smoke passed.
- Progress reports must distinguish implementation, actual execution, human testing and real usage.
- One bounded Phase 1 attempt. If the genuine integration fails, report the result, stop further scope expansion and request an explicit directional decision. Do not defer TC-02 indefinitely through repeated intelligence redesigns.
