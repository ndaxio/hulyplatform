//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import type { Ref } from '@hcengineering/core'
import type { Issue, Project } from '@hcengineering/tracker'

import {
  buildConversationHistoryQuery,
  buildConversationEventFindOptions,
  buildConversationIssueQuery,
  buildConversationTranscriptQuery,
  classifyConversationEntryLane,
  closeConversationQuery,
  compareConversationEntriesAscending,
  compareConversationEventsAscending,
  sortConversationEntriesAscending,
  sortConversationEventsAscending,
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

  it('queries only the materialized public projection for the transcript lane', () => {
    expect(buildConversationTranscriptQuery(projectId, issueId)).toEqual({
      space: projectId,
      issueId,
      visibility: 'public',
      schemaVersion: 1
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
      issueId: otherIssueId,
      visibility: 'public',
      schemaVersion: 1
    })
  })

  it('bounds the projection subscription and orders it by the immutable cursor tuple', () => {
    expect(buildConversationEventFindOptions()).toEqual({
      limit: 100,
      sort: {
        occurredAt: -1,
        eventId: -1
      }
    })
  })

  it.each([
    [{ lane: 'customer', visibility: 'public', schemaVersion: 1 }, 'customer'],
    [{ lane: 'bot', visibility: 'public', schemaVersion: 1 }, 'bot'],
    [{ lane: 'system', visibility: 'public', schemaVersion: 1 }, 'system'],
    [{ lane: 'agent', visibility: 'public', schemaVersion: 1 }, 'agent']
  ] as const)('classifies exact schema-v1 public projection lanes (%j)', (entry, expected) => {
    expect(classifyConversationEntryLane(entry)).toBe(expected)
  })

  it.each([
    undefined,
    null,
    {},
    { lane: 'customer', visibility: 'internal', schemaVersion: 1 },
    { lane: 'agent', visibility: 'restricted', schemaVersion: 1 },
    { lane: 'customer', visibility: 'public', schemaVersion: 0 },
    { lane: 'customer', visibility: 'public', schemaVersion: 2 },
    { lane: 'unknown', visibility: 'public', schemaVersion: 1 },
    { lane: ['agent'], visibility: 'public', schemaVersion: 1 },
    { lane: 'agent', visibility: 'PUBLIC', schemaVersion: 1 }
  ])('fails closed for hidden, malformed, unknown, and unsupported projection events (%j)', (entry) => {
    expect(classifyConversationEntryLane(entry as any)).toBeUndefined()
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

  it('sorts projection events by occurredAt then stable eventId without mutating the input', () => {
    const events = [
      { eventId: 'evt-c', occurredAt: 20 },
      { eventId: 'evt-b', occurredAt: 10 },
      { eventId: 'evt-a', occurredAt: 10 }
    ]

    const sorted = sortConversationEventsAscending(events)

    expect(sorted.map((event) => event.eventId)).toEqual(['evt-a', 'evt-b', 'evt-c'])
    expect(events.map((event) => event.eventId)).toEqual(['evt-c', 'evt-b', 'evt-a'])
    expect(compareConversationEventsAscending(events[2], events[1])).toBeLessThan(0)
  })

  it('returns only exact schema-v1 public lanes from mixed projection results', () => {
    const makeEntry = (
      id: string,
      lane: string,
      visibility: string = 'public',
      schemaVersion: number = 1
    ): ConversationEntryDoc => ({
      _id: id as any,
      _class: 'customer-success:class:ConversationEvent' as any,
      space: projectId,
      issueId,
      eventId: id,
      occurredAt: Number(id.slice(-1)),
      createdOn: Number(id.slice(-1)),
      modifiedOn: Number(id.slice(-1)),
      lane,
      visibility,
      schemaVersion
    })
    const visible = visibleConversationEntries([
      makeEntry('entry-4', 'agent', 'restricted'),
      makeEntry('entry-2', 'bot'),
      makeEntry('entry-1', 'customer'),
      makeEntry('entry-3', 'unknown')
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
