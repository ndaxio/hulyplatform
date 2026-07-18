# Customer Success Portal Run Status

run_label: `cssc-native-huly-portal-ui-r1`

iteration: 19 / 20

last_input: Approved production-ready native Customer Success portal plan.

last_action: Implemented the local CSSC-18 realtime recovery slice in the Huly portal. Inbox refresh now retains last-good queue content while bounded project, viewlet, and current-filter probes drive explicit outage state and proven project absence fails closed. Public, internal, and restricted drafts survive close/reopen in a bounded memory-only cache keyed by account plus ticket. Transcript updates preserve the live or historical scroll anchor, stale deferred restores are sequence-gated, and pagination failures retain loaded messages with an in-place retry.

verified: CSSC-11 through CSSC-17 local certifications remain current. CSSC-18 portal resources tests pass 161/161. Public behavior tests cover live-edge and mid-history append behavior, prepend anchoring, ticket/action draft isolation, cache eviction, cross-account restricted-draft denial, last-good outage state, and fail-closed access revocation. Mutations that forced every reader to the live edge or disabled cache eviction both made focused tests fail. Independent UX/resilience and security/durability re-reviews approve the remediated delta with no code blockers. Repository formatting and ESLint pass on the eight changed source/test files. `svelte-check` reports no CSSC-18-specific error; only the previously recorded portal and upstream baseline remains.

next_human_decision: Review the checker-certified draft PR updates. Merge, deployment, live model seed/backfill, and activation remain human gates.

branch: `codex/customer-success-portal`

worktree: `/Users/bilalhammoud/Documents/Huly/cssc-17-portal`

base_commit: `101d5bddd`

live_workspace_id: `b55ff770-ea00-46e9-8dbd-ebb805940dd1`

task_keys: `CSSC-11`, `CSSC-12`, `CSSC-13`, `CSSC-14`, `CSSC-15`, `CSSC-16`, `CSSC-17`, `CSSC-18`, `CSSC-19`, `CSSC-20`

active_milestone: CSSC-18 local certification and authenticated realtime evidence preparation

last_synced: `2026-07-18T11:21:49Z`

status: CSSC-11 through CSSC-13 remain open on their documented deployment, authenticated rendering, and performance evidence gates. CSSC-14 through CSSC-16 remain locally code-complete. CSSC-17 remains open on authenticated restricted retrieval/denial, compliance sign-off, retention/export, backup/restore, and live no-leakage evidence. CSSC-18 is locally implemented and independently checker-approved, but remains open on authenticated transport-outage versus ACL-revocation semantics, rendered desktop/mobile scroll and focus checks, close/reopen draft recovery, pagination retry, and reconnect duplicate testing. CSSC-19 production states, accessibility, localization, and performance is next. No merge, deployment, live seed/backfill, production task update, or activation.
