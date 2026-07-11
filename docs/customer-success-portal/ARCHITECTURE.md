# Customer Success Portal Architecture

Status: CSSC-11 implemented with rendered certification pending; CSSC-12 partial tracer under review

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

## CSSC-12 Partial Detail Boundary

The first detail tracer stays inside the standalone Customer Success route and
uses `?issue=CSI-N` query state rather than Tracker's editable issue panel.
Selection resolves the issue only when `identifier`, configured support
project, and `tracker.ids.NoParent` all match. Transcript and activity remain
separate subscriptions; they are never merged into a synthetic timestamp
timeline.

The browser transcript query is intentionally narrower than the final product.
It requests only exact `support_mirror_customer`, `support_mirror_bot`, and
`support_agent_joined` comments authored by `core.account.System`. Restricted,
internal, unknown, untyped, public, and archived comments are excluded in the
Huly query before browser delivery. Client classification remains a secondary
fail-closed guard, not the authorization boundary.

CSSC-12 cannot close until an authoritative server-side projection supplies
public, internal, and role-gated restricted lanes with stable event ids,
provenance, cursor/order semantics, and bounded pagination. UI concealment of a
broader raw comment subscription is explicitly prohibited.

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
