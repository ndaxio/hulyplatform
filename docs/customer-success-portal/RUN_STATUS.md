# Customer Success Portal Run Status

run_label: `cssc-native-huly-portal-ui-r1`

iteration: 13 / 20

last_input: Approved production-ready native Customer Success portal plan.

last_action: Certified the local CSSC-15B conservative reassignment checkpoint. SupportLead can use the native assignee picker to move an already-assigned BotActive, NeedsHuman, Shadowing, Reopened, or tracker Backlog ticket to a different active SupportAgent/SupportLead in the internal roster. The browser creates a deterministic `reassign_assignee` request from the canonical prior Person snapshot; the adapter independently binds portal-shaped ids to the immutable creator and payload, rechecks the creator's internal SupportLead membership, validates the target, rereads the exact snapshot, and atomically changes only the assignee while stamping a distinct `reassignment_committed` recovery marker. Takeover Requested, Human Active, unassigned, no-op, stale, forged-prefix, and off-roster requests fail closed. No status mutation, force transfer, compliance override, takeover claim/ack, joined notice, direct browser adapter call, or token exposure was added.

verified: CSSC-11 through CSSC-14 and CSSC-15A local certifications remain current. CSSC-15 portal resources pass 126/126, model tests pass 9/9, locales pass 2/2, and the adapter passes 128/128 focused Node tests. The prior unchanged focused Python adapter/poller result remains 50/50 and the unchanged full Python baseline remains 1924 passed with 63 expected skips. Diffs are clean and the scoped Node 22 Rush build passes all 120 dependency operations, including four rebuilt Customer Success packages. Adversarial coverage includes forged creator prefixes, creator/target roster drift, no-op and live-session transfer denial, immutable raw/canonical assignee CAS, distinct-request contention, foreign matching state, crash recovery markers, refresh hydration, stale terminal retry, and absence of takeover/customer-message side effects. Fresh GPT-5.4 concurrency, cross-repo, regulated-security, and native-Huly UX/accessibility checkers all APPROVED the remediated tree.

next_human_decision: none - architecture correction is within the approved production-ready portal scope; merge and activation remain human gates.

branch: `codex/customer-success-portal`

worktree: `/private/tmp/huly-customer-success-portal`

base_commit: `101d5bddd`

live_workspace_id: `b55ff770-ea00-46e9-8dbd-ebb805940dd1`

task_keys: `CSSC-11`, `CSSC-12`, `CSSC-13`, `CSSC-14`, `CSSC-15`, `CSSC-16`, `CSSC-17`, `CSSC-18`, `CSSC-19`, `CSSC-20`

active_milestone: conservative reassignment and status controls

last_synced: `2026-07-13T03:05:39Z`

status: CSSC-11 and CSSC-12 remain open on their documented deployment and authenticated evidence gates. CSSC-13 remains open until authenticated desktop/mobile rendering and a representative large-queue query/render trace are recorded. CSSC-14 is locally complete but still awaits coordinated deployment and authenticated transition/contention evidence. CSSC-15 remains open: claim-self, CSSC-15A first assignment, and CSSC-15B conservative reassignment are locally certified; CSSC-15C status controls, CSSC-15D terminal/reopen behavior, and authenticated two-agent live evidence remain. No merge, deployment, live seed/backfill, or activation.
