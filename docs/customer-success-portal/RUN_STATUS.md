# Customer Success Portal Run Status

run_label: `cssc-native-huly-portal-ui-r1`

iteration: 11 / 20

last_input: Approved production-ready native Customer Success portal plan.

last_action: Completed the local CSSC-15 claim-self tracer checkpoint. Authorized support agents and leads can create one deterministic browser-side SupportActionRequest through Huly's authenticated transaction boundary; the loopback adapter derives immutable creator identity, verifies support role membership and a current Issue snapshot, leases processing with CAS, converges claim and acknowledgement, and publishes one stable joined notice. The UI reports request progress but treats only reconciled LiveSessionState as takeover success. Malformed rows, poller failures, partial-progress recovery, stale workers, and newer-snapshot retries now fail closed or recover without blocking unrelated takeovers.

verified: CSSC-11 through CSSC-14 local certifications remain current. CSSC-15 portal resources pass 115/115, model tests pass 9/9, locales pass 2/2, the adapter passes 216 tests with one environment-gated skip, and the full Python suite passes 1924 tests with 63 expected skips. Diffs are clean and the scoped Rush build passes all 120 operations. Mutations turn RED when exact-id creation CAS, UI role visibility, reconciliation-only success, creator identity or support-role checks, stale snapshot checks, internal-space filtering, poller invocation/isolation, active and terminal lease guards, malformed-id terminalization, partial-progress recovery, or newer-snapshot retry release are removed. Fresh GPT-5.4 concurrency, cross-repo, regulated-security, and native-Huly UX/accessibility checkers all APPROVED the remediated tree.

next_human_decision: none - architecture correction is within the approved production-ready portal scope; merge and activation remain human gates.

branch: `codex/customer-success-portal`

worktree: `/private/tmp/huly-customer-success-portal`

base_commit: `101d5bddd`

live_workspace_id: `b55ff770-ea00-46e9-8dbd-ebb805940dd1`

task_keys: `CSSC-11`, `CSSC-12`, `CSSC-13`, `CSSC-14`, `CSSC-15`, `CSSC-16`, `CSSC-17`, `CSSC-18`, `CSSC-19`, `CSSC-20`

active_milestone: guarded assignment and status controls

last_synced: `2026-07-13T00:31:54Z`

status: CSSC-11 and CSSC-12 remain open on their documented deployment and authenticated evidence gates. CSSC-13 remains open until authenticated desktop/mobile rendering and a representative large-queue query/render trace are recorded. CSSC-14 is locally complete but still awaits coordinated deployment and authenticated transition/contention evidence. CSSC-15 remains open: this checkpoint delivers claim-self only; lead assignment/override and the approved status-transition controls are the next slices, followed by authenticated two-agent live evidence. No merge, deployment, live seed/backfill, or activation.
