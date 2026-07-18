//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const componentDir = join(__dirname, '..', 'components')
const detailSource = readFileSync(join(componentDir, 'ConversationDetail.svelte'), 'utf8')
const composerSource = readFileSync(join(componentDir, 'ConversationComposer.svelte'), 'utf8')
const presenterSource = readFileSync(join(componentDir, 'TicketPresenter.svelte'), 'utf8')
const inboxSource = readFileSync(join(componentDir, 'LiveInbox.svelte'), 'utf8')
const takeoverSource = readFileSync(join(componentDir, 'TakeoverStateChrome.svelte'), 'utf8')
const terminalDialogSource = readFileSync(join(componentDir, 'TerminalActionDialog.svelte'), 'utf8')
const scrollerSource = readFileSync(
  join(__dirname, '..', '..', '..', '..', 'packages', 'ui', 'src', 'components', 'Scroller.svelte'),
  'utf8'
)

describe('conversation detail UI security contract', () => {
  it('uses project-scoped read-only queries and separates transcript from activity', () => {
    expect(detailSource).toContain('buildConversationIssueQuery(supportProjectId, identifier)')
    expect(detailSource).toContain('projectionSpaceIds[visibility]')
    expect(detailSource).toContain("['public', 'internal', 'restricted'] as const")
    expect(detailSource).toContain('buildConversationHistoryQuery(projectId, target._id)')
    expect(detailSource).toContain('readonly: true')
    expect(detailSource).toContain('withActions: false')
    expect(detailSource).not.toContain('showArchived: true')
  })

  it('subscribes to the materialized projection instead of raw chat comments', () => {
    expect(detailSource).toContain('customerSuccess.class.ConversationEvent')
    expect(detailSource).toContain('visibleConversationEntries(')
    expect(detailSource).toContain('buildConversationEventFindOptions()')
    expect(detailSource).toContain("buildConversationPageQuery(context, cursor, 'before')")
    expect(detailSource).toContain('mergeConversationEventPages(')
    expect(detailSource).toContain('paginationRequest.invalidate()')
    expect(detailSource).toContain('issue?._id !== targetId')
    expect(detailSource).not.toContain('chunter.class.ChatMessage')
    expect(detailSource).not.toContain('ndax_support_public_reply')
    expect(detailSource).not.toContain('createdBy ===')
  })

  it('preserves the transcript scroll anchor across live updates and history pagination', () => {
    expect(detailSource).toContain('bind:divScroll={conversationScroll}')
    expect(detailSource).toContain('captureConversationScrollAnchor({')
    expect(detailSource).toContain("refreshVisibleMessages('prepend')")
    expect(detailSource).toContain('resolveConversationScrollTop(anchor, conversationScroll.scrollHeight, update)')
  })

  it('keeps loaded transcript data and exposes a retry when history pagination fails', () => {
    expect(detailSource).toContain('earlierLoadFailed = false')
    expect(detailSource).toContain('earlierLoadFailed = true')
    expect(detailSource).toContain('{#if earlierLoadFailed}')
    expect(detailSource).toContain('role="status"')
    expect(detailSource).toContain('aria-live="polite"')
  })

  it('bounds activity history, drops stale pagination, and virtualizes off-screen rows', () => {
    expect(detailSource).toContain('buildConversationHistoryFindOptions()')
    expect(detailSource).toContain('buildConversationHistoryPageQuery(projectId, targetId, oldest)')
    expect(detailSource).toContain('historyPaginationRequest.invalidate()')
    expect(detailSource).toContain('mergeConversationHistoryPages(history, page)')
    expect(detailSource).toContain('historyEarlierLoadFailed = true')
    expect(detailSource).toContain('content-visibility: auto')
    expect(detailSource).toContain('contain-intrinsic-size: auto')
  })

  it('invalidates in-flight pages during refresh and unsubscribes every query on destroy', () => {
    expect(detailSource).toMatch(/function refreshDetail[\s\S]*?paginationRequest\.invalidate\(\)/)
    expect(detailSource).toMatch(/function refreshDetail[\s\S]*?historyPaginationRequest\.invalidate\(\)/)
    expect(detailSource).toContain('function stopAllQueries')
    expect(detailSource).toContain('onDestroy(stopAllQueries)')
  })

  it('reactively subscribes to issue truth and the issue-bound internal live-session projection', () => {
    expect(detailSource).toContain('issueQuery.query(')
    expect(detailSource).toContain('customerSuccess.class.LiveSessionState')
    expect(detailSource).toContain('buildLiveSessionStateQuery(projectionSpaceIds.internal, targetId)')
    expect(detailSource).toContain('customerSuccess.class.SupportActionRequest')
    expect(detailSource).toContain('supportActionRequestHydrationQuery')
    expect(detailSource).toContain('buildSupportActionRequestHydrationQuery(')
    expect(detailSource).toContain('selectHydratedSupportActionRequestId(')
    expect(detailSource).toContain('buildSupportActionRequestQuery(projectionSpaceIds.internal, requestId, target._id)')
    expect(detailSource).toContain('hydratedSupportActionRequestId ??')
    expect(detailSource).toContain('supportActionRequestHydrationQuery.refreshClient()')
    expect(detailSource).toContain('customerSuccess.class.ConversationProjectionSpace')
    expect(detailSource).toContain('resolveSupportActionRoleAssignments(internalProjectionSpace, hierarchy)')
    expect(detailSource).toContain('canonicalSupportAssignee(')
    expect(detailSource).toContain('{ ...issue, assignee: canonicalIssueAssignee }')
    expect(detailSource).toContain(
      'resolveTakeoverChromeState({ ...issue, assignee: cachedAssignee }, liveSessionState)'
    )
    expect(detailSource).toContain('assignee: canonicalAssignee')
    expect(detailSource).toContain('supportActionRoles.supportLead.includes(currentAccount.uuid)')
    expect(detailSource).toContain("state === 'ready' && issue !== undefined")
    expect(detailSource).toContain('<TakeoverStateChrome')
    expect(detailSource).toContain('actionRequest={supportActionRequest}')
    expect(detailSource).toContain('assignee={canonicalIssueAssignee}')
    expect(detailSource).not.toContain('client.findOne(tracker.class.Issue')
  })

  it('keeps takeover chrome request-scoped and confirms success only through reconciled issue status', () => {
    expect(takeoverSource).toContain('resolveTakeoverChromeState(actionIssue, projection)')
    expect(takeoverSource).toContain('assignee: chrome.projectionCurrent ? chrome.claimOwner : actionIssue.assignee')
    expect(takeoverSource).toContain('resolveClaimSelfControlState(')
    expect(takeoverSource).toContain('resolveAssignLeadControlState(')
    expect(takeoverSource).toContain('resolveStatusTransitionControlState(')
    expect(takeoverSource).toContain('shouldShowSupportActionRequestState(')
    expect(takeoverSource).toContain('<AssigneeBox')
    expect(takeoverSource).toContain('if (event.detail == null) return')
    expect(takeoverSource).toContain('resolveReassignLeadControlState(actionIssue, actionRequest, event.detail')
    expect(takeoverSource).toContain('role="group"')
    expect(takeoverSource).toContain('aria-labelledby="customer-success-assign-lead-label"')
    expect(takeoverSource).toContain('aria-disabled={!assigneeChange.canSelect}')
    expect(takeoverSource).toContain('aria-busy={assigneeChange.busy}')
    expect(takeoverSource).toContain('readonly={!assigneeChange.canSelect}')
    expect(takeoverSource).toContain('id="customer-success-assign-lead-picker"')
    expect(takeoverSource).toContain('allowDeselect={false}')
    expect(takeoverSource).toContain('chrome.pendingAcknowledgement')
    expect(takeoverSource).toContain('chrome.confirmed')
    expect(takeoverSource).toContain('chrome.expired')
    expect(takeoverSource).toContain('customerSuccess.string.LockExpired')
    expect(takeoverSource).toContain('customerSuccess.string.ClaimRequestAwaitingReconciliation')
    expect(takeoverSource).toContain('customerSuccess.string.AssignLeadRequestAwaitingReconciliation')
    expect(takeoverSource).toContain('customerSuccess.string.AssignLeadConfirmed')
    expect(takeoverSource).toContain('if (submissionFailed) return StateType.Negative')
    expect(takeoverSource).toContain('void requestClaimSelf()')
    expect(takeoverSource).toContain('void requestAssignLead(event.detail)')
    expect(takeoverSource).toContain('<ButtonMenu')
    expect(takeoverSource).toContain('id="customer-success-status-actions"')
    expect(takeoverSource).toContain("id: 'ndax:status:support:WaitingOnCustomer'")
    expect(takeoverSource).toContain("id: 'ndax:status:support:WaitingOnInternal'")
    expect(takeoverSource).not.toContain("id: 'ndax:status:support:Resolved'")
    expect(takeoverSource).not.toContain("id: 'ndax:status:support:Escalated'")
    expect(detailSource).toContain('submitTransitionStatusSupportActionRequest(')
    expect(detailSource).toContain('buildAssignLeadCandidateQuery(assignLeadCandidates)')
    expect(takeoverSource).not.toContain("actionRequest.state === 'succeeded' && chrome.confirmed")
    expect(takeoverSource).not.toContain('acknowledgeSupportTicketTakeover')
  })

  it('uses a native accessible confirmation dialog with memory-only controlled reasons', () => {
    expect(takeoverSource).toContain("import TerminalActionDialog from './TerminalActionDialog.svelte'")
    expect(takeoverSource).toContain('resolveTerminalActionControlState(')
    expect(takeoverSource).toContain('<TerminalActionDialog')
    expect(takeoverSource).toContain('terminalDialogSnapshot = {')
    expect(takeoverSource).toContain('bind:reasonCode={terminalDraftReasonCode}')
    expect(takeoverSource).toContain('stale={terminalDialogStale()}')
    expect(takeoverSource).toContain('conflict={terminalDialogConflict()}')
    expect(detailSource).toContain('issue.modifiedOn !== snapshot.modifiedOn')
    expect(detailSource).toContain('canonicalIssueAssignee !== snapshot.assignee')
    expect(detailSource).toContain('supportActionRequestObservationTimeoutMs = 8000')
    expect(detailSource).toContain('armSupportActionRequestObservationTimeout(requestId)')
    expect(detailSource).toContain('if (activeSupportActionRequestId === requestId && actionSubmitting) return')
    expect(detailSource).toMatch(
      /if \(!committed\.result\) \{[\s\S]*?actionSubmissionFailed = true[\s\S]*?return false/
    )
    expect(detailSource).toContain('$employeeByIdStore.get(canonicalIssueAssignee as Ref<Employee>)?.active === true')
    expect(terminalDialogSource).toContain('<dialog')
    expect(terminalDialogSource).toContain('dialog.showModal()')
    expect(terminalDialogSource).toContain('aria-labelledby="customer-success-terminal-dialog-title"')
    expect(terminalDialogSource).toContain('aria-describedby={statusIds}')
    expect(terminalDialogSource).toContain('aria-modal="true"')
    expect(terminalDialogSource).toContain('aria-busy={submitting}')
    expect(terminalDialogSource).toContain('on:cancel|preventDefault={close}')
    expect(terminalDialogSource).toContain('on:click={handleBackdropClick}')
    expect(terminalDialogSource).toContain('type="radio"')
    expect(terminalDialogSource).toContain('required')
    expect(terminalDialogSource).toContain('maxlength={terminalReasonDetailMaxLength}')
    expect(terminalDialogSource).toContain('role={stale || conflict || submissionFailed')
    expect(terminalDialogSource).toContain('aria-live={stale || conflict || submissionFailed')
    expect(terminalDialogSource).toContain('previousFocus?.focus()')
    expect(terminalDialogSource).not.toMatch(/localStorage|sessionStorage|indexedDB/)
    expect(takeoverSource).not.toContain("id: 'ndax:status:support:Closed'")
    expect(takeoverSource).not.toContain("id: 'ndax:status:support:Escalated'")
    expect(takeoverSource).not.toContain('StatusEditor')
  })

  it('labels non-public events and never hides authorization behind CSS-only filtering', () => {
    expect(detailSource).toContain("entry.visibility === 'internal'")
    expect(detailSource).toContain("entry.visibility === 'restricted'")
    expect(detailSource).toContain('visibilityLabel(entry.visibility)')
    expect(detailSource).toContain('customerSuccess.string.LoadEarlier')
    expect(detailSource).not.toContain('filter((entry) => entry.visibility')
  })

  it('does not import write-capable issue or chat controls', () => {
    for (const forbidden of ['EditIssue', 'ChatMessageInput', 'StatusEditor', 'AssigneeEditor', 'updateAttribute']) {
      expect(detailSource).not.toContain(forbidden)
    }
  })

  it('renders separate native public, internal, and restricted composers without raw delivery paths', () => {
    expect(detailSource).toContain("import ConversationComposer from './ConversationComposer.svelte'")
    expect(detailSource).toContain('<ConversationComposer')
    expect(detailSource).toContain('action="post_public_reply"')
    expect(detailSource).toContain('action="post_internal_note"')
    expect(detailSource).toContain('action="post_restricted_note"')
    expect(detailSource).toContain('composerDrafts.post_public_reply')
    expect(detailSource).toContain('composerDrafts.post_internal_note')
    expect(detailSource).toContain('composerDrafts.post_restricted_note')
    expect(detailSource).toContain('customerSuccess.string.PublicReply')
    expect(detailSource).toContain('customerSuccess.string.InternalNote')
    expect(detailSource).toContain('customerSuccess.string.RestrictedNote')
    expect(detailSource).toContain(
      'conversationComposerRequestSpace(action, projectionSpaceIds.internal, projectionSpaceIds.restricted)'
    )
    expect(detailSource).toContain('isRestrictedSupportActionRoleMember(')
    expect(detailSource).toContain('restrictedProjectionSpace,')
    expect(detailSource).toContain('submitConversationMessageSupportActionRequest(')
    expect(detailSource).toContain('conversationMessageSupportActionRequestId(')
    expect(detailSource).toContain('generateId()')
    expect(detailSource).toContain('shouldClearConversationComposerDraft(')
    expect(detailSource).toContain('for (const query of Object.values(composerRequestQueries)) query.refreshClient()')
    expect(detailSource).toContain("composerRequests[action]?.state === 'failed'")
    expect(detailSource).toContain("composerRequests[action]?.state === 'superseded'")
    expect(detailSource).not.toContain('fetch(')
    expect(detailSource).not.toContain('XMLHttpRequest')
    expect(detailSource).not.toContain('Authorization:')
    expect(detailSource).not.toContain('serviceToken')
    expect(detailSource).not.toContain('createComment')
    expect(detailSource).not.toContain('ChatMessage')
  })

  it('keeps the native composers text-only, memory-only, and accessible without a mode dropdown', () => {
    expect(composerSource).toContain('<textarea')
    expect(composerSource).toContain('aria-labelledby={titleId}')
    expect(composerSource).toContain('id={inputId}')
    expect(composerSource).toContain('aria-describedby={statusId}')
    expect(composerSource).toContain('aria-live="polite"')
    expect(composerSource).toContain('translateCB(placeholder')
    expect(composerSource).toContain('maxlength={conversationComposerMessageMaxLength}')
    expect(composerSource).toContain('document.contains(previousFocus)')
    expect(composerSource).toContain('target?.focus()')
    expect(composerSource).toContain('customerSuccess.string.ConversationComposerSending')
    expect(composerSource).toContain('customerSuccess.string.ConversationComposerDelivered')
    expect(composerSource).toContain('customerSuccess.string.ConversationComposerSuppressed')
    expect(composerSource).toContain('customerSuccess.string.ConversationComposerFailed')
    expect(composerSource).not.toMatch(/localStorage|sessionStorage|indexedDB/)
    expect(composerSource).not.toContain('Attachment')
    expect(composerSource).not.toContain('LinkPreview')
    expect(composerSource).toContain("class:restricted={action === 'post_restricted_note'}")
    expect(composerSource).toContain("data-visibility={action === 'post_restricted_note'")
    expect(composerSource).not.toContain('<select')
    expect(composerSource).not.toContain('dropdown')
  })

  it('hydrates parent-owned memory drafts without resetting them during query refresh', () => {
    expect(detailSource).toContain('export let initialComposerDrafts')
    expect(detailSource).toContain('export let onComposerDraftChange')
    expect(detailSource).toContain('onComposerDraftChange(action, value)')
    expect(detailSource).toContain('ensureComposerDeliveryIds(issue)')
    expect(detailSource).not.toContain("composerDrafts = {\n      post_public_reply: ''")
  })

  it('opens detail in query state and clears panel fragments', () => {
    expect(presenterSource).toContain('openConversationQuery(loc.query, object.identifier)')
    expect(presenterSource).toContain("loc.fragment = ''")
    expect(presenterSource).toContain('<NavLink {href}')
    expect(inboxSource).toContain('closeConversationQuery(loc.query)')
    expect(inboxSource).toContain("loc.fragment = ''")
  })

  it('keeps localized back and retry controls available outside ready state', () => {
    expect(detailSource.indexOf('<Header')).toBeLessThan(detailSource.indexOf("{#if state === 'loading'}"))
    expect(detailSource).toContain('label={customerSuccess.string.BackToInbox}')
    expect(detailSource).toContain('label={customerSuccess.string.Refresh}')
  })

  it('uses keyboard-operable mobile tabs without hiding a lane behind click-only TabList', () => {
    expect(detailSource).not.toContain('<TabList')
    expect(detailSource).toContain('role="tablist"')
    expect(detailSource).toContain('aria-labelledby="customer-success-detail-views"')
    expect(detailSource).toContain('role="tab"')
    expect(detailSource).toContain('nextConversationDetailLane(mobileLane, event.key)')
    expect(detailSource).toContain("role={$deviceInfo.isMobile ? 'tabpanel' : undefined}")
  })

  it('makes both long operator timelines keyboard-scrollable and heading-labelled', () => {
    expect(detailSource).toContain("element.setAttribute('role', 'region')")
    expect(detailSource).toContain("element.setAttribute('aria-labelledby', labelledBy)")
    expect(detailSource).toContain('element.tabIndex = 0')
    expect(detailSource).toContain("configureTimelineRegion(conversationScroll, 'customer-success-conversation-heading')")
    expect(detailSource).toContain("configureTimelineRegion(activityScroll, 'customer-success-activity-heading')")
    expect(detailSource).toContain('bind:divScroll={conversationScroll}')
    expect(detailSource).toContain('bind:divScroll={activityScroll}')
    expect(scrollerSource).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('includes the ticket identifier in the single row link accessible name', () => {
    expect(presenterSource).toContain('<span class="sr-only">{object.identifier}: </span>{label}')
  })
})
