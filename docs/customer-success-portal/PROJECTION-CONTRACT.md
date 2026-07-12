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

## Authorization

Projection documents are partitioned by restricted Huly spaces:

| Visibility | Space membership |
|---|---|
| `public` | Customer Success support agents and leads. |
| `internal` | Customer Success support agents and leads. |
| `restricted` | Support leads and explicitly assigned compliance personnel. |

The browser queries only spaces already authorized by Huly. It never receives a
broader result and then hides rows with CSS or client-side role checks.

`TxAccessLevel` at `AccountRole.Admin` is defense in depth for the model tracer,
not the final writer boundary. Before production activation, each projection
space type must assign class-scoped forbid-create, forbid-update, and
forbid-remove permissions for `ConversationEvent` to every human role. Huly's
system account remains the only bypass for the trusted writer. A live mutation
test must prove support agent, support lead, maintainer, owner, and ordinary
admin sessions cannot forge or alter an event.

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

## Ordering And Pagination

Canonical display order is the immutable tuple `(occurredAt ASC, eventId ASC)`.
The live subscription fetches the newest 100 events in descending tuple order,
then the client renders that bounded window in canonical ascending order. This
keeps new events visible after a conversation exceeds one page. Huly document
`createdOn`, `modifiedOn`, and arrival order are not timeline order.

The opaque cursor encodes `{ version: 1, occurredAt, eventId }`. An `after`
catch-up query is strictly after the newest known tuple:

```text
occurredAt > cursor.occurredAt
OR (occurredAt == cursor.occurredAt AND eventId > cursor.eventId)
```

Page size is clamped to `1..100`. Unknown, malformed, cross-conversation, or
wrong-version cursors return a typed fail-closed error and never replay page one.
Page boundaries are exclusive, so retries cannot duplicate the boundary event.

History pagination uses a `before` cursor anchored to the oldest visible tuple:

```text
occurredAt < cursor.occurredAt
OR (occurredAt == cursor.occurredAt AND eventId < cursor.eventId)
```

The storage query remains descending and the returned page is reversed for
canonical display.

The current UI tracer subscribes to the first 100 public schema-v1 events only.
Cursor navigation and additional authorized lane subscriptions remain required
before CSSC-12 can close.

## Verification Gate

Completion requires all of the following:

- Query-shape tests prove the UI subscribes to `ConversationEvent`, never raw
  `ChatMessage` comments.
- Mutation tests turn RED when space scoping, visibility, schema, lane, tuple
  ordering, page bound, or system-writer protections are removed.
- Two-page tests prove monotonic order, no duplicates, no replay on an invalid
  cursor, and no forbidden rows in serialized browser responses.
- Role-matrix live tests prove restricted events are absent at the transactor
  response for support-agent sessions and present only for authorized leads or
  compliance sessions.
- Retry tests prove one source event creates exactly one projection document.
- Log capture proves message bodies and regulated identifiers are absent from
  adapter, transactor, and browser console logs.
- Authenticated desktop and mobile portal traces pass before merge or activation.

No merge, deployment, or production activation is implied by this contract.
