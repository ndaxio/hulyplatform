# Customer Success Portal Run Status

run_label: `cssc-native-huly-portal-ui-r1`

iteration: 5 / 20

last_input: Approved production-ready native Customer Success portal plan.

last_action: Completed the CSSC-12 partial-checkpoint maker/checker loop. The detail tracer now applies fail-closed transcript filtering in the Huly query, provides separate transcript and activity lanes, preserves query-state navigation, and includes keyboard-accessible mobile tabs. The final UI/accessibility checker passed; the security completion gate remains intentionally open.

verified: CSSC-11 STATIC PASS remains current. CSSC-12 maker tests pass: resources 61/61, model 6/6, locale 2/2, resource registration covered, stale-request race covered, query shape pinned, resource formatting passes, and the 391-project aggregate build passes. The final UI/accessibility checker passed. Authenticated desktop/mobile rendering and the authoritative transcript security contract remain pending.

next_human_decision: none - architecture correction is within the approved production-ready portal scope; merge and activation remain human gates.

branch: `codex/customer-success-portal`

worktree: `/private/tmp/huly-customer-success-portal`

base_commit: `101d5bddd`

live_workspace_id: `b55ff770-ea00-46e9-8dbd-ebb805940dd1`

task_keys: `CSSC-11`, `CSSC-12`, `CSSC-13`, `CSSC-14`, `CSSC-15`, `CSSC-16`, `CSSC-17`, `CSSC-18`, `CSSC-19`, `CSSC-20`

active_milestone: read-only conversation detail and timeline tracer

last_synced: `2026-07-11T23:35:21Z`

status: CSSC-11 is static-certified and awaiting authenticated desktop/mobile evidence. CSSC-12 has a local fail-closed partial tracer; it is not complete because public/internal/restricted lanes, authoritative provenance, stable backend event ordering, pagination, and rendered evidence remain open. No merge, deployment, or activation.
