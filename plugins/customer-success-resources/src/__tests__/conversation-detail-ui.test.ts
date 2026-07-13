//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const componentDir = join(__dirname, '..', 'components')
const detailSource = readFileSync(join(componentDir, 'ConversationDetail.svelte'), 'utf8')
const presenterSource = readFileSync(join(componentDir, 'TicketPresenter.svelte'), 'utf8')
const inboxSource = readFileSync(join(componentDir, 'LiveInbox.svelte'), 'utf8')
const takeoverSource = readFileSync(join(componentDir, 'TakeoverStateChrome.svelte'), 'utf8')

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

  it('reactively subscribes to issue truth and the issue-bound internal live-session projection', () => {
    expect(detailSource).toContain('issueQuery.query(')
    expect(detailSource).toContain('customerSuccess.class.LiveSessionState')
    expect(detailSource).toContain('buildLiveSessionStateQuery(projectionSpaceIds.internal, targetId)')
    expect(detailSource).toContain('customerSuccess.class.SupportActionRequest')
    expect(detailSource).toContain('buildSupportActionRequestQuery(projectionSpaceIds.internal, requestId, target._id)')
    expect(detailSource).toContain('customerSuccess.class.ConversationProjectionSpace')
    expect(detailSource).toContain('isSupportActionRoleMember(internalProjectionSpace, hierarchy, currentAccount.uuid)')
    expect(detailSource).toContain("state === 'ready' && issue !== undefined")
    expect(detailSource).toContain('<TakeoverStateChrome')
    expect(detailSource).toContain('actionRequest={supportActionRequest}')
    expect(detailSource).not.toContain('client.findOne(tracker.class.Issue')
  })

  it('keeps takeover chrome request-scoped and confirms success only through reconciled issue status', () => {
    expect(takeoverSource).toContain('resolveTakeoverChromeState(issue, projection)')
    expect(takeoverSource).toContain('resolveClaimSelfControlState(')
    expect(takeoverSource).toContain('chrome.pendingAcknowledgement')
    expect(takeoverSource).toContain('chrome.confirmed')
    expect(takeoverSource).toContain('chrome.expired')
    expect(takeoverSource).toContain('customerSuccess.string.LockExpired')
    expect(takeoverSource).toContain('customerSuccess.string.ClaimRequestAwaitingReconciliation')
    expect(takeoverSource).toContain('void requestClaimSelf()')
    expect(takeoverSource).not.toContain("actionRequest.state === 'succeeded' && chrome.confirmed")
    expect(takeoverSource).not.toContain('acknowledgeSupportTicketTakeover')
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
    expect(detailSource).toContain("event.key !== 'ArrowLeft' && event.key !== 'ArrowRight'")
    expect(detailSource).toContain("role={$deviceInfo.isMobile ? 'tabpanel' : undefined}")
  })

  it('includes the ticket identifier in the single row link accessible name', () => {
    expect(presenterSource).toContain('<span class="sr-only">{object.identifier}: </span>{label}')
  })
})
