# Customer Success Portal Execution Plan

Run label: `cssc-native-huly-portal-ui-r1`

Status: Active

## Objective

Deliver a production-ready, native Huly operator portal for the NDAX Customer
Success team. The portal must use the existing Customer Success workspace,
`CSI` support project, handoff provider, takeover workflow, and customer message
delivery contracts. It must not expose a privileged adapter credential to the
browser or create a second customer-facing chat surface.

## Ground Truth

- Live workspace: `b55ff770-ea00-46e9-8dbd-ebb805940dd1`
- Live URL: `https://loop.ndax.io/workbench/customersuccess/`
- Portal route: `/workbench/customersuccess/customer-success/customer-success-live-inbox`
- Engineering project: `ndax:engineering:project:customer-success-support-center`
- Engineering identifier: `CSSC`
- Support project: `ndax:support:project:customer-success-inbox`
- Support identifier: `CSI`
- Platform base: `ndaxio/develop` at `101d5bddd`
- Delivery branch: `codex/customer-success-portal`

The user has confirmed the previous backend, orchestrator, and website-widget
handoff work is complete. This run is UI-only except for narrowly required
model or contract changes that make the UI secure and deterministic.

## Architecture Guardrails

1. Build a dedicated native Huly Workbench application and plugin/resource/model
   surface that reuses Tracker,
   activity, notification, contact, view, and workbench primitives.
2. Use supported Huly model and component contracts. Do not fork the generic
   Tracker UI, inherit its create/import shell, or repurpose the existing
   end-user `support` widget.
3. Treat the orchestrator as authoritative for customer delivery and live
   session state. Huly remains the operator workspace and projection surface.
4. Use stable document and event identifiers. Never infer ordering or identity
   from display text or timestamps alone.
5. Separate public reply, internal note, restricted note, and mirrored bot or
   customer content as typed data. Hidden UI is not authorization.
6. Keep privileged adapter and service tokens out of browser code.
7. Every mutation displays pending, confirmed, failed, and reconciled states.
   The UI never reports takeover or delivery success before backend truth does.
8. Build all views for keyboard use, English and French copy, narrow operator
   widths, large queues, long transcripts, and dependency outages.

## Agent Operating Model

- Project manager: GPT-5.4 owns task decomposition, dependencies, milestone
  reconciliation, and human-gate escalation.
- Maker: implements one bounded tracer slice in the isolated branch.
- UX checker: verifies the authenticated, rendered application with real data.
- Security checker: attempts role bypass, content-lane leakage, stale-state,
  race, and browser-credential violations.
- Test checker: runs focused, integration, full build, and regression gates.
- Human owner: approves scope gates, merge, deployment tag, and production
  activation. Agents do not merge or deploy autonomously.

Maker and checker must be separate agents. A Huly task may move to Done only
after the checker records `verified: PASS` with evidence in `RUN_STATUS.md`.

## Milestones

### Read-First Spine

1. Read-only live inbox tracer
   - External key: `ndax:engineering:task:customer-success-ui:read-only-live-inbox-tracer`
   - Render live-backed rows with stable ticket identity, status, assignee,
     last activity, takeover state, and SLA or risk indicator.
   - Provide distinct loading, empty, error, and unauthorized states.
   - Expose no mutation controls.

2. Read-only conversation detail and timeline tracer
   - External key: `ndax:engineering:task:customer-success-ui:conversation-detail-timeline-tracer`
   - Open a deep-linkable detail surface from an inbox row.
   - Render customer, bot, public, internal, restricted, and system events from
     stable backend event ids without reconstructing order from timestamps.

3. Queue views, filters, and persisted operator workspace
   - External key: `ndax:engineering:task:customer-success-ui:queue-views-and-filters`
   - Add Bot Active, Takeover Requested, Unassigned, Mine, Customer Waiting,
     SLA Risk, Human Active, Escalated, and Resolved views.
   - Preserve filters, selection, and navigation state.
   - Local checkpoint: all required queues use structured server-side Issue
     predicates; queue/search/selection state is URL-backed, native Huly filters
     retain their view-resources persistence, and empty states are queue-specific.
   - Release evidence still required: authenticated desktop/mobile rendering and
     a representative large-queue query/render trace.

4. Takeover state chrome and live-session indicators
   - External key: `ndax:engineering:task:customer-success-ui:takeover-state-chrome`
   - Clearly distinguish Bot Active, Shadowing, Takeover Requested, and Human
     Active, including pending, expiry, and reconciliation states.

### Operator Actions

5. Assignment and status mutation controls
   - External key: `ndax:engineering:task:customer-success-ui:assignment-and-status-controls`
   - Enforce backend-allowed transitions and role checks.
   - Handle claim races, stale tabs, pending state, errors, and reconciliation.

6. Public reply and internal note composer split
   - External key: `ndax:engineering:task:customer-success-ui:reply-and-note-composer`
   - Keep public and internal composition visually and semantically separate.
   - Preserve drafts on failure and use returned stable ids for confirmation.
   - Display Draft, Sending, Delivered, Failed, and Suppressed outcomes.

7. Restricted-note visibility and compliance gates
   - External key: `ndax:engineering:task:customer-success-ui:restricted-note-visibility-gates`
   - Enforce restricted content on the data access path, not only in the UI.
   - Require compliance-owner sign-off before completion.

8. Realtime refresh and stale-state recovery
   - External key: `ndax:engineering:task:customer-success-ui:realtime-refresh-and-resilience`
   - Refresh without duplicate rows/events or loss of selection, scroll, or
     draft state. Recover from network and dependency failures safely.

### Production Gate

9. Production states, accessibility, localization, and performance
   - External key: `ndax:engineering:task:customer-success-ui:production-states-and-accessibility`
   - Complete keyboard, focus, screen-reader, contrast, reduced-motion,
     English/French, responsive, virtualization, and load checks.

10. UAT, cutover, rollback, and launch sign-off
    - External key: `ndax:engineering:task:customer-success-ui:uat-cutover-and-launch-signoff`
    - Run a two-agent live tracer covering queue, detail, claim, takeover,
      public reply, internal note, restricted-note denial, reconnect, and retry.
    - Record the immutable deployment commit/tag, feature flag, rollback plan,
      day-one observer, unresolved defects, and explicit go/no-go decision.

## Exit Contract

The run is complete only when all ten milestones are checker-certified, the
authenticated live tracer evidence is attached, no Sev1 or Sev2 issue remains,
and the CS lead and delivery owner record an explicit production go decision.

Maximum: 20 maker-checker cycles. Stop and surface to a human when:

- a merge, deployment tag, production migration, or activation is ready;
- public/internal/restricted content crosses its authorized boundary;
- a role check, ownership check, idempotency key, or takeover lock fails;
- live ground truth contradicts a recorded PASS;
- the same failure repeats for three consecutive cycles;
- a required compliance, retention, backup, or operational owner decision is
  unavailable at its gate.

## Mandatory Evidence Per UI Milestone

- focused and regression test output;
- build and type-validation output;
- authenticated screenshot with real support data;
- in-page interaction evidence, including keyboard and failure states;
- role-denial evidence for every privileged action introduced;
- checker verdict with exact artifact paths and live identifiers;
- clean diff review and no new hard-coded workspace ids or duplicated contracts.

## Progress Cadence

- Update Huly only at meaningful milestone transitions or on a locked finding.
- Update `RUN_STATUS.md` after every maker-checker cycle.
- Post a daily summary while work is active and immediately surface any
  high-stakes human gate.
- Never create one Huly ticket per iteration; the milestone tasks are the stable
  project-management surface.
