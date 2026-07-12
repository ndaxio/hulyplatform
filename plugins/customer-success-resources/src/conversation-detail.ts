//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import { SortingOrder, type Class, type Doc, type DocumentQuery, type Ref, type Timestamp } from '@hcengineering/core'
import type {
  ConversationEvent,
  ConversationEventLane,
  ConversationEventVisibility
} from '@hcengineering/customer-success'
import tracker, { type Issue, type Project } from '@hcengineering/tracker'

const ISSUE_QUERY_IDENTIFIER_RE = /^[A-Z][A-Z0-9]*-[0-9]+$/
export type ConversationEntryLane = 'customer' | 'bot' | 'system' | 'agent'
export type ConversationLocationQuery = Record<string, string | null> | undefined

export interface ConversationEntryDoc extends Doc {
  issueId?: Ref<Issue>
  lane?: ConversationEventLane | unknown
  visibility?: ConversationEventVisibility | unknown
  schemaVersion?: number | unknown
  attachedTo?: Ref<Issue>
  attachedToClass?: Ref<Class<Issue>>
  collection?: string
  space: Ref<Project>
  createdOn?: Timestamp
  modifiedOn?: Timestamp
}

export class LatestConversationRequest {
  private sequence = 0

  invalidate (): void {
    this.sequence += 1
  }

  async run<T>(operation: () => Promise<T>): Promise<T | undefined> {
    const sequence = ++this.sequence
    try {
      const result = await operation()
      return sequence === this.sequence ? result : undefined
    } catch (error) {
      if (sequence !== this.sequence) return undefined
      throw error
    }
  }
}

export function validateIssueQueryIdentifier (identifier: string): string | undefined {
  return ISSUE_QUERY_IDENTIFIER_RE.test(identifier) ? identifier : undefined
}

export function buildConversationIssueQuery (
  projectId: Ref<Project>,
  identifier: string
): DocumentQuery<Issue> | undefined {
  const validatedIdentifier = validateIssueQueryIdentifier(identifier)
  if (validatedIdentifier === undefined) return undefined

  return {
    identifier: validatedIdentifier,
    space: projectId,
    attachedTo: tracker.ids.NoParent
  }
}

export function openConversationQuery (
  current: ConversationLocationQuery,
  identifier: string
): ConversationLocationQuery {
  const validatedIdentifier = validateIssueQueryIdentifier(identifier)
  if (validatedIdentifier === undefined) return current
  return { ...current, issue: validatedIdentifier }
}

export function closeConversationQuery (current: ConversationLocationQuery): ConversationLocationQuery {
  if (current === undefined) return undefined
  const next = { ...current }
  delete next.issue
  return Object.keys(next).length > 0 ? next : undefined
}

export function buildConversationTranscriptQuery (
  projectId: Ref<Project>,
  issueId: Ref<Issue>
): DocumentQuery<ConversationEntryDoc> {
  return {
    space: projectId,
    issueId,
    visibility: 'public',
    schemaVersion: 1
  }
}

export function buildConversationEventFindOptions (): {
  limit: number
  sort: { occurredAt: SortingOrder, eventId: SortingOrder }
} {
  return {
    limit: 100,
    sort: {
      occurredAt: SortingOrder.Descending,
      eventId: SortingOrder.Descending
    }
  }
}

export function buildConversationHistoryQuery (
  projectId: Ref<Project>,
  issueId: Ref<Issue>
): DocumentQuery<ConversationEntryDoc> {
  return {
    space: projectId,
    attachedTo: issueId,
    attachedToClass: tracker.class.Issue,
    collection: { $ne: 'comments' },
    _class: {
      $ne: 'chunter:class:ChatMessage'
    }
  }
}

export function classifyConversationEntryLane (
  entry: Pick<ConversationEntryDoc, 'lane' | 'visibility' | 'schemaVersion'> | null | undefined
): ConversationEntryLane | undefined {
  if (entry?.visibility !== 'public' || entry.schemaVersion !== 1) return undefined

  switch (entry.lane) {
    case 'customer':
      return 'customer'
    case 'bot':
      return 'bot'
    case 'system':
      return 'system'
    case 'agent':
      return 'agent'
    default:
      return undefined
  }
}

export function visibleConversationEntries<
  T extends ConversationEntryDoc & Pick<ConversationEvent, 'eventId' | 'occurredAt'>
> (entries: T[]): Array<{ message: T, lane: ConversationEntryLane }> {
  return sortConversationEventsAscending(entries).flatMap((message) => {
    const lane = classifyConversationEntryLane(message)
    return lane === undefined ? [] : [{ message, lane }]
  })
}

export function compareConversationEventsAscending (
  left: Pick<ConversationEvent, 'eventId' | 'occurredAt'>,
  right: Pick<ConversationEvent, 'eventId' | 'occurredAt'>
): number {
  const occurredDiff = left.occurredAt - right.occurredAt
  if (occurredDiff !== 0) return occurredDiff
  return left.eventId.localeCompare(right.eventId)
}

export function sortConversationEventsAscending<T extends Pick<ConversationEvent, 'eventId' | 'occurredAt'>> (
  entries: T[]
): T[] {
  return [...entries].sort(compareConversationEventsAscending)
}

function getCreatedSortValue (entry: Pick<ConversationEntryDoc, 'createdOn' | 'modifiedOn'>): number {
  return entry.createdOn ?? entry.modifiedOn ?? 0
}

function getModifiedSortValue (entry: Pick<ConversationEntryDoc, 'createdOn' | 'modifiedOn'>): number {
  return entry.modifiedOn ?? entry.createdOn ?? 0
}

export function compareConversationEntriesAscending (
  left: Pick<ConversationEntryDoc, '_id' | 'createdOn' | 'modifiedOn'>,
  right: Pick<ConversationEntryDoc, '_id' | 'createdOn' | 'modifiedOn'>
): number {
  const createdDiff = getCreatedSortValue(left) - getCreatedSortValue(right)
  if (createdDiff !== 0) return createdDiff

  const modifiedDiff = getModifiedSortValue(left) - getModifiedSortValue(right)
  if (modifiedDiff !== 0) return modifiedDiff

  return String(left._id).localeCompare(String(right._id))
}

export function sortConversationEntriesAscending<
  T extends Pick<ConversationEntryDoc, '_id' | 'createdOn' | 'modifiedOn'>
> (entries: T[]): T[] {
  return [...entries].sort(compareConversationEntriesAscending)
}
