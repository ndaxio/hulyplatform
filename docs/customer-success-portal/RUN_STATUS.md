# Customer Success Portal Run Status

run_label: `cssc-native-huly-portal-ui-r1`

iteration: 6 / 20

last_input: Approved production-ready native Customer Success portal plan.

last_action: Replaced the raw-comment transcript tracer with the first materialized ConversationEvent projection slice. The model registers an immutable event contract, the browser subscribes only to schema-v1 public projection documents, classification fails closed, canonical order is occurredAt plus eventId, and the subscription is bounded to 100 rows. The cross-repo writer and role-space contract is documented in PROJECTION-CONTRACT.md.

verified: CSSC-11 STATIC PASS remains current. CSSC-12 projection maker tests pass: resources 62/62, model 7/7, locale 2/2, query class/shape and component wiring pinned, unknown schema and lanes fail closed, immutable tuple ordering covered, newest-100 bound covered, package formatting passes, and the 391-project aggregate build passes. Fresh unit/mutation and UI/accessibility checkers PASS. Security approves an explicitly partial checkpoint only and blocks completion on the writer, role spaces, human mutation forbids, PII evidence, lanes, and cursors. Authenticated desktop/mobile rendering remains unavailable because the in-app browser could not attach a tab.

next_human_decision: none - architecture correction is within the approved production-ready portal scope; merge and activation remain human gates.

branch: `codex/customer-success-portal`

worktree: `/private/tmp/huly-customer-success-portal`

base_commit: `101d5bddd`

live_workspace_id: `b55ff770-ea00-46e9-8dbd-ebb805940dd1`

task_keys: `CSSC-11`, `CSSC-12`, `CSSC-13`, `CSSC-14`, `CSSC-15`, `CSSC-16`, `CSSC-17`, `CSSC-18`, `CSSC-19`, `CSSC-20`

active_milestone: read-only conversation detail and timeline tracer

last_synced: `2026-07-12T15:55:21Z`

status: CSSC-11 is static-certified and awaiting authenticated desktop/mobile evidence. CSSC-12 has a local materialized-projection tracer; it is not complete because the trusted adapter writer, dedicated role-restricted projection spaces and mutation forbids, internal/restricted subscriptions, opaque cursor pagination, live role-matrix proof, and rendered evidence remain open. No merge, deployment, or activation.
