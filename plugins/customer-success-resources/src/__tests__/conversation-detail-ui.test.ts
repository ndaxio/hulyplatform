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

describe('conversation detail UI security contract', () => {
  it('uses project-scoped read-only queries and separates transcript from activity', () => {
    expect(detailSource).toContain('buildConversationIssueQuery(supportProjectId, identifier)')
    expect(detailSource).toContain('buildConversationTranscriptQuery(projectId, target._id)')
    expect(detailSource).toContain('buildConversationHistoryQuery(projectId, target._id)')
    expect(detailSource).toContain('readonly: true')
    expect(detailSource).toContain('withActions: false')
    expect(detailSource).not.toContain('showArchived: true')
  })

  it('keeps unverifiable public and unknown comments fail-closed', () => {
    expect(detailSource).toContain('visibleConversationEntries(result as SupportChatMessage[])')
    expect(detailSource).not.toContain('ndax_support_public_reply')
    expect(detailSource).not.toContain('createdBy ===')
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
    expect(detailSource).toContain('role="tab"')
    expect(detailSource).toContain("event.key !== 'ArrowLeft' && event.key !== 'ArrowRight'")
    expect(detailSource).toContain("role={$deviceInfo.isMobile ? 'tabpanel' : undefined}")
  })

  it('includes the ticket identifier in the single row link accessible name', () => {
    expect(presenterSource).toContain('<span class="sr-only">{object.identifier}: </span>{label}')
  })
})
