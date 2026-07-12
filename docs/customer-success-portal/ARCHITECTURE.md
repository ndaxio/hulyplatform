# Customer Success Portal Architecture

Status: CSSC-11 implemented with rendered certification pending; CSSC-12 projection detail tracer now reads three authorized projection lanes with pagination helpers, but deployment wiring and space provisioning remain incomplete

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
