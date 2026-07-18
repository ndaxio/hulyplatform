//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import type { Ref, Space } from '@hcengineering/core'
import type { Issue, Project } from '@hcengineering/tracker'

import {
  buildConversationHistoryQuery,
  buildConversationHistoryFindOptions,
  buildConversationHistoryPageQuery,
  buildConversationEventFindOptions,
  buildConversationPageQuery,
  buildConversationIssueQuery,
  buildConversationTranscriptQuery,
  captureConversationScrollAnchor,
  carryForwardOverlappingConversationHead,
  classifyConversationEntryLane,
  closeConversationQuery,
  compareConversationEntriesAscending,
  compareConversationEventsAscending,
  cursorForConversationEvent,
  decodeConversationCursor,
  emptyConversationComposerDrafts,
  encodeConversationCursor,
  mergeConversationEventPages,
  mergeConversationHistoryPages,
  nextConversationDetailLane,
  conversationComposerDraftsForIssue,
  resolveConversationScrollTop,
  sortConversationEntriesAscending,
  sortConversationEventsAscending,
  openConversationQuery,
  LatestConversationRequest,
  validateIssueQueryIdentifier,
  updateConversationComposerDraftCache,
  visibleConversationEntries,
  type ConversationEntryDoc
} from '../conversation-detail'

describe('conversation detail helpers', () => {
  const projectId = 'project:support' as Ref<Project>
  const otherProjectId = 'project:other' as Ref<Project>
  const issueId = 'issue:support:42' as Ref<Issue>
  const otherIssueId = 'issue:other:7' as Ref<Issue>
  const publicSpaceId = 'projection:public' as Ref<Space>
  const internalSpaceId = 'projection:internal' as Ref<Space>

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

  it('moves mobile detail focus with arrow and boundary keys', () => {
    expect(nextConversationDetailLane('conversation', 'ArrowRight')).toBe('activity')
    expect(nextConversationDetailLane('activity', 'ArrowLeft')).toBe('conversation')
    expect(nextConversationDetailLane('activity', 'Home')).toBe('conversation')
    expect(nextConversationDetailLane('conversation', 'End')).toBe('activity')
    expect(nextConversationDetailLane('conversation', 'Enter')).toBeUndefined()
  })

  it('refuses to place malformed identifiers into navigation state', () => {
    const current = { filter: 'urgent' }
    expect(openConversationQuery(current, 'SUP-42<script>')).toBe(current)
  })

  it('queries each materialized projection lane by its exact authorized space', () => {
    expect(buildConversationTranscriptQuery(publicSpaceId, issueId)).toEqual({
      space: publicSpaceId,
      issueId,
      visibility: 'public',
      schemaVersion: 1
    })
    expect(buildConversationTranscriptQuery(internalSpaceId, issueId, 'internal')).toEqual({
      space: internalSpaceId,
      issueId,
      visibility: 'internal',
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

    expect(buildConversationTranscriptQuery(publicSpaceId, otherIssueId)).toEqual({
      space: publicSpaceId,
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

  it('bounds activity history and pages with a stable createdOn and id tuple', () => {
    expect(buildConversationHistoryFindOptions()).toEqual({
      limit: 100,
      sort: { createdOn: -1, _id: -1 }
    })
    expect(
      buildConversationHistoryPageQuery(projectId, issueId, {
        _id: 'activity:42',
        createdOn: 200
      })
    ).toEqual({
      ...buildConversationHistoryQuery(projectId, issueId),
      $or: [{ createdOn: { $lt: 200 } }, { createdOn: 200, _id: { $lt: 'activity:42' } }]
    })
  })

  it('merges overlapping activity pages by immutable document identity', () => {
    const first = {
      _id: 'activity:1',
      _class: 'activity:class:DocUpdateMessage',
      space: projectId,
      createdOn: 1
    }
    const second = { ...first, _id: 'activity:2', createdOn: 2 }

    expect(mergeConversationHistoryPages([second], [first, second])).toEqual([first, second])
  })

  it.each([
    [{ lane: 'customer', visibility: 'public', schemaVersion: 1 }, 'customer'],
    [{ lane: 'bot', visibility: 'public', schemaVersion: 1 }, 'bot'],
    [{ lane: 'system', visibility: 'public', schemaVersion: 1 }, 'system'],
    [{ lane: 'agent', visibility: 'public', schemaVersion: 1 }, 'agent'],
    [{ lane: 'agent', visibility: 'internal', schemaVersion: 1 }, 'agent'],
    [{ lane: 'agent', visibility: 'restricted', schemaVersion: 1 }, 'agent']
  ] as const)('classifies exact schema-v1 authorized projection lanes (%j)', (entry, expected) => {
    expect(classifyConversationEntryLane(entry)).toBe(expected)
  })

  it.each([
    undefined,
    null,
    {},
    { lane: 'customer', visibility: 'private', schemaVersion: 1 },
    { lane: 'customer', visibility: 'public', schemaVersion: 0 },
    { lane: 'customer', visibility: 'public', schemaVersion: 2 },
    { lane: 'unknown', visibility: 'public', schemaVersion: 1 },
    { lane: ['agent'], visibility: 'public', schemaVersion: 1 },
    { lane: 'agent', visibility: 'PUBLIC', schemaVersion: 1 },
    { lane: 'customer', visibility: 'internal', schemaVersion: 1 },
    { lane: 'bot', visibility: 'restricted', schemaVersion: 1 },
    { lane: 'system', visibility: 'internal', schemaVersion: 1 }
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
    ] as unknown as ConversationEntryDoc[]

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

  it('returns all exact schema-v1 authorized lanes from mixed projection results', () => {
    const makeEntry = (
      id: string,
      lane: string,
      visibility: string = 'public',
      schemaVersion: number = 1
    ): any => ({
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

    expect(visible.map(({ message, lane, visibility }) => [message._id, lane, visibility])).toEqual([
      ['entry-1', 'customer', 'public'],
      ['entry-2', 'bot', 'public'],
      ['entry-4', 'agent', 'restricted']
    ])
  })

  it('round-trips an opaque cursor only in the exact issue, space, and visibility context', () => {
    const context = { issueId, spaceId: publicSpaceId, visibility: 'public' as const }
    const cursor = cursorForConversationEvent(context, { occurredAt: 100, eventId: 'evt-100' })

    expect(cursor).not.toContain('issue:support:42')
    expect(decodeConversationCursor(cursor, context)).toEqual({
      v: 1,
      issueId,
      spaceId: publicSpaceId,
      visibility: 'public',
      occurredAt: 100,
      eventId: 'evt-100'
    })
    expect(decodeConversationCursor(cursor, { ...context, issueId: otherIssueId })).toBeUndefined()
    expect(decodeConversationCursor(cursor, { ...context, spaceId: internalSpaceId })).toBeUndefined()
    expect(decodeConversationCursor(cursor, { ...context, visibility: 'internal' })).toBeUndefined()
  })

  it.each(['', 'not base64!', 'e30', 'eyJ2IjoyfQ'])(
    'fails closed for malformed or unsupported cursors (%s)',
    (cursor) => {
      expect(
        decodeConversationCursor(cursor, { issueId, spaceId: publicSpaceId, visibility: 'public' })
      ).toBeUndefined()
    }
  )

  it('rejects unknown cursor fields and unsafe tuple values', () => {
    expect(() =>
      encodeConversationCursor({
        v: 1,
        issueId,
        spaceId: publicSpaceId,
        visibility: 'public',
        occurredAt: -1,
        eventId: 'evt-1'
      })
    ).toThrow('invalid_conversation_cursor')
  })

  it('builds exclusive before and after page predicates without replaying page one', () => {
    const context = { issueId, spaceId: publicSpaceId, visibility: 'public' as const }
    const cursor = cursorForConversationEvent(context, { occurredAt: 100, eventId: 'evt-100' })

    expect(buildConversationPageQuery(context, cursor, 'before')).toEqual({
      space: publicSpaceId,
      issueId,
      visibility: 'public',
      schemaVersion: 1,
      $or: [{ occurredAt: { $lt: 100 } }, { occurredAt: 100, eventId: { $lt: 'evt-100' } }]
    })
    expect(buildConversationPageQuery(context, cursor, 'after')).toEqual({
      space: publicSpaceId,
      issueId,
      visibility: 'public',
      schemaVersion: 1,
      $or: [{ occurredAt: { $gt: 100 } }, { occurredAt: 100, eventId: { $gt: 'evt-100' } }]
    })
    expect(buildConversationPageQuery(context, 'invalid', 'before')).toBeUndefined()
  })

  it('merges overlapping pages by space and event id in canonical order', () => {
    const makeEvent = (space: Ref<Space>, eventId: string, occurredAt: number): any => ({
      _id: `${space}:${eventId}`,
      _class: 'customer-success:class:ConversationEvent',
      space,
      issueId,
      eventId,
      occurredAt,
      lane: 'agent',
      visibility: space === publicSpaceId ? 'public' : 'internal',
      schemaVersion: 1
    })
    const shared = makeEvent(publicSpaceId, 'evt-2', 20)
    const merged = mergeConversationEventPages(
      [shared, makeEvent(publicSpaceId, 'evt-3', 30)],
      [makeEvent(publicSpaceId, 'evt-1', 10), { ...shared }],
      [makeEvent(internalSpaceId, 'evt-2', 15)]
    )

    expect(merged.map((event) => `${event.space}:${event.eventId}`)).toEqual([
      'projection:public:evt-1',
      'projection:internal:evt-2',
      'projection:public:evt-2',
      'projection:public:evt-3'
    ])
  })

  it('carries an overlapping live head forward without dropping the middle page', () => {
    const makeEvent = (eventId: string, occurredAt: number): any => ({
      _id: `${publicSpaceId}:${eventId}`,
      _class: 'customer-success:class:ConversationEvent',
      space: publicSpaceId,
      issueId,
      eventId,
      occurredAt,
      lane: 'agent',
      visibility: 'public',
      schemaVersion: 1
    })
    const historical = Array.from({ length: 100 }, (_, index) => makeEvent(`evt-${index + 1}`, index + 1))
    const previousHead = Array.from({ length: 100 }, (_, index) => makeEvent(`evt-${index + 101}`, index + 101))
    const nextHead = Array.from({ length: 100 }, (_, index) => makeEvent(`evt-${index + 121}`, index + 121))

    const carried = carryForwardOverlappingConversationHead(historical, previousHead, nextHead)
    const visible = mergeConversationEventPages(carried, nextHead)

    expect(visible).toHaveLength(220)
    expect(visible.map((event) => event.occurredAt)).toEqual(Array.from({ length: 220 }, (_, index) => index + 1))
  })

  it('clears cached history when a replacement head no longer overlaps', () => {
    const makeEvent = (eventId: string, occurredAt: number): any => ({
      _id: `${publicSpaceId}:${eventId}`,
      _class: 'customer-success:class:ConversationEvent',
      space: publicSpaceId,
      issueId,
      eventId,
      occurredAt,
      lane: 'agent',
      visibility: 'public',
      schemaVersion: 1
    })

    expect(carryForwardOverlappingConversationHead([makeEvent('evt-1', 1)], [makeEvent('evt-2', 2)], [])).toEqual([])
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

  it('drops stale asynchronous pagination requests after invalidation', async () => {
    const gate = new LatestConversationRequest()
    let resolvePage!: (value: string[]) => void
    const stalePage = gate.run(async () => await new Promise<string[]>((resolve) => (resolvePage = resolve)))

    gate.invalidate()
    resolvePage(['SUP-1 older event'])

    await expect(stalePage).resolves.toBeUndefined()
  })

  it('keeps an operator at the live edge when realtime messages append', () => {
    const anchor = captureConversationScrollAnchor({
      scrollTop: 780,
      scrollHeight: 1000,
      clientHeight: 200
    })

    expect(resolveConversationScrollTop(anchor, 1120, 'live')).toBe(920)
  })

  it('does not move an operator reading older messages when realtime messages append', () => {
    const anchor = captureConversationScrollAnchor({
      scrollTop: 300,
      scrollHeight: 1000,
      clientHeight: 200
    })

    expect(resolveConversationScrollTop(anchor, 1120, 'live')).toBe(300)
  })

  it('preserves the visible message anchor when earlier history is prepended', () => {
    const anchor = captureConversationScrollAnchor({
      scrollTop: 120,
      scrollHeight: 1000,
      clientHeight: 200
    })

    expect(resolveConversationScrollTop(anchor, 1450, 'prepend')).toBe(570)
  })

  it('keeps memory-only composer drafts isolated by ticket and visibility action', () => {
    let cache = new Map()
    cache = updateConversationComposerDraftCache(cache, 'account:one', 'CSI-17', 'post_public_reply', 'Public reply')
    cache = updateConversationComposerDraftCache(cache, 'account:one', 'CSI-17', 'post_internal_note', 'Internal note')
    cache = updateConversationComposerDraftCache(
      cache,
      'account:one',
      'CSI-18',
      'post_restricted_note',
      'Restricted note'
    )

    expect(conversationComposerDraftsForIssue(cache, 'account:one', 'CSI-17')).toEqual({
      post_public_reply: 'Public reply',
      post_internal_note: 'Internal note',
      post_restricted_note: ''
    })
    expect(conversationComposerDraftsForIssue(cache, 'account:one', 'CSI-18')).toEqual({
      post_public_reply: '',
      post_internal_note: '',
      post_restricted_note: 'Restricted note'
    })
  })

  it('bounds the in-memory draft cache and evicts the least recently touched ticket', () => {
    let cache = new Map()
    cache = updateConversationComposerDraftCache(cache, 'account:one', 'CSI-1', 'post_public_reply', 'one', 2)
    cache = updateConversationComposerDraftCache(cache, 'account:one', 'CSI-2', 'post_public_reply', 'two', 2)
    cache = updateConversationComposerDraftCache(cache, 'account:one', 'CSI-1', 'post_public_reply', 'one updated', 2)
    cache = updateConversationComposerDraftCache(cache, 'account:one', 'CSI-3', 'post_public_reply', 'three', 2)

    expect(conversationComposerDraftsForIssue(cache, 'account:one', 'CSI-1').post_public_reply).toBe('one updated')
    expect(conversationComposerDraftsForIssue(cache, 'account:one', 'CSI-2')).toEqual(emptyConversationComposerDrafts())
    expect(conversationComposerDraftsForIssue(cache, 'account:one', 'CSI-3').post_public_reply).toBe('three')
    expect(conversationComposerDraftsForIssue(new Map(), 'account:one', 'CSI-404')).toEqual(
      emptyConversationComposerDrafts()
    )
  })

  it('never hydrates sensitive drafts across account contexts in one runtime', () => {
    const cache = updateConversationComposerDraftCache(
      new Map(),
      'account:one',
      'CSI-17',
      'post_restricted_note',
      'Restricted evidence'
    )

    expect(conversationComposerDraftsForIssue(cache, 'account:one', 'CSI-17').post_restricted_note).toBe(
      'Restricted evidence'
    )
    expect(conversationComposerDraftsForIssue(cache, 'account:two', 'CSI-17')).toEqual(
      emptyConversationComposerDrafts()
    )
  })

  it('uses modifiedOn and then _id as stable tie-breakers for ascending comparisons', () => {
    const earlierModified: Pick<ConversationEntryDoc, '_id' | 'createdOn' | 'modifiedOn'> = {
      _id: 'entry-b' as any,
      createdOn: 100,
      modifiedOn: 110
    }

    const laterModified: Pick<ConversationEntryDoc, '_id' | 'createdOn' | 'modifiedOn'> = {
      _id: 'entry-a' as any,
      createdOn: 100,
      modifiedOn: 120
    }

    const sameTimestampHigherId: Pick<ConversationEntryDoc, '_id' | 'createdOn' | 'modifiedOn'> = {
      _id: 'entry-z' as any,
      createdOn: 200,
      modifiedOn: 200
    }

    const sameTimestampLowerId: Pick<ConversationEntryDoc, '_id' | 'createdOn' | 'modifiedOn'> = {
      _id: 'entry-a' as any,
      createdOn: 200,
      modifiedOn: 200
    }

    expect(compareConversationEntriesAscending(earlierModified, laterModified)).toBeLessThan(0)
    expect(compareConversationEntriesAscending(sameTimestampLowerId, sameTimestampHigherId)).toBeLessThan(0)
  })
})
