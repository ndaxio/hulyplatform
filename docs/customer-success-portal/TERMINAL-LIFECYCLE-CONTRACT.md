# Customer Success Terminal Lifecycle Contract

CSSC-15D introduces regulated case resolution and reopen controls without
turning the generic Huly status editor into an authorization boundary. This
contract is schema-v1 policy for the native Customer Success portal and the
trusted adapter writer.

## State Matrix

| Source | Target | Browser actor | Required evidence |
|---|---|---|---|
| Human Active | Resolved | Current assigned SupportAgent or SupportLead | Current acknowledged live-session projection, exact issue snapshot, controlled resolution reason, explicit confirmation |
| Waiting on Customer | Resolved | Current assigned SupportAgent or SupportLead | Current issue-bound projection with unchanged owner, matching source status, and `observedAt >= Issue.modifiedOn`; exact issue snapshot; controlled resolution reason; explicit confirmation |
| Waiting on Internal | Resolved | Current assigned SupportAgent or SupportLead | Current issue-bound projection with unchanged owner, matching source status, and `observedAt >= Issue.modifiedOn`; exact issue snapshot; controlled resolution reason; explicit confirmation |
| Resolved | Reopened | SupportLead in the internal projection roster | Existing assignee is still active and in the internal support roster, exact issue snapshot, controlled reopen reason, explicit confirmation |

Every other browser-authored source/target pair fails closed. In particular:

- Closed is a system or retention-policy state and has no schema-v1 human
  action.
- Escalated requires destination, reason, approval, and handoff evidence and is
  not terminalized through CSSC-15D.
- A SupportLead cannot resolve another agent's assigned ticket through this
  path.
- Reopen preserves the existing eligible assignee. Reassignment remains a
  separate guarded action.
- Unassigned, Closed, Escalated, Bot Active, Takeover Requested, Shadowing, and
  arbitrary Tracker statuses are not accepted lifecycle sources.

## Immutable Request

Terminal lifecycle actions use distinct request actions so authorization,
recovery, audit review, and telemetry cannot confuse them with nonterminal
waiting-state changes:

- `resolve_case`
- `reopen_case`

The deterministic id binds the immutable create-transaction creator, issue,
action, target, source snapshot, and normalized reason code:

`ndax:support:action-request:<issueId>:<creatorAccount>:<action>:<targetStatus>:<reasonCode>:<expectedModifiedOn>`

The request carries the unchanged canonical assignee, exact source status and
`modifiedOn`, target status, controlled reason code, and an optional trimmed
plain-text detail of at most 500 characters. The browser never supplies actor
identity, role, approval, processed time, commit marker, or audit identity.
The browser preserves unsubmitted reason/detail drafts only in component
memory. When a terminal row is later observed for the same deterministic id, it
hydrates reason and detail back into the dialog so failed/superseded recovery
remains deterministic after refresh.

Schema-v1 controlled reasons are:

- Resolve: `customer_confirmed`, `request_completed`,
  `information_provided`, or `duplicate_request`.
- Reopen: `customer_follow_up`, `incomplete_resolution`,
  `new_information`, or `quality_review`.

Reason detail is internal operational data. It must not be copied into the
public transcript or customer-visible system message. It accepts only plain
text after CR/LF normalization, trimming, and validation: C0/C1 controls
except normalized LF, bidi overrides/isolates, and Unicode line/paragraph
separators are rejected. Unsubmitted detail is kept only in component memory
and is not persisted to browser storage.

## Browser Recovery

After the browser submits a new terminal exact id, it keeps the optimistic
lock until that exact request row is observed or a bounded observation
timeout/errors ends the attempt. An empty first subscription result is not
confirmation and must not unlock duplicate submits.

Failed and superseded rows remain visible as evidence for the current exact
snapshot. The portal preserves/hydrates their reason/detail drafts and may
offer a new deterministic retry only when the operator changes reason code or
the issue snapshot advances. Snapshot/projection staleness and deterministic-id
conflict are distinct UX states.

## Writer And Recovery

The adapter derives the creator from the immutable `TxCreateDoc`, resolves the
creator and assignee server-side, and independently rechecks role, active
Employee state, internal roster membership, source/target matrix, reason
allowlist, and exact request-id binding.

The lifecycle `TxApplyIf` matches the configured support project, exact raw
assignee, source status, issue `modifiedOn`, request processing lease, and the
required current live-session projection. It changes only `Issue.status` and
atomically stamps a request-specific commit marker. A future immutable
lifecycle audit projection may be added in the same transaction; request
creator, normalized reason fields, source/target snapshot, marker, and Huly
transactions are the minimum schema-v1 evidence.

Crash recovery reports success only from that request's immutable commit marker,
which is written atomically with the target state. A matching target without the
marker is foreign state and becomes superseded. A later valid successor may have
already advanced the current issue; it cannot relabel the proven earlier commit.
The marker digest is stable across runtime-secret rotation and is trusted only
when read from the Huly transaction log. Live-session projection refresh is
monotonic and cannot overwrite a newer issue observation.

## Customer And Orchestrator Behavior

Resolved maps to `sessionStatus: ended`. The orchestrator returns its existing
localized session-ended message and CSAT prompt in the same poll response that
observes the terminal state, then stops polling and keeps the Huly ticket and
conversation binding as the system of record.

Reopened maps to `queued` and means human-owned queue: the bot is suppressed
regardless of whether a prior Cosmos live-session document still exists. The
orchestrator must reconcile Huly lifecycle state before generating a bot reply,
reactivate or create the queued provider session generation, preserve the
message cursor, and require a new guarded claim and acknowledgement before
Human Active. Reopen does not itself acknowledge takeover.

Normal bot-turn mirroring must never overwrite Resolved, Closed, or Reopened
with Bot Active. Returning a reopened case to the bot requires a future
explicit, separately authorized action. Terminal writes must reach Huly before
Cosmos is marked ended; a failed Huly terminal write leaves the session active
for reconciliation rather than creating divergent ownership.

The adapter must return the exact `hulyStatusId` and terminal lifecycle reason
to the orchestrator. The orchestrator records a lifecycle generation and emits
the localized terminal message and CSAT prompt at most once for that generation.
It returns the trusted `lifecycleGeneration` in the JSON `liveAgent` object and
SSE `liveAgent` event. A widget displaying that CSAT prompt must echo the same
positive integer in `POST /api/csat`; submissions are idempotent within one
generation and remain distinct after reopen/resolution cycles. Widget forwarding
is therefore an activation gate, while legacy CSAT callers without a generation
retain their existing session-scoped behavior.
Resolved and Closed remain distinct audit outcomes even though both stop
polling.

## Release Evidence

CSSC-15D is not certified from unit tests alone. Release evidence requires:

1. Mutation-proven role, roster, source/target, reason, exact-snapshot,
   processing-lease, commit-marker, and monotonic-projection guards.
2. Authenticated desktop and mobile rendering of confirmation, validation,
   pending, failed, superseded, and reconciled outcomes.
3. Two-agent contention proving exactly one terminal request commits.
4. A live two-sweep trace proving Resolved returns one ended transition and
   Reopened stays queued with the bot suppressed until a fresh
   claim/acknowledgement.
5. Human review before merge, deployment, model seeding, or production
   activation.
