//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import type { Ref } from '@hcengineering/core'
import type { Issue, Project } from '@hcengineering/tracker'

import {
  buildConversationHistoryQuery,
  buildConversationIssueQuery,
  buildConversationTranscriptQuery,
  classifyConversationEntryLane,
  closeConversationQuery,
  compareConversationEntriesAscending,
  sortConversationEntriesAscending,
  openConversationQuery,
  LatestConversationRequest,
  validateIssueQueryIdentifier,
  visibleConversationEntries,
  type ConversationEntryDoc
} from '../conversation-detail'

describe('conversation detail helpers', () => {
  const projectId = 'project:support' as Ref<Project>
  const otherProjectId = 'project:other' as Ref<Project>
  const issueId = 'issue:support:42' as Ref<Issue>
  const otherIssueId = 'issue:other:7' as Ref<Issue>

  it.each(['SUP-42', 'CS-1', 'LIVE-999999', 'A1-0'])(
    'accepts only allowlisted issue query identifiers (%s)',
    (identifier) => {
      expect(validateIssueQueryIdentifier(identifier)).toBe(identifier)
    }
  )

  it.each([
    '',
    'sup-42',
    ' SUP-42',
    'SUP-42 ',
    'SUP_42',
    'SUP42',
    '42-SUP',
    'SUP--42',
    'SUP-4 OR 1=1',
    'SUP-4<script>',
    'SUP-4\ntracker:ids:NoParent'
  ])('fails closed for spoofed or malformed issue query identifiers (%s)', (identifier) => {
    expect(validateIssueQueryIdentifier(identifier)).toBeUndefined()
    expect(buildConversationIssueQuery(projectId, identifier)).toBeUndefined()
  })

  it('builds a project-scoped top-level issue query for validated identifiers only', () => {
    expect(buildConversationIssueQuery(projectId, 'SUP-42')).toEqual({
      identifier: 'SUP-42',
      space: projectId,
      attachedTo: 'tracker:ids:NoParent'
    })

    expect(buildConversationIssueQuery(otherProjectId, 'OTHER-7')).toEqual({
      identifier: 'OTHER-7',
      space: otherProjectId,
      attachedTo: 'tracker:ids:NoParent'
    })
  })

  it('opens and closes conversation query state without losing unrelated parameters', () => {
    expect(openConversationQuery({ filter: 'urgent' }, 'SUP-42')).toEqual({ filter: 'urgent', issue: 'SUP-42' })
    expect(closeConversationQuery({ filter: 'urgent', issue: 'SUP-42' })).toEqual({ filter: 'urgent' })
    expect(closeConversationQuery({ issue: 'SUP-42' })).toBeUndefined()
    expect(closeConversationQuery(undefined)).toBeUndefined()
  })

  it('refuses to place malformed identifiers into navigation state', () => {
    const current = { filter: 'urgent' }
    expect(openConversationQuery(current, 'SUP-42<script>')).toBe(current)
  })

  it('builds separate transcript and history lanes scoped by project and issue', () => {
    expect(buildConversationTranscriptQuery(projectId, issueId)).toEqual({
      space: projectId,
      attachedTo: issueId,
      attachedToClass: 'tracker:class:Issue',
      collection: 'comments',
      _class: 'chunter:class:ChatMessage',
      createdBy: 'core:account:System',
      'props.ndax_kind': {
        $in: ['support_mirror_customer', 'support_mirror_bot', 'support_agent_joined']
      }
    })

    expect(buildConversationHistoryQuery(projectId, issueId)).toEqual({
      space: projectId,
      attachedTo: issueId,
      attachedToClass: 'tracker:class:Issue',
      collection: { $ne: 'comments' },
      _class: {
        $ne: 'chunter:class:ChatMessage'
      }
    })

    expect(buildConversationTranscriptQuery(otherProjectId, otherIssueId)).toEqual({
      space: otherProjectId,
      attachedTo: otherIssueId,
      attachedToClass: 'tracker:class:Issue',
      collection: 'comments',
      _class: 'chunter:class:ChatMessage',
      createdBy: 'core:account:System',
      'props.ndax_kind': {
        $in: ['support_mirror_customer', 'support_mirror_bot', 'support_agent_joined']
      }
    })
  })

  it.each([
    [{ props: { ndax_kind: 'support_mirror_customer' } }, false, 'customer'],
    [{ props: { ndax_kind: 'support_mirror_bot' } }, false, 'bot'],
    [{ props: { ndax_kind: 'support_agent_joined' } }, false, 'system'],
    [{ props: { ndax_kind: 'support_public_reply' } }, true, 'agent']
  ] as const)('classifies exact allowlisted ndax kinds (%j)', (entry, publicAuthorVerified, expected) => {
    expect(classifyConversationEntryLane(entry, publicAuthorVerified)).toBe(expected)
  })

  it.each([
    [{ props: undefined }, false],
    [{ props: null }, false],
    [{ props: {} }, false],
    [{ props: { ndax_kind: 'gate_review' } }, false],
    [{ props: { ndax_kind: 'support_internal_note' } }, false],
    [{ props: { ndax_kind: 'support_restricted_note' } }, false],
    [{ props: { ndax_kind: 'support_public_reply' } }, false],
    [{ props: { ndax_kind: 'support_public_reply' }, createdBy: 'support-agent' }, false],
    [{ props: { ndax_kind: 'unknown_kind' } }, true],
    [{ props: { ndax_kind: ['support_public_reply'] } }, true],
    [
      {
        props: {},
        createdBy: 'support-agent',
        body: '<!-- ndax_support_public_reply -->\nVisible if body text is trusted'
      },
      true
    ]
  ])('fails closed for hidden, absent, and spoofed conversation kinds (%j)', (entry, publicAuthorVerified) => {
    expect(classifyConversationEntryLane(entry as any, publicAuthorVerified)).toBeUndefined()
  })

  it('sorts entries by createdOn then modifiedOn then _id without mutating the input', () => {
    const entries = [
      {
        _id: 'entry-c',
        _class: 'activity:class:DocUpdateMessage',
        attachedTo: issueId,
        attachedToClass: 'tracker:class:Issue',
        collection: 'activity',
        space: projectId,
        createdOn: 10,
        modifiedOn: 30
      },
      {
        _id: 'entry-b',
        _class: 'chunter:class:ChatMessage',
        attachedTo: issueId,
        attachedToClass: 'tracker:class:Issue',
        collection: 'comments',
        space: projectId,
        createdOn: 10,
        modifiedOn: 20
      },
      {
        _id: 'entry-a',
        _class: 'chunter:class:ChatMessage',
        attachedTo: issueId,
        attachedToClass: 'tracker:class:Issue',
        collection: 'comments',
        space: projectId,
        createdOn: 10,
        modifiedOn: 20
      },
      {
        _id: 'entry-d',
        _class: 'activity:class:DocUpdateMessage',
        attachedTo: issueId,
        attachedToClass: 'tracker:class:Issue',
        collection: 'activity',
        space: projectId,
        modifiedOn: 5
      }
    ] satisfies ConversationEntryDoc[]

    const sorted = sortConversationEntriesAscending(entries)

    expect(sorted.map((entry) => entry._id)).toEqual(['entry-d', 'entry-a', 'entry-b', 'entry-c'])
    expect(entries.map((entry) => entry._id)).toEqual(['entry-c', 'entry-b', 'entry-a', 'entry-d'])
  })

  it('returns only exact visible transcript kinds from mixed results', () => {
    const makeEntry = (id: string, kind: string): ConversationEntryDoc => ({
      _id: id as any,
      _class: 'chunter:class:ChatMessage' as any,
      space: projectId,
      attachedTo: issueId,
      attachedToClass: 'tracker:class:Issue' as any,
      collection: 'comments',
      modifiedBy: 'core:account:System' as any,
      createdOn: Number(id.slice(-1)),
      modifiedOn: Number(id.slice(-1)),
      props: { ndax_kind: kind }
    })
    const visible = visibleConversationEntries([
      makeEntry('entry-4', 'support_public_reply'),
      makeEntry('entry-2', 'support_mirror_bot'),
      makeEntry('entry-1', 'support_mirror_customer'),
      makeEntry('entry-3', 'support_restricted_note')
    ])

    expect(visible.map(({ message, lane }) => [message._id, lane])).toEqual([
      ['entry-1', 'customer'],
      ['entry-2', 'bot']
    ])
  })

  it('drops stale asynchronous detail requests', async () => {
    const gate = new LatestConversationRequest()
    let resolveFirst!: (value: string) => void
    const first = gate.run(async () => await new Promise<string>((resolve) => (resolveFirst = resolve)))
    const second = gate.run(async () => 'SUP-2')

    resolveFirst('SUP-1')

    await expect(second).resolves.toBe('SUP-2')
    await expect(first).resolves.toBeUndefined()
  })

  it('uses modifiedOn and then _id as stable tie-breakers for ascending comparisons', () => {
    const earlierModified: Pick<ConversationEntryDoc, '_id' | 'createdOn' | 'modifiedOn'> = {
      _id: 'entry-b',
      createdOn: 100,
      modifiedOn: 110
    }

    const laterModified: Pick<ConversationEntryDoc, '_id' | 'createdOn' | 'modifiedOn'> = {
      _id: 'entry-a',
      createdOn: 100,
      modifiedOn: 120
    }

    const sameTimestampHigherId: Pick<ConversationEntryDoc, '_id' | 'createdOn' | 'modifiedOn'> = {
      _id: 'entry-z',
      createdOn: 200,
      modifiedOn: 200
    }

    const sameTimestampLowerId: Pick<ConversationEntryDoc, '_id' | 'createdOn' | 'modifiedOn'> = {
      _id: 'entry-a',
      createdOn: 200,
      modifiedOn: 200
    }

    expect(compareConversationEntriesAscending(earlierModified, laterModified)).toBeLessThan(0)
    expect(compareConversationEntriesAscending(sameTimestampLowerId, sameTimestampHigherId)).toBeLessThan(0)
  })
})
