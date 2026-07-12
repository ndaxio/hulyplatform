# Customer Success Portal Run Status

run_label: `cssc-native-huly-portal-ui-r1`

iteration: 8 / 20

last_input: Approved production-ready native Customer Success portal plan.

last_action: Completed the native projection-space and paged transcript checkpoint. Public, internal, and restricted events now use dedicated private restricted typed spaces with exact role assignments; event, binding, projection-space, and role-mixin mutations are denied to non-system humans. The support Tracker project is private, non-auto-join, and role-pinned. The portal subscribes to all authorized lanes, uses issue/space/visibility-bound opaque cursors, preserves overlapping live head windows, drops stale pagination, and has no raw ChatMessage fallback. Shared agent credentials are limited to public/internal writes; restricted authorship remains disabled pending authenticated compliance provenance.

verified: CSSC-11 STATIC PASS remains current. CSSC-12 local gates pass: portal resources 79/79, model 9/9, locales 2/2, shared middleware 32/32, adapter 192/192 with one environment-only skip, and Python client 38/38. Scoped Rush builds pass for middleware plus portal resources (65 operations), the customer-success model (118 dependency operations), and production metadata wiring. Isolated mutations turn RED when restricted readiness, issue-bound cursor validation, or human forbid flags are removed. After two remediation rounds, fresh GPT-5.4 unit/mutation, regulated-security, and integration/UI checkers all APPROVED the final tree. The shared middleware package-wide formatter still reports pre-existing strict-lint debt outside this change; changed customer-success packages format cleanly.

next_human_decision: none - architecture correction is within the approved production-ready portal scope; merge and activation remain human gates.

branch: `codex/customer-success-portal`

worktree: `/private/tmp/huly-customer-success-portal`

base_commit: `101d5bddd`

live_workspace_id: `b55ff770-ea00-46e9-8dbd-ebb805940dd1`

task_keys: `CSSC-11`, `CSSC-12`, `CSSC-13`, `CSSC-14`, `CSSC-15`, `CSSC-16`, `CSSC-17`, `CSSC-18`, `CSSC-19`, `CSSC-20`

active_milestone: read-only conversation detail and timeline tracer

last_synced: `2026-07-12T21:52:52Z`

status: CSSC-11 is static-certified and awaiting authenticated desktop/mobile evidence. CSSC-12 is code-complete and independently approved for the dedicated projection-space, immutable binding/event, three-lane reader, and opaque pagination checkpoint. It remains open because neither draft branch is merged or deployed, concrete live spaces are not seeded, legacy bindings are not backfilled, authenticated desktop/mobile rendering and live role-matrix/mutation/two-page traces are outstanding, and restricted authorship still requires an authenticated compliance command design. No merge, deployment, or activation.
