# Trycove Trial Studio: Design Direction and Acceptance Contract

Version: 2026-11-19 | Workstream: TC-02B visual and interaction correction | Status: Design brief, not a claim of implemented UI

## The product and the actual problem

Trycove helps people use shipped CKB products, report friction, and give builders actionable, source-linked evidence. A tester should feel that they are *trying Owl Pilot with a helpful guide*, not completing an application or inspecting a database. The real product under test remains on its own origin. Trycove does not verify wallet activity simply because the external page was opened.

The existing session database, secure cookie access, append-only observations, versioned receipts, and four source-backed Owl Pilot tasks must survive. The new surface is a product experience; the cryptographic receipt is technical evidence for later inspection.

## Non-negotiable design diagnosis from the November 19 screenshot

The current UI is a color change plus a template: white site-wide navigation on top of a mostly empty black canvas; very narrow content for a wide desktop; giant top and side voids; four identical outline boxes; uppercase decorative captions; duplicate brand labels including `TRYCOVE / TRIAL STUDIO`; native details carets that read like documentation; text-first instructions and disclaimers; and a visible horizontal scrollbar. It feels auto-generated because it relies on identical card shapes and filler metadata, not on a clear hierarchy between *the product*, *what to do*, and *how to report it*.

Remove, do not restyle, the following on the focused Trial Studio routes:

- Global `Problem Map / Explore / Connect / Try / Results / About` navigation and generic site footer.
- `A GUIDED PRODUCT TRIAL`, `TRYCOVE / TRIAL STUDIO` and any other ornamental uppercase eyebrow label.
- Four equal cards as the main task preview; repeating arrows and decorative final punctuation on hero text.
- Native `<details>` disclosure carets in the primary presentation. Use one intentional, accessible secondary help/privacy surface.
- Black void as a design strategy, raw SHA-256 above the fold, giant forms, mandatory consent checkbox, and redundant manual save buttons.
- Horizontal overflow at any viewport, including laptop widths.

## Design north star

**A guided action workspace, not a landing page.** Think of a lightweight companion for trying real products. It should combine the task clarity of usability-testing platforms, the visual discipline of a high-quality productivity tool, and the quick action vocabulary of a command palette. Never copy another product's visual trade dress or reuse a proprietary screenshot as an asset without rights.

### Real references and the principle to borrow

- Maze, live website tests and prototype missions: a concrete task, a distinct end-task action, and clear reporting of whether the goal was reached. https://help.maze.co/articles/1630964148-interacting-with-a-website-test and https://help.maze.co/articles/9232304364-prototype-test-setting-up-a-prototype-test-block
- UserTesting, participant experience: people interact with the actual product and report observations. https://help.usertesting.com/hc/en-us/articles/25569512843421-Inside-the-participant-experience-What-testers-see-and-do
- Linear: restrained, information-first hierarchy, keyboard and focus clarity. https://linear.app/now/behind-the-latest-design-refresh
- Raycast: concise actions and unobtrusive secondary controls. https://www.raycast.com/blog/a-fresh-look-and-feel
- Anthropic frontend-design skill: resist AI defaults, plan/critique/design twice, keep one memorable focal element. https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
- Vercel web-interface guidelines: functional affordances, clear failure/recovery states, mobile/accessibility discipline. https://github.com/vercel-labs/web-interface-guidelines

## Creative direction

**Trycove, a calm active testing workspace.** Do not repeat either the previous beige-and-green form or the rejected pure-black/acid-green landing page. Start from a deliberate hybrid system rather than one giant blank background: an unobtrusive dark outer shell, a high-readability task stage, and sparing green/teal only for actual actions and progress. Neutral color, size, spacing, and content hierarchy should do most of the work. This is not an instruction to force a specific final palette if real screen review shows a better solution.

Suggest initial tokens, to be evaluated on real screenshots:

- `shell`: #111719, subtle deep charcoal, never used as a giant content void
- `stage`: #F5F7F4, warm-neutral high legibility
- `ink`: #172221
- `secondary`: #63716B
- `accent`: #087F68, used for actionable focus/progress, with contrasting text
- `line`: #D8E0DA
- `error`: #A34137; `warning`: #8B5E22, distinct from success

Typography: intentionally choose one highly legible primary family with excellent small-size support and a display treatment that is characteristic but restrained. Avoid all-caps micro-headings and monospaced meta spam. Target clear reading at actual laptop viewport sizes, not a tiny designer zoom.

Motion: 150–250 ms for ordinary interactions, restrained direction-aware transitions, no perpetual animation, no fake wait states. Animate a single purposeful focal transition per task. Support reduced motion and keyboard accessibility.

## Layout concept and screens

### 1. Entry: a testing invitation, not a marketing hero

Desktop composition should use available space deliberately. On a typical 1440 x 900 window, show the product identity, short genuine task preview, start and resume above the fold. A visually meaningful compact preview of the live target's purpose is allowed, but never invent app functionality or insert fake activity. Avoid rows of equal cards.

Suggested information hierarchy:

1. Minimal focused top bar: Trycove wordmark on left; small `Back to project` text link on right. No global navigation.
2. Product identity: Owl Pilot with small `CKB Testnet` context, but no loud category label.
3. One strong invitation: `Try Owl Pilot` and one sentence describing the practical goal.
4. The four things people will explore as a small connected sequence or numbered sentence list: account, permissions, allowance, recovery. This is an orientation preview, not a checklist form.
5. Prominent `Start testing` button and a one-line truthful privacy/testnet disclosure.
6. `Resume your trial` only if an accessible session exists. Show no broken link-only illusion.
7. Safety/privacy appears in an accessible help popover/sheet when requested, not an obligatory modal gate.

### 2. Active task: a contained workspace

A participant should see the task objective and feedback immediately. No desktop scrolling should be required to find the primary controls at 1366 x 768 for ordinary tasks.

Suggested desktop hierarchy:

```text
Trycove                                      Owl Pilot   [Exit]
────────────────────────────────────────────────────────────────
[1 Account] ─── [2 Permissions] ─── [3 Allowance] ─── [4 Recovery]

Find which account is yours.
Open Owl Pilot and look for the owner and app-facing account.

[Open Owl Pilot]     [Pop out guide]     [? Need a hint]

How did it go?
[Worked]    [Something failed]    [Got stuck]    [Couldn't try]

[Back]                                      [Continue when saved]
```

This is an information architecture sketch, not a direction to surround everything with outlined cards. Layout should have one dominant content region. In a wide viewport a compact contextual app panel or secondary rail may be used if it actually improves task completion. On mobile, the same goal and feedback must remain obvious without a hover interaction.

Outcome selection should feel decisive and tactile. After selection, persist the outcome before enabling forward navigation. Offer one contextual prompt (failure reason, confusion location, or unavailable prerequisite) with optional short detail; do not dump a form. Use an intentional sheet only when it helps, and never force a popup per task. Don't imply external success was automatically verified.

### 3. Companion: optional utility, not the visual centerpiece

On compatible desktop Chrome, `Pop out guide` opens a compact floating, independently readable instruction and feedback surface using Document Picture-in-Picture. It is a **Trycove** companion, never an iframe into or inspector of Owl Pilot. If permission is denied or API unsupported, continue with normal tabs and return affordances. This enhancement must not derail the main task flow.

### 4. Completion: user summary, then evidence on demand

A humane summary of outcomes and useful notes: which steps worked, failed, were blocked, or weren't tried. One final `Finish trial` action states that it locks further editing. After finishing, show an actual completed state, not just a list of logs. The digest, event history, build/network limitations, and full receipt belong behind a builder-oriented `Evidence details` surface, still fully verifiable.

## Implementation and data constraints

- Existing evidence semantics and privacy boundaries remain. No public exposing of session text or secret tokens.
- A session must never be lost because a router transition stalls. Fix reliably before visual polish claims.
- Reuse the existing server store and receipt logic; do not add a second incompatible session persistence layer.
- Preserve historic sessions and old receipt versions.
- Autosave failure is visible, recoverable, and never silently represented as a success.
- Opening Owl Pilot or Freight is not proof of completion. Do not require live signing, funds or account data.
- Remove the generic site navigation only on Trial Studio routes, not across the whole Trycove product.
- If screenshot capture can run through headless Chromium when an interactive Chrome approval is blocked, use it and report that limitation precisely.

## Quality gates for this redesign

1. **Visibly different**: the entry and active task do not resemble the old four-card grid, narrow hero, black void, global nav or receipt-first form.
2. **Full viewport tested**: use a real 1366 x 768 desktop browser screenshot and 390 x 844 mobile screenshot. No horizontal scrollbar. Primary task actions visible without desktop scrolling.
3. **Real journey**: Start once, navigate to Task 1, report failure and success, optional note, refresh/recover, finish, view summary/evidence. Verify network-backed persistence, not optimistic UI only.
4. **Interaction**: inspect actual transitions, focus, keyboard, reduced motion, modal placement and note save/error recovery. No claim of polish from a build passing.
5. **Safety**: no private evidence leakage, no false claim of live wallet behavior, no data lost and no old receipt breakage.
6. **Final self-critique**: name three visible design mistakes found in screenshots and correct them before finalizing. Do not write an empty self-critique.
7. **Delivery**: commit and push only after checking the actual local branch, preserving the existing uncommitted work as a recovery snapshot. Report full SHA, remote branch, clean/dirty tree, screenshots and exact remaining gaps.

## Scope protection

This is one focused correction to TC-02B. It is not permission to rebuild the whole site, design a new brand, invent a dashboard, conduct more project discovery, change source taxonomies or start TC-03. The goal is a coherent, beautiful, fast and trustworthy real-world test journey that we can show a builder, then freeze for actual human acceptance.
