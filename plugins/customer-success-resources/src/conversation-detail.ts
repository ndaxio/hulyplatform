//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import {
  SortingOrder,
  type Class,
  type Doc,
  type DocumentQuery,
  type Ref,
  type Space,
  type Timestamp
} from '@hcengineering/core'
import type {
  ConversationEvent,
  ConversationEventLane,
  ConversationEventVisibility
} from '@hcengineering/customer-success'
import tracker, { type Issue, type Project } from '@hcengineering/tracker'

const ISSUE_QUERY_IDENTIFIER_RE = /^[A-Z][A-Z0-9]*-[0-9]+$/
export type ConversationEntryLane = 'customer' | 'bot' | 'system' | 'agent'
export type ConversationVisibilityLane = 'public' | 'internal' | 'restricted'
export type ConversationLocationQuery = Record<string, string | null> | undefined
export const CONVERSATION_PAGE_SIZE = 100

export interface ConversationCursorV1 {
  v: 1
  issueId: string
  spaceId: string
  visibility: ConversationVisibilityLane
  occurredAt: number
  eventId: string
}

export interface ConversationCursorContext {
  issueId: Ref<Issue>
  spaceId: Ref<Space>
  visibility: ConversationVisibilityLane
}

export interface ConversationEntryDoc extends Doc {
  issueId?: Ref<Issue>
  lane?: ConversationEventLane | unknown
  visibility?: ConversationEventVisibility | unknown
  schemaVersion?: number | unknown
  attachedTo?: Ref<Issue>
  attachedToClass?: Ref<Class<Issue>>
  collection?: string
  space: Ref<Space>
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
  spaceId: Ref<Space>,
  issueId: Ref<Issue>,
  visibility: ConversationVisibilityLane = 'public'
): DocumentQuery<ConversationEntryDoc> {
  return {
    space: spaceId,
    issueId,
    visibility,
    schemaVersion: 1
  }
}

export function buildConversationEventFindOptions (): {
  limit: number
  sort: { occurredAt: SortingOrder, eventId: SortingOrder }
} {
  return {
    limit: CONVERSATION_PAGE_SIZE,
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
  if (!isConversationVisibility(entry?.visibility) || entry.schemaVersion !== 1) return undefined
  if (entry.visibility !== 'public' && entry.lane !== 'agent') return undefined

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
> (entries: T[]): Array<{ message: T, lane: ConversationEntryLane, visibility: ConversationVisibilityLane }> {
  return sortConversationEventsAscending(entries).flatMap((message) => {
    const lane = classifyConversationEntryLane(message)
    return lane === undefined ? [] : [{ message, lane, visibility: message.visibility as ConversationVisibilityLane }]
  })
}

export function encodeConversationCursor (cursor: ConversationCursorV1): string {
  if (!isConversationCursor(cursor)) throw new Error('invalid_conversation_cursor')
  return encodeBase64Url(JSON.stringify(cursor))
}

export function decodeConversationCursor (
  encoded: string,
  context: ConversationCursorContext
): ConversationCursorV1 | undefined {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return undefined
    const value = JSON.parse(decodeBase64Url(encoded)) as unknown
    if (!isConversationCursor(value)) return undefined
    if (
      value.issueId !== context.issueId ||
      value.spaceId !== context.spaceId ||
      value.visibility !== context.visibility
    ) {
      return undefined
    }
    return value
  } catch {
    return undefined
  }
}

export function buildConversationPageQuery (
  context: ConversationCursorContext,
  encodedCursor: string,
  direction: 'before' | 'after'
): DocumentQuery<ConversationEntryDoc> | undefined {
  const cursor = decodeConversationCursor(encodedCursor, context)
  if (cursor === undefined) return undefined
  const comparator = direction === 'before' ? '$lt' : '$gt'
  return {
    ...buildConversationTranscriptQuery(context.spaceId, context.issueId, context.visibility),
    $or: [
      { occurredAt: { [comparator]: cursor.occurredAt } },
      { occurredAt: cursor.occurredAt, eventId: { [comparator]: cursor.eventId } }
    ]
  }
}

export function cursorForConversationEvent (
  context: ConversationCursorContext,
  event: Pick<ConversationEvent, 'occurredAt' | 'eventId'>
): string {
  return encodeConversationCursor({
    v: 1,
    issueId: String(context.issueId),
    spaceId: String(context.spaceId),
    visibility: context.visibility,
    occurredAt: event.occurredAt,
    eventId: event.eventId
  })
}

export function mergeConversationEventPages<
  T extends ConversationEntryDoc & Pick<ConversationEvent, 'eventId' | 'occurredAt'>
> (...pages: T[][]): T[] {
  const byIdentity = new Map<string, T>()
  for (const event of pages.flat()) {
    byIdentity.set(`${String(event.space)}\u0000${event.eventId}`, event)
  }
  return sortConversationEventsAscending([...byIdentity.values()])
}

export function carryForwardOverlappingConversationHead<
  T extends ConversationEntryDoc & Pick<ConversationEvent, 'eventId' | 'occurredAt'>
> (historical: T[], previousHead: T[], nextHead: T[]): T[] {
  if (previousHead.length === 0) return historical
  const nextIdentities = new Set(nextHead.map(conversationEventIdentity))
  if (!previousHead.some((event) => nextIdentities.has(conversationEventIdentity(event)))) return []
  return mergeConversationEventPages(historical, previousHead)
}

function conversationEventIdentity (
  event: Pick<ConversationEntryDoc, 'space'> & Pick<ConversationEvent, 'eventId'>
): string {
  return `${String(event.space)}\u0000${event.eventId}`
}

function isConversationVisibility (value: unknown): value is ConversationVisibilityLane {
  return value === 'public' || value === 'internal' || value === 'restricted'
}

function isConversationCursor (value: unknown): value is ConversationCursorV1 {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false
  const cursor = value as Record<string, unknown>
  if (Object.keys(cursor).sort().join(',') !== 'eventId,issueId,occurredAt,spaceId,v,visibility') return false
  return (
    cursor.v === 1 &&
    typeof cursor.issueId === 'string' &&
    cursor.issueId.length > 0 &&
    cursor.issueId.length <= 300 &&
    typeof cursor.spaceId === 'string' &&
    cursor.spaceId.length > 0 &&
    cursor.spaceId.length <= 300 &&
    isConversationVisibility(cursor.visibility) &&
    typeof cursor.occurredAt === 'number' &&
    Number.isSafeInteger(cursor.occurredAt) &&
    cursor.occurredAt >= 0 &&
    typeof cursor.eventId === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,199}$/.test(cursor.eventId)
  )
}

function encodeBase64Url (value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url (value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
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
