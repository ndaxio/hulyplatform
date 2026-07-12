# Customer Success Portal Run Status

run_label: `cssc-native-huly-portal-ui-r1`

iteration: 7 / 20

last_input: Approved production-ready native Customer Success portal plan.

last_action: Added the immutable, project-scoped ConversationBinding model and completed the first trusted adapter projection-writer checkpoint on a separate stacked branch. Conversation identity now uses full-id digests, binding/event creation uses CAS, wrong-space retries conflict, configured project mismatches fail closed, caller provenance is derived, writer/internal tokens must differ, unbound legacy refreshes stop instead of duplicating, and authoritative explicit-issue migration is documented and tested.

verified: CSSC-11 STATIC PASS remains current. CSSC-12 portal tests pass: resources 62/62, model 7/7, locale 2/2, and the scoped 118-project Rush dependency build passes under Node 22. Adapter tests pass 174/174 with one environment-only skip; changed Python caller/takeover tests pass 43/43. The broader Python suite reached 1903 passes and 63 skips; 14 unrelated memory/PII tests could not download a missing spaCy model under restricted network. Fresh GPT-5.4 unit/mutation, security/privacy, and cross-repo integration checkers all APPROVED the final binding/writer delta. Authenticated desktop/mobile rendering remains unavailable because the in-app browser could not attach a tab.

next_human_decision: none - architecture correction is within the approved production-ready portal scope; merge and activation remain human gates.

branch: `codex/customer-success-portal`

worktree: `/private/tmp/huly-customer-success-portal`

base_commit: `101d5bddd`

live_workspace_id: `b55ff770-ea00-46e9-8dbd-ebb805940dd1`

task_keys: `CSSC-11`, `CSSC-12`, `CSSC-13`, `CSSC-14`, `CSSC-15`, `CSSC-16`, `CSSC-17`, `CSSC-18`, `CSSC-19`, `CSSC-20`

active_milestone: read-only conversation detail and timeline tracer

last_synced: `2026-07-12T20:48:42Z`

status: CSSC-11 is static-certified and awaiting authenticated desktop/mobile evidence. CSSC-12 now has a checker-approved local public-event writer plus exact ConversationBinding contract, but remains open because the Huly model and stacked adapter branches are not merged or deployed, legacy bindings are not backfilled, dedicated role-restricted projection spaces and human mutation forbids are not implemented, internal/restricted subscriptions and opaque cursor pagination remain open, and live role-matrix/rendered evidence is still required. No merge, deployment, or activation.
