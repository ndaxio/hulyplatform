# Customer Success Portal Run Status

run_label: `cssc-native-huly-portal-ui-r1`

iteration: 15 / 20

last_input: Approved production-ready native Customer Success portal plan.

last_action: Certified the local CSSC-15D terminal and reopen lifecycle checkpoint across the native portal, Huly adapter, and chat orchestrator. Guarded terminal actions require immutable creator identity, current support authorization, exact issue and lifecycle snapshots, and atomic Huly commit proof. Terminal state is reconciled into Cosmos only when trusted lifecycle generation and concurrency evidence are present; missing or stale evidence preserves the current active or queued session. JSON, SSE, and polling transports carry lifecycle generation, reason, and the one-time CSAT prompt. Reopen starts a new lifecycle generation, while generation-scoped CSAT keys prevent a prior closure from suppressing feedback for a later support cycle.

verified: CSSC-11 through CSSC-14 and CSSC-15A/B/C local certifications remain current. Portal model tests pass 9/9, asset and locale tests pass 3/3, portal resources pass 136/136, and the scoped Node 22 Rush build passes all 120 dependency operations. The adapter passes 272 of 273 tests with one environment-only skip. The orchestrator passes all 205 suites and 3469 tests; its TypeScript build, Prettier check, and diff check pass. Adversarial coverage includes forged action provenance, unsupported and stale transitions, terminal reconciliation without trusted generation or ETag, newer Cosmos lifecycle preservation, generation-scoped CSAT, JSON and SSE parity, and the owned no-local-session polling path. Independent concurrency, regulated-security, native-Huly UX/accessibility, and cross-system lifecycle reviewers APPROVED the remediated local trees.

next_human_decision: none - architecture correction is within the approved production-ready portal scope; merge and activation remain human gates.

branch: `codex/customer-success-portal`

worktree: `/private/tmp/huly-customer-success-portal`

base_commit: `101d5bddd`

live_workspace_id: `b55ff770-ea00-46e9-8dbd-ebb805940dd1`

task_keys: `CSSC-11`, `CSSC-12`, `CSSC-13`, `CSSC-14`, `CSSC-15`, `CSSC-16`, `CSSC-17`, `CSSC-18`, `CSSC-19`, `CSSC-20`

active_milestone: terminal and reopen controls

last_synced: `2026-07-13T06:27:00Z`

status: CSSC-11 and CSSC-12 remain open on their documented deployment and authenticated evidence gates. CSSC-13 remains open until authenticated desktop/mobile and screen-reader evidence plus a representative large-queue query/render trace are recorded. CSSC-14 and CSSC-15A/B/C/D are locally code-certified but still require authenticated two-agent contention evidence, real Huly `TxApplyIf` log proof, and a live Huly-plus-Cosmos two-sweep trace. The external widget must preserve `liveAgent.lifecycleGeneration` and echo it to `/api/csat` when `showCSATPrompt` is true before activation. No merge, deployment, live seed/backfill, or activation.
