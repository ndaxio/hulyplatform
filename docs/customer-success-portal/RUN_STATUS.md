# Customer Success Portal Run Status

run_label: `cssc-native-huly-portal-ui-r1`

iteration: 12 / 20

last_input: Approved production-ready native Customer Success portal plan.

last_action: Certified the local CSSC-15A guarded assignment checkpoint. SupportLead can select an active SupportAgent/SupportLead from the internal roster and submit one deterministic `assign_assignee` request; the adapter independently enforces creator, target, roster, snapshot, lease, and assignee-only CAS rules. Request state now survives refresh through creator-scoped discovery followed by exact-id watching, legacy assignee identity is normalized to Person across browser and adapter boundaries, stale terminal evidence stays visible without blocking a newer-snapshot action, and assignment crash recovery requires an adapter-owned marker written atomically with the assignee CAS. Claim-self stays intact. No direct adapter call, token exposure, tracker AssigneeEditor import, reassignment path, or status override was added.

verified: CSSC-11 through CSSC-14 local certifications remain current. CSSC-15 portal resources pass 124/124, model tests pass 9/9, locales pass 2/2, the adapter passes 234 tests with one environment-gated skip, and the focused Python adapter/poller suite passes 50/50. The prior unchanged full Python baseline remains 1924 passed with 63 expected skips. Diffs are clean and the scoped Rush build passes all 69 selected operations. Adversarial tests cover forged/off-roster targets, fresh and expired-lease recovery confusion, pre/post-CAS races, two-worker convergence, canonical legacy identity, refresh hydration, stale terminal retry, and absence of takeover side effects. Fresh GPT-5.4 concurrency, cross-repo, regulated-security, and native-Huly UX/accessibility checkers all APPROVED the remediated tree.

next_human_decision: none - architecture correction is within the approved production-ready portal scope; merge and activation remain human gates.

branch: `codex/customer-success-portal`

worktree: `/private/tmp/huly-customer-success-portal`

base_commit: `101d5bddd`

live_workspace_id: `b55ff770-ea00-46e9-8dbd-ebb805940dd1`

task_keys: `CSSC-11`, `CSSC-12`, `CSSC-13`, `CSSC-14`, `CSSC-15`, `CSSC-16`, `CSSC-17`, `CSSC-18`, `CSSC-19`, `CSSC-20`

active_milestone: guarded assignment and status controls

last_synced: `2026-07-13T02:17:49Z`

status: CSSC-11 and CSSC-12 remain open on their documented deployment and authenticated evidence gates. CSSC-13 remains open until authenticated desktop/mobile rendering and a representative large-queue query/render trace are recorded. CSSC-14 is locally complete but still awaits coordinated deployment and authenticated transition/contention evidence. CSSC-15 remains open: this checkpoint now includes claim-self plus the fixed conservative CSSC-15A lead-assign request path, while override/reassign and broader status-transition controls remain future slices and still require authenticated two-agent live evidence. No merge, deployment, live seed/backfill, or activation.
