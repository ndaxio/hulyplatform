# Customer Success Portal Quality Gates

Overall production gate: RED until all mandatory evidence is present.

This is expected at cycle zero. Existing handoff work supplies a strong base,
but UI delivery must prove its own data boundaries and live behavior.

## Gate Classes

- Unit: guards, formatting, typed state, role matrix, idempotency, transitions.
- Integration: model, query, route, adapter, orchestrator, and storage contracts.
- Rendered: authenticated in-page layout, interaction, focus, accessibility,
  English/French, loading, error, and stale-state behavior.
- Live: real Huly principals and support tickets in the Customer Success workspace.
- Mutation: deliberately break load-bearing guards and prove tests fail.

## Mandatory Gates

| Gate | Minimum evidence before PASS |
|---|---|
| Queue access | Correct-role live visibility and wrong-role denial with real principals. |
| Message lanes | Typed public, internal, restricted, mirrored, and system events; no reliance on display markers. |
| Browser boundary | No service or adapter token in bundles, network calls, storage, or diagnostics. |
| Claim concurrency | Two operators race; exactly one wins; loser reconciles without false success. |
| Exact-id CAS | Duplicate claim-self clicks for one issue snapshot converge on one deterministic request id and one row. |
| Lead assign boundary | Only SupportLead sees the picker; only unassigned conservative statuses are mutable; candidates and server authorization require active SupportAgent/SupportLead internal-roster membership; request state survives refresh. |
| Delivery idempotency | Retry and reconnect cannot duplicate a customer-visible reply. |
| Stable identity | Rows and events remain stable across refresh, replay, and out-of-order delivery. |
| Outage recovery | Huly, adapter, and orchestrator failure states are distinct and recover without losing drafts. |
| Accessibility | Keyboard completion, focus return, screen-reader names, contrast, and reduced motion in the rendered app. |
| Localization | All shipped locale bundles contain localized assignment controls and failure/reconciliation states; dates and times use locale-aware presenters. |
| Performance | Large queue, long transcript, bounded subscriptions, stable scrolling, and agreed latency budgets. |
| Audit | Correlation chain from Huly action through customer delivery outcome without transcript leakage in logs. |
| Unauthorized visibility | SupportActionRequest controls and request-state chrome are absent for non-agent/non-lead viewers. |
| Restricted authorship | Only active restricted-space SupportLead/Compliance members see the composer; adapter role and roster checks fail closed; request/event plaintext never enters internal or customer lanes. |
| Retention and attachments | Authorized download, file policy, scanning, retention, legal hold, export, and restore evidence before attachment release. |
| Live tracer | Two-agent claim, takeover, reply, internal note, restricted denial, reconnect, and retry against live systems. |

## Known Production Findings To Carry Forward

These do not block the read-only CSSC-11 tracer but must remain red until their
own milestone closes:

1. Restricted-note storage and authorship are implemented locally with
   role/space mutation tests. Authenticated retrieval/denial, export, retention,
   backup/restore, and compliance-owner sign-off remain red.
2. Attachment scanning, retention, legal hold, and restore evidence are not part
   of the first UI slice and must remain disabled until certified.
3. Stable end-to-end message ids and cursors must be verified before the public
   composer is enabled.
4. The authoritative acknowledgement path must be live-proven under contention
   before takeover controls are released.
5. Existing single-lane smoke evidence does not replace the final two-operator
   production tracer.

## Checker Rule

Tests and types alone cannot certify a UI milestone. Every PASS must cite an
authenticated screenshot, in-page interaction evidence, relevant denial or
failure evidence, and the exact test output. Findings become regression tests;
agents may not delete or weaken them to recover a green gate.
