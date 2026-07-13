# Customer Success Portal Run Status

run_label: `cssc-native-huly-portal-ui-r1`

iteration: 17 / 20

last_input: Approved production-ready native Customer Success portal plan.

last_action: Completed the local CSSC-16 maker/checker remediation across the Huly portal and adapter worktrees. Public reply and Internal note remain browser-created `SupportActionRequest` intents in the internal projection space, with exact creator/request/delivery binding, SHA-256 payload integrity, fresh-id terminal-failure retries, reconnect refresh, and trusted public/internal event reconciliation. Adapter recovery now proves the exact action request, commit marker, body, author, digest, and event id without a bounded history scan.

verified: CSSC-11 through CSSC-15D local certifications remain current. CSSC-16 portal resources tests pass 146/146, portal model tests pass 9/9, asset/locale tests pass 3/3, adapter tests pass 287/287 with one existing environment-only skip, and the scoped Node 22 Rush dependency build passes. Composer coverage includes canonical ids, creator/payload binding, Person/account assignee compatibility, separate public/internal eligibility, failed-request id rotation, delivered-state duplicate suppression, exact proof after more than 200 unrelated requests, forged body/author rejection, translated accessible controls, and the no-raw-write/no-token UI contract. `svelte-check` still reports only the previously recorded typing issues in `conversation-detail.ts`, its tests, one existing ConversationDetail cast, and upstream `contact-resources`; no composer-specific error is present.

next_human_decision: Review the checker-certified draft PR updates. Merge, deployment, live model seed/backfill, and activation remain human gates.

branch: `codex/customer-success-portal`

worktree: `/private/tmp/huly-customer-success-portal`

base_commit: `101d5bddd`

live_workspace_id: `b55ff770-ea00-46e9-8dbd-ebb805940dd1`

task_keys: `CSSC-11`, `CSSC-12`, `CSSC-13`, `CSSC-14`, `CSSC-15`, `CSSC-16`, `CSSC-17`, `CSSC-18`, `CSSC-19`, `CSSC-20`

active_milestone: CSSC-16 local certification and authenticated live evidence preparation

last_synced: `2026-07-13T07:36:04Z`

status: CSSC-11 and CSSC-12 remain open on their documented deployment and authenticated evidence gates. CSSC-13 remains open until authenticated desktop/mobile and screen-reader evidence plus a representative large-queue query/render trace are recorded. CSSC-14 and CSSC-15A/B/C/D are locally code-complete, and CSSC-16 is locally checker-certified by the portal UX, adapter security/durability, and cross-repository contract reviewers. Before activation they still require authenticated desktop/mobile and screen-reader evidence, two-agent contention, public reply customer-visibility proof, internal note customer-exclusion proof, failed-retry and refresh/reconnect duplicate proof, real Huly `TxApplyIf` logs, and a live Huly-plus-Cosmos two-sweep trace. The external widget must preserve `liveAgent.lifecycleGeneration` and echo it to `/api/csat` when `showCSATPrompt` is true. No merge, deployment, live seed/backfill, or activation.
