# Customer Success Portal Architecture

Status: CSSC-11 implemented with rendered certification pending; CSSC-12 projection detail tracer reads three authorized projection lanes with pagination helpers; CSSC-13 queue views and persisted operator state are implemented locally; CSSC-14 takeover-state chrome and secured live-session projection are locally certified, with authenticated rendering and deployment wiring still pending

## Decision

Create a dedicated Customer Success package family and standalone Workbench
application for the first production slice:

- `@hcengineering/customer-success`
- `@hcengineering/customer-success-assets`
- `@hcengineering/customer-success-resources`
- `@hcengineering/model-customer-success`

Do not extend the existing generic `support` plugin. That plugin is a widget
client abstraction and does not contain the operator queue, ticket detail,
activity, permission, or workbench application surfaces needed here.

Do not fork Tracker. Reuse its issue, presenter, viewlet, and future detail
components inside a Customer Success-owned application shell so upstream Huly
updates remain consumable without inheriting Tracker's create/import controls.

## First Tracer Composition

1. Add a standalone Customer Success `workbench.class.Application` with no
   navigation header, create component, import action, or other mutation chrome.
   The app sets `disablePanels: true` and its navigator sets
   `hideSavedViews: true` for CSSC-11.
2. Add a read-only `Live Inbox` special backed by `tracker.class.Issue` and the
   live `CSI` project.
   - `Issue.status` is the authoritative handoff/takeover workflow state.
   - `Issue.dueDate` is the nullable-safe SLA signal for the first tracer.
   - `Issue.modifiedOn` is rendered as last activity for the queue tracer.
3. Add a component extension at `tracker.extensions.IssueListHeader` for compact
   queue context and health state.
4. Reserve Tracker detail components for the conversation tracer without
   inheriting the Tracker application shell.
5. Use a Customer Success location resolver that sends unknown routes to the
   Live Inbox and fails closed for every issue-detail route until CSSC-12 ships
   a dedicated read-only detail component. The resolver clears panel fragments,
   and the Workbench stores the canonical fragment-free location for apps with
   panels disabled.
6. Reuse native reactive queries; do not add browser polling for Huly documents.
7. Keep project identity configurable through a model document or metadata.
   Never hard-code the live workspace UUID into a UI component.

## Native Building Blocks

- Queue shell and keyboard navigation: Inbox application/navigation patterns.
- List and filters: Tracker `IssuesView` and viewlets.
- Detail shell: Panel plus Tracker issue editor patterns.
- Conversation: communication message list and presenter components.
- Internal history: activity timeline.
- Metadata rail: Tracker issue control panel patterns.
- Status and assignment: Tracker status and assignee editors.
- Composition: communication message input, wrapped by typed Customer Success
  public/internal/restricted commands.
- State indicators: UI state tags, status badges, relative time, SLA time-left,
  loading, and empty-state primitives.
- Permissions: Huly class/module permissions plus server-side authorization.

## Read-Only Tracer Boundary

CSSC-11 may query and render only. It must not expose claim, assignment, status,
reply, note, export, attachment, privileged adapter actions, Tracker create or
import actions, saved-filter writes, or view-preference writes. Search and manual
refresh are query-only. This keeps the first live proof reversible while queue
accuracy, configuration, access denial, and rendered ergonomics are certified.

## CSSC-12 Projection Boundary

The first detail tracer stays inside the standalone Customer Success route and
uses `?issue=CSI-N` query state rather than Tracker's editable issue panel.
Selection resolves the issue only when `identifier`, configured support
project, and `tracker.ids.NoParent` all match. Transcript and activity remain
separate subscriptions; they are never merged into a synthetic timestamp
timeline.

The browser transcript no longer subscribes to raw `ChatMessage` comments. The
live inbox resolves three projection space ids, passes them into the detail
component, and the detail component opens three independent schema-v1
`ConversationEvent` subscriptions:

- `public`
- `internal`
- `restricted`

Each subscription is scoped by exact `space`, `issueId`, `visibility`, and
`schemaVersion: 1`. The client merges only those already-authorized results and
renders them by the immutable `(occurredAt, eventId)` tuple. Unknown schemas,
lanes, and visibility values fail closed. Client classification remains defense
in depth, not the authorization boundary.

The activity rail is still a separate project-scoped `ActivityMessage` query.
It explicitly excludes `comments` collections and raw
`chunter:class:ChatMessage` rows, so there is no transcript fallback path
through generic chat comments.

Opaque conversation cursors are now context-bound to
`(issueId, spaceId, visibility, occurredAt, eventId)` and encoded as
base64url JSON. The shared helper supports both `before` and `after` page
queries with exclusive tuple bounds; the current UI consumes `before` for
`Load earlier`, while reactive subscriptions handle forward updates.

The model layer now defines a dedicated `ConversationProjectionSpace` typed
space, a `ConversationProjectionSpaceTypeData` mixin, three projection roles,
and nine space-scoped human mutation forbids covering create, update, and remove
for `ConversationEvent` and `ConversationBinding`, plus projection-space and
role-assignment mutation. Restricted-space
enforcement keeps a single system-account bypass for the trusted writer.

CSSC-12 is still not fully closed. The docs and code now agree on the read
model, subscription shape, and cursor contract, but two deployment-facing
steps remain:

1. Production metadata overrides are wired, but deployment values still need
   to be set when a rollout does not use the deterministic defaults.
2. This repo defines the projection space type and default ids; the companion
   adapter branch provisions the three concrete typed spaces and role-member
   assignments, which still require deployment and live proof.

See `PROJECTION-CONTRACT.md`. UI concealment of a broader raw subscription is
explicitly prohibited.

English and French are the authored operator locales for this delivery. Other
locale files intentionally carry English fallback text so package loading and
locale shape remain valid until those translations are commissioned.

## CSSC-13 Queue Boundary

The Live Inbox keeps its read-only `ViewletContentView` and adds native Huly
`FilterButton` and `FilterBar` controls. Queue selection and bounded text search
are URL-backed so refresh, deep links, ticket selection, and back/forward
navigation preserve operator context. Native filter state remains stored by the
view-resources filter key.

The first queue contract is deliberately limited to structured Tracker fields:

- Bot Active, Takeover Requested, Customer Waiting, Human Active, and Escalated
  use exact support workflow status ids.
- Unassigned and Mine exclude Resolved and Closed tickets. Mine fails closed
  when the current employee cannot be resolved.
- Resolved includes both Resolved and Closed terminal states.
- SLA Risk means a non-terminal ticket with a positive `dueDate` at or before
  the current time. Due-soon windows, SLA tiers, and risk flags require a later
  structured data contract; description text is never parsed into a queue
  predicate.

All queue predicates execute as server-side document queries. The companion
count subscription requests at most one row and the viewlet retains native
virtualized/list rendering behavior. Authenticated large-queue query-plan and
render evidence remains a release gate because `Issue.dueDate` has no dedicated
Customer Success index in this checkpoint.

## CSSC-14 Live Session Boundary

The conversation workspace subscribes reactively to the support Issue and to
one schema-v1 `LiveSessionState` document in the internal projection space.
Issue status and assignee remain authoritative for the four visible ownership
states and claim owner. Adapter-computed expiry and recovery metadata is shown
only when issue id, source status, claim owner, and observation time reconcile;
otherwise it is withheld.

Takeover Requested is always presented as pending backend acknowledgement.
Only exact Human Active with a current adapter acknowledgement may render
takeover confirmed; unmatched Human Active displays reconciliation pending. The
chrome is read-only; claim, acknowledgement, release, assignment, and status mutations
remain CSSC-15 scope. The adapter requires internal projection readiness before
successful support transitions and materializes state only after successful
conditional writes.

The portal addresses the live-session row by its collision-free deterministic
id as well as exact internal space, issue id, and schema. The adapter verifies
the deployed model class and internal space before support mutation and derives
conversation identity only from the exact immutable binding.

## CSSC-15 Support Action Request Boundary

Claim-self is introduced as one narrow browser-side mutation surface. The
browser creates a deterministic schema-v1 `SupportActionRequest` document in the
internal projection space through the ordinary authenticated Huly client:

`ndax:support:action-request:<issueId>:<currentAccountUuid>:claim_self:<expectedModifiedOn>`

CSSC-15A keeps that path intact and adds a second lead-only request shape for
conservative assignee mutations:

`ndax:support:action-request:<issueId>:<currentAccountUuid>:assign_assignee:<requestedAssignee>:<expectedModifiedOn>`

CSSC-15B adds a third request shape for lead-only reassignment:

`ndax:support:action-request:<issueId>:<currentAccountUuid>:reassign_assignee:<requestedAssignee>:<expectedModifiedOn>`

CSSC-15C adds a fourth request shape for a deliberately narrow status menu:

`ndax:support:action-request:<issueId>:<currentAccountUuid>:transition_status:<requestedStatus>:<expectedModifiedOn>`

Creation is guarded by `client.apply(requestId).notMatch(...)` on the globally
unique exact id. The reactive read additionally matches the internal space,
issue id, and schema version. The browser does not call the adapter directly and
does not receive adapter tokens.

After refresh, the portal discovers only support-action rows whose deterministic
id encodes the current account and whose issue, internal space, and schema
match. It deterministically selects the latest relevant row and then returns to
the exact-id subscription. Pending and terminal conflict evidence can survive
an issue snapshot change; succeeded rows remain relevant only while their
claimed or assigned outcome still matches issue truth. A stale terminal row is
displayable but cannot disable a valid action on a newer snapshot.

SupportAgent and SupportLead role membership in the internal projection space is
the only UI path that may render the claim-self control. Compliance-only or
otherwise unauthorized viewers may still read the rest of the detail page when
authorized for it, but they must not see action controls or action-request
status chrome.

SupportLead membership is the only UI path that may render the lead-assignment
picker. The picker filters only active Persons mapped from SupportAgent or
SupportLead assignments in the internal projection space, but that filtering is
advisory. The adapter independently requires the target to be active, hold a
support role, and appear in that same internal projection roster. It also binds
portal-shaped deterministic ids to the immutable create-transaction creator and
requires that creator to remain in the internal SupportLead roster.

Reassignment reuses the native picker only for already-assigned tickets in the
conservative pre-live statuses. It is a pure assignee CAS from the exact prior
Person to a different eligible Person. It is unavailable in Takeover Requested
and Human Active, performs no status transition, and has no compliance override
or force-transfer path.

Status controls use a native compact menu and are visible only to the confirmed
current owner of an acknowledged Human Active session. The only schema-v1
targets are Waiting on Customer and Waiting on Internal. The adapter requires a
current issue-bound live-session proof and performs a status-only CAS. Escalated
is excluded because a regulated specialist handoff requires destination,
reason, and handoff evidence rather than a bare status; terminal and reopen
behavior remains CSSC-15D.

CSSC-15D follows the conservative state machine in
`TERMINAL-LIFECYCLE-CONTRACT.md`. The current assigned support-role holder may
resolve Human Active, Waiting on Customer, or Waiting on Internal after an
explicit confirmation and controlled reason. Only an internal-roster
SupportLead may reopen Resolved, and the existing eligible assignee is
preserved. Closed remains system/retention-only, while Escalated keeps its
separate regulated handoff policy. Terminal and reopen requests are distinct
from `transition_status`; browser clients still create immutable intent and
never write the Issue directly.

Waiting on Customer and Waiting on Internal additionally require a fresh
issue-bound live-session projection whose source status, projected owner, and
observation time still reconcile with the authoritative issue snapshot. The
button may remain present for context, but submit stays disabled and the dialog
surfaces stale proof rather than inventing success.

CSSC-16 keeps the same boundary and adds two native text-only composers under
the transcript: Public reply and Internal note. Both surfaces still create only
authenticated `SupportActionRequest` docs in the protected internal projection
space. No adapter token, service token, raw `ChatMessage`/comment write, or
direct HTTP delivery path is introduced. Public reply is owner-only and
requires current live-session or waiting-state proof. Internal note is limited
to active SupportAgent/SupportLead roster members on non-terminal support
tickets. Each draft receives a stable in-memory `deliveryId`; retries preserve
that id until trusted sent/already-sent event reconciliation or explicit
suppression clears the draft.

The controls remain hidden until the adapter and orchestrator prerequisites in
the lifecycle contract are present: support tickets cannot use the generic
status route, lifecycle projections are monotonic, bot mirroring cannot erase a
terminal/reopened status, and Reopened has deterministic human-owned bot
suppression independent of stale local session state.

`SupportActionRequest.state` is advisory workflow state, not takeover truth.
Pending, processing, failed, and superseded may be rendered reactively. Even
`state: succeeded` means only that adapter-side processing completed; takeover
success is still gated exclusively by reconciled `LiveSessionState` plus
authoritative `Issue.status`. For `assign_assignee` and `reassign_assignee`, `state: succeeded` still
means only that processing completed; the portal treats success as pending until
the reactive `Issue` snapshot shows the requested assignee on the current or a
newer `modifiedOn`.

For terminal requests, failed/superseded rows remain actionable UX evidence:
the portal preserves reason/detail in memory, hydrates them from the observed
row after refresh, keeps the optimistic lock until the exact row is observed or
timed out, and distinguishes stale snapshot/projection proof from a
deterministic-id conflict on the current snapshot.

## Registration Surface

The package family will require registration in:

- `rush.json`
- the aggregate model loader under `models/all`
- the production client resource loader under `dev/prod`
- plugin, resource, asset, and model dependency manifests

The exact registration pattern should follow existing Tracker, Request, Support,
and other small four-package plugin families.

## Upgrade Boundary

Deployment must follow `docs/ndax-huly-deployment-policy.md`: the Huly stack and
adapter are built and identified from the same immutable NDAX fork commit or
tag. Merge, deployment tagging, server rollout, and activation remain human
gates.
