# Customer Success Portal Run Status

run_label: `cssc-native-huly-portal-ui-r1`

iteration: 18 / 20

last_input: Approved production-ready native Customer Success portal plan.

last_action: Implemented the local CSSC-17 restricted-note slice across the Huly portal and adapter worktrees. The portal now provides a separate text-only restricted composer whose request is stored only in the restricted projection space. UI visibility and adapter processing both require an active restricted-space SupportLead or Compliance member; successful processing creates only a restricted event and never a customer comment or internal duplicate. Duplicate request ids across internal and restricted spaces fail closed.

verified: CSSC-11 through CSSC-16 local certifications remain current. CSSC-17 portal resources tests pass 148/148, portal model tests pass 9/9, asset/locale tests pass 3/3, and the adapter suite records 301 passed with one existing environment-only skip. Mutation checks went red when restricted requests were redirected to the internal space, Compliance was removed from the restricted role guard, the adapter external-role guard was disabled, or the restricted projection selector was forced to internal. The UX checker approved the three-composer interaction, the security/durability checker approved the adapter authorization, storage, idempotency, summary-redaction, and cross-space conflict behavior after independently running 179 focused tests, and the cross-repository checker approved the dual-control external-authority plus restricted-roster contract. `svelte-check` reports no CSSC-17-specific error; only the previously recorded portal and upstream baseline remains.

next_human_decision: Review the checker-certified draft PR updates. Merge, deployment, live model seed/backfill, and activation remain human gates.

branch: `codex/customer-success-portal`

worktree: `/Users/bilalhammoud/Documents/Huly/cssc-17-portal`

base_commit: `101d5bddd`

live_workspace_id: `b55ff770-ea00-46e9-8dbd-ebb805940dd1`

task_keys: `CSSC-11`, `CSSC-12`, `CSSC-13`, `CSSC-14`, `CSSC-15`, `CSSC-16`, `CSSC-17`, `CSSC-18`, `CSSC-19`, `CSSC-20`

active_milestone: CSSC-17 local certification and authenticated compliance evidence preparation

last_synced: `2026-07-18T10:49:26Z`

status: CSSC-11 and CSSC-12 remain open on their documented deployment and authenticated evidence gates. CSSC-13 remains open until authenticated desktop/mobile and screen-reader evidence plus a representative large-queue query/render trace are recorded. CSSC-14 through CSSC-16 remain locally code-complete. CSSC-17 is locally implemented and UX, security/durability, and cross-repository checker-approved, but remains open until authenticated restricted-space allow/deny retrieval, compliance-owner sign-off, export/retention policy, backup/restore proof, and a live no-leakage trace are recorded. The adapter list path intentionally requires both projection spaces to be healthy and its per-space limit means duplicate ids outside a returned polling window are detected at processing rather than listing; both require operational validation before activation. CSSC-18 realtime recovery is next. No merge, deployment, live seed/backfill, production task update, or activation.
