# Customer Success Conversation Projection Contract

status: draft implementation contract; not production-authorized

## Purpose

The operator portal must never authorize or assemble a support transcript from
raw `ChatMessage` comments in the browser. The authoritative read model is a
materialized `customer-success:class:ConversationEvent` document written by a
trusted server-side support integration and read through Huly's workspace and
space authorization.

The adapter is a system writer, not a browser API. Adapter credentials and raw
comment payloads must never be delivered to the Huly client bundle.

Adapter-confirmed takeover metadata is materialized separately as one mutable,
system-written `customer-success:class:LiveSessionState` document per support
issue in the internal projection space. It is never inferred from transcript
text and never used to override the authoritative Tracker issue status.

Human operators request claim-side effects by creating one
`customer-success:class:SupportActionRequest` document in the internal
projection space through the ordinary authenticated Huly client. The browser
never calls the adapter directly and never receives adapter credentials or
tokens. The request document is consumed asynchronously by the trusted adapter,
which derives the immutable creator from Huly transaction identity and ignores
any caller-supplied actor field.

Exact conversation-to-ticket resolution uses an immutable
`customer-success:class:ConversationBinding` document keyed by a SHA-256 digest
of the full conversation id. A binding contains the exact conversation id,
support issue reference, support project reference, binding digest, and schema
version. Missing, ambiguous, cross-project, or conflicting bindings fail closed.
New support tickets create bindings atomically. Legacy tickets must be backfilled
only from an authoritative exact conversation-to-issue mapping; title and
sanitized description-marker inference is forbidden. The projection writer
remains disabled until the model is deployed and required legacy bindings exist.
Existing binding and event documents are authoritative only when their Huly
`space` exactly matches the configured project or projection space; matching ids
or digests in another space are conflicts, not retries.

## Event Schema

Each event is immutable after creation.

| Field | Contract |
|---|---|
| `_id` | Deterministic Huly id derived from the authoritative event id. |
| `space` | Projection space whose membership authorizes this visibility lane. |
| `issueId` | Exact Huly support issue reference. |
| `conversationId` | Sanitized orchestrator conversation identity. |
| `eventId` | Stable, globally unique source event id. |
| `lane` | `customer`, `bot`, `agent`, or `system`. |
| `visibility` | `public`, `internal`, or `restricted`. |
| `source` | `chat-orchestrator`, `huly-agent`, or `support-system`. |
| `sourceMessageId` | Optional immutable source-system message id. |
| `occurredAt` | Authoritative event timestamp in epoch milliseconds. |
| `message` | Sanitized Huly markup. |
| `authorAccount` | Optional Huly account id resolved by the trusted writer. |
| `idempotencyKey` | Stable retry key; never based on request time. |
| `payloadDigest` | SHA-256 digest of the canonical writer payload for conflict detection. |
| `schemaVersion` | Exact supported projection schema; initially `1`. |

Unknown schema versions, lanes, and visibility values fail closed.

## Live Session State Schema

| Field | Contract |
|---|---|
| `_id` | Deterministic id derived from the Huly issue id. |
| `space` | Exact internal projection space. |
| `issueId` | Exact Huly support issue reference. |
| `conversationId` | Optional exact conversation identity when a binding exists. |
| `stage` | `bot_active`, `shadowing`, `takeover_requested`, `human_active`, or `other`. |
| `claimOwner` | Current Huly Person assignee, or null. |
| `pendingAcknowledgement` | True only for a requested but unacknowledged takeover. |
| `acknowledged` | Adapter-confirmed acknowledgement state. |
| `requestedAt` / `expiresAt` | Optional epoch-millisecond lock timestamps. |
| `expired` | Adapter-computed lock expiry. |
| `recoveryState` | `none`, `unassigned`, `unauthorized_assignee`, or `lock_expired`. |
| `sourceStatus` | Huly issue status used to compute the projection. |
| `observedAt` | Source observation time used for stale-state rejection. |
| `schemaVersion` | Exact supported schema; initially `1`. |

First materialization is an atomic not-exists create on the deterministic id.
Concurrent first writers must converge on the same row; a losing writer reloads
the created row and refreshes it instead of surfacing a duplicate-id failure.

The browser accepts expiry and recovery metadata only when projection issue,
source status, claim owner, and observation time reconcile with the current
reactive Issue. Coarse stage always comes from `Issue.status`. Confirmed success
requires both exact Human Active and a current adapter projection with
`acknowledged: true`; otherwise the UI remains reconciliation pending.
`SupportActionRequest.state === succeeded` is never enough to render takeover
success on its own.

Failed and superseded requests stay visible for their original Issue snapshot.
When the Issue advances to a different `modifiedOn`, the detail view releases
the stale request id and derives a fresh deterministic request for the new
snapshot, restoring the operator's claim path without reusing stale intent.

## Support Action Request Schema

Each request id is deterministic and exact-id guarded:

`ndax:support:action-request:<issueId>:<currentAccountUuid>:claim_self:<expectedModifiedOn>`

CSSC-15A adds a second deterministic id for lead assignment:

`ndax:support:action-request:<issueId>:<currentAccountUuid>:assign_assignee:<requestedAssignee>:<expectedModifiedOn>`

CSSC-15B adds the corresponding lead-only reassignment id:

`ndax:support:action-request:<issueId>:<currentAccountUuid>:reassign_assignee:<requestedAssignee>:<expectedModifiedOn>`

CSSC-15C adds an owner-only nonterminal status id:

`ndax:support:action-request:<issueId>:<currentAccountUuid>:transition_status:<requestedStatus>:<expectedModifiedOn>`

CSSC-15D reserves distinct terminal lifecycle ids:

`ndax:support:action-request:<issueId>:<currentAccountUuid>:<resolve_case|reopen_case>:<requestedStatus>:<reasonCode>:<expectedModifiedOn>`

Their source/target matrix, reason allowlists, role rules, recovery marker, and
orchestrator behavior are normative in `TERMINAL-LIFECYCLE-CONTRACT.md`.
Closed and Escalated have no schema-v1 browser transition.

The browser creates it through `client.apply(requestId).notMatch(...)` guarded
by the globally unique exact `_id`. Its reactive read subscription additionally
requires the exact internal `space`, `issueId`, and `schemaVersion: 1`.
On refresh, request discovery is scoped to the current account encoded in
`_id`, the exact issue/internal space, and schema. Deterministic latest-relevant
selection is followed by an exact-id subscription. Succeeded rows hydrate only
while their requested outcome still matches issue truth; stale terminal
conflict evidence remains visible without blocking a newer-snapshot action.
After the browser submits a new exact id, it keeps the optimistic lock until
that exact row is observed or a bounded observation timeout/errors ends the
attempt. An empty first subscription result is not success and must not unlock
duplicate submits.

| Field | Contract |
|---|---|
| `_id` | Deterministic id built from issue id, current account uuid, action, expected target person when the action needs one, and expected modified time. |
| `space` | Exact internal projection space. |
| `issueId` | Exact Huly support issue reference. |
| `action` | `claim_self`, `assign_assignee`, `reassign_assignee`, `transition_status`, `resolve_case`, or `reopen_case`. |
| `requestedAssignee` | Huly Person requested for claim/assignment actions; for status and terminal actions, the unchanged canonical assignee bound to the request snapshot. |
| `requestedStatus` | Required for `transition_status`, `resolve_case`, and `reopen_case`; waiting targets for `transition_status`, `Resolved` or `Reopened` for terminal actions. |
| `expectedStatus` | Exact issue status the request expects. |
| `expectedAssignee` | Exact expected assignee, or null. |
| `expectedModifiedOn` | Exact issue `modifiedOn` timestamp the browser observed. |
| `reasonCode` | Required controlled lifecycle reason for `resolve_case` and `reopen_case`; absent for other actions. |
| `reasonDetail` | Optional trimmed plain text for terminal actions only. Reject C0/C1 controls except normalized LF, bidi overrides/isolates, and Unicode line/paragraph separators. |
| `state` | `pending`, `processing`, `succeeded`, `failed`, or `superseded`. |
| `resultCode` / `errorCode` | Optional system-written outcome codes. |
| `processingLeaseId` | Opaque adapter-written ownership token. Browser clients must not set or trust it. |
| `processingLeaseExpiresAt` | Adapter-written lease expiry used to recover abandoned processing safely. |
| `processedAt` | Optional system-written processing time. |
| `idempotencyKey` | Stable retry key; equal to the deterministic id in CSSC-15. |
| `schemaVersion` | Exact supported schema; initially `1`. |

## Authorization

Projection documents are partitioned by three dedicated restricted typed Huly
spaces. The package now defines `ConversationProjectionSpace`,
`ConversationProjectionSpaceTypeData`, metadata keys for the three lane ids, and
default ids:

- `ndax:support:projection:public`
- `ndax:support:projection:internal`
- `ndax:support:projection:restricted`

The browser resolves those ids from metadata when available and otherwise uses
the defaults above. Each transcript lane is queried independently by exact
`space`, `issueId`, `visibility`, and `schemaVersion: 1`.

| Visibility | Space membership |
|---|---|
| `public` | Customer Success support agents, support leads, and assigned compliance personnel. |
| `internal` | Customer Success support agents, support leads, and assigned compliance personnel. |
| `restricted` | Support leads and explicitly assigned compliance personnel. |

The browser queries only spaces already authorized by Huly. It never receives a
broader result and then hides rows with CSS or client-side role checks.

`TxAccessLevel` at `AccountRole.Admin` is defense in depth for the model tracer,
not the final writer boundary. Before production activation, each projection
space type must assign class-scoped forbid-create, forbid-update, and
forbid-remove permissions for `ConversationEvent`, `ConversationBinding`, and
`LiveSessionState`, plus projection-space update/remove and role-mixin update
forbids, to every human role in the space type.

`SupportActionRequest` is intentionally different:

- humans may create it through the internal projection space;
- humans must be forbidden from update/remove;
- the browser shows claim-self controls only to SupportAgent and SupportLead
  role members; compliance-only viewers must not see those controls;
- the browser shows lead-assignment controls only to SupportLead role members;
- the lead-assignment picker is advisory only and filters to active Persons
  mapped from SupportAgent or SupportLead assignments in the internal
  projection space;
- for `claim_self`, the adapter independently verifies that the immutable
  creator maps to `requestedAssignee` and holds a support role;
- for `assign_assignee`, the adapter requires a SupportLead creator and an
  exact match between the deterministic id's account segment and the immutable
  Huly create-transaction creator; the creator must also remain in the internal
  projection space's SupportLead roster. The requested target must be an
  active Person present in the internal projection space's
  SupportAgent/SupportLead roster.
- for `reassign_assignee`, the adapter applies the same creator and target
  checks, requires an already-assigned conservative source status, rejects a
  no-op target, and changes only the assignee. Takeover Requested and Human
  Active tickets cannot be transferred through this action.
- for `transition_status`, the immutable creator must map to the unchanged
  assigned Person, hold an internal support role, and present a current
  acknowledged Human Active live-session projection. Schema v1 permits only
  Human Active to Waiting on Customer or Waiting on Internal. Escalated,
  terminal, reopen, reverse, bot-ownership, and takeover transitions are not
  accepted by this action.
- for `resolve_case`, Human Active requires a current acknowledged live-session
  projection. Waiting on Customer and Waiting on Internal require a fresh
  issue-bound projection whose source status, observed time, and projected
  owner still reconcile with the exact current issue snapshot. Missing, stale,
  wrong-source, or wrong-owner projection evidence disables submit and fails
  closed at adapter validation.
- for `reopen_case`, only a SupportLead may act and the existing assignee must
  still be active in the internal support roster. The portal may preserve and
  hydrate reason/detail drafts from a failed or superseded request, but a fresh
  deterministic retry still requires either a new snapshot or a changed reason
  code so the exact id changes.

The portal canonicalizes a legacy account/social-identity `Issue.assignee`
through Huly's account-to-employee map before comparing it with the
Person-typed `LiveSessionState.claimOwner` or evaluating action controls.
Native Person assignees remain unchanged. If a legacy social identity is not in
the browser cache, a current system-written projection (matching issue, status,
stage, and observation time) supplies the canonical Person for takeover display
and claim-self eligibility.

Huly's restricted space middleware keeps a single bypass for
`core.account.System`, which is the trusted writer path. A live mutation test
must prove support agent, support lead, maintainer, owner, and ordinary admin
sessions cannot forge or alter an event, binding, live-session state, or
update/remove a support action request.

This worktree defines the typed space model, the fourteen forbid permissions, the
three role documents, and the client metadata hooks. It does not provision the
three concrete space documents or their role-member assignments in this repo.

## Writer Rules

The trusted adapter writer must:

1. Resolve the issue by exact `conversationId` or issue id inside the configured
   support project. Missing or ambiguous resolution fails closed.
2. Derive lane, visibility, source, author, and event id from an authenticated
   source contract. Caller-supplied generic comment `props` are never trusted.
3. Reject reserved `ndax_kind`, projection, provenance, lane, and visibility
   fields on generic comment routes.
4. Create the event with deterministic `_id` and `idempotencyKey`; a retry with
   the same payload returns `exists`, while a conflicting payload for the same
   id returns a conflict and emits a metadata-only security audit event.
5. Sanitize markup before persistence and never log message bodies, customer
   identifiers, emails, phone numbers, wallet addresses, account numbers, or
   restricted-note content.
6. Never update or delete a projection event. Corrections are appended as new
   events linked by source metadata retained outside the browser contract.
7. Upsert live-session state only after canonical support state is known. Failed
   conditional claim/ack/release writes must not advance the projection.
8. Consume `SupportActionRequest` only from the exact internal projection space.
   Derive creator identity from the persisted Huly transaction, verify role and
   target roster membership, verify expected status/assignee/modifiedOn, then
   invoke the existing CAS claim/ack flow or a conservative lead assignee
   mutation. Fresh pending requests never infer success from pre-existing issue
   state; only an expired processing lease with a compatible immutable snapshot
   and the matching adapter-owned `assignment_committed` or
   `reassignment_committed` marker written atomically with the assignee CAS may
   resume durable progress. Status recovery analogously requires the distinct
   `status_transition_committed` marker, unchanged owner, allowed source/target,
   and the committed target status.

## Ordering And Pagination

Canonical display order is the immutable tuple `(occurredAt ASC, eventId ASC)`.
The live tracer opens three reactive subscriptions, one for each visibility
lane. Each lane fetches the newest 100 events in descending tuple order, and
the client merges authorized pages by `(space, eventId)` before rendering the
combined transcript in canonical ascending order. Huly document `createdOn`,
`modifiedOn`, and arrival order are not timeline order.

The opaque cursor is base64url-encoded JSON with the exact shape
`{ v: 1, issueId, spaceId, visibility, occurredAt, eventId }`. Decode succeeds
only when the cursor is replayed in the same issue, projection space, and
visibility context that produced it.

An `after` catch-up query is strictly after the newest known tuple:

```text
occurredAt > cursor.occurredAt
OR (occurredAt == cursor.occurredAt AND eventId > cursor.eventId)
```

Unknown, malformed, cross-issue, cross-space, cross-visibility, or
wrong-version cursors fail closed by returning no page query at all. Page
boundaries are exclusive, so retries cannot duplicate the boundary event.

History pagination uses a `before` cursor anchored to the oldest visible tuple:

```text
occurredAt < cursor.occurredAt
OR (occurredAt == cursor.occurredAt AND eventId < cursor.eventId)
```

The storage query remains descending and the returned page is merged back into
the canonical ascending transcript.

The current UI uses the `before` cursor for the `Load earlier` action. Forward
progress currently comes from the live per-lane subscriptions rather than an
explicit `after` fetch, but the shared helper already supports both directions.

There is no raw `ChatMessage` transcript fallback. If a projection lane is
empty, unauthorized, malformed, or on an unknown schema, the browser renders
only the remaining authorized `ConversationEvent` rows. The separate activity
rail explicitly excludes `chunter:class:ChatMessage` rows as well.

## Verification Gate

Completion requires all of the following:

- Query-shape tests prove the UI subscribes to `ConversationEvent`, never raw
  `ChatMessage` comments, and that the activity lane excludes
  `chunter:class:ChatMessage`.
- Mutation tests turn RED when space scoping, visibility, schema, lane, tuple
  ordering, page bound, or system-writer protections are removed.
- Two-page tests prove monotonic order, no duplicates, no replay on an invalid
  cursor, exact issue/space/visibility cursor binding, and no forbidden rows in
  serialized browser responses.
- Role-matrix live tests prove restricted events are absent at the transactor
  response for support-agent sessions and present only for authorized leads or
  compliance sessions.
- Retry tests prove one source event creates exactly one projection document.
- Live-session tests prove deterministic upsert identity, pending versus
  confirmed state, expiry/recovery projection, and no write after failed CAS.
- Support-action tests prove exact-id CAS creation, no browser adapter token,
  unauthorized-role control suppression, and that request `state: succeeded`
  still renders only as waiting until reconciled `LiveSessionState`
  confirmation arrives.
- Log capture proves message bodies and regulated identifiers are absent from
  adapter, transactor, and browser console logs.
- Authenticated desktop and mobile portal traces pass before merge or activation.

No merge, deployment, or production activation is implied by this contract.
