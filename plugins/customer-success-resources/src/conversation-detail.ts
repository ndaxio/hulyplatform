//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import core, { type Class, type Doc, type DocumentQuery, type Ref, type Timestamp } from '@hcengineering/core'
import tracker, { type Issue, type Project } from '@hcengineering/tracker'

const ISSUE_QUERY_IDENTIFIER_RE = /^[A-Z][A-Z0-9]*-[0-9]+$/
const ISSUE_COMMENT_CLASS = 'chunter:class:ChatMessage'
export const trustedConversationKinds = [
  'support_mirror_customer',
  'support_mirror_bot',
  'support_agent_joined'
] as const

export type ConversationEntryLane = 'customer' | 'bot' | 'system' | 'agent'
export type ConversationLocationQuery = Record<string, string | null> | undefined

export interface ConversationEntryDoc extends Doc {
  attachedTo: Ref<Issue>
  attachedToClass: Ref<Class<Issue>>
  collection: string
  space: Ref<Project>
  createdOn?: Timestamp
  modifiedOn?: Timestamp
  props?: {
    ndax_kind?: unknown
  } | null
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
    attachedTo: issueId,
    attachedToClass: tracker.class.Issue,
    collection: 'comments',
    _class: ISSUE_COMMENT_CLASS,
    createdBy: core.account.System,
    'props.ndax_kind': { $in: [...trustedConversationKinds] }
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
      $ne: ISSUE_COMMENT_CLASS
    }
  }
}

export function classifyConversationEntryLane (
  entry: Pick<ConversationEntryDoc, 'props'> | null | undefined,
  publicAuthorVerified = false
): ConversationEntryLane | undefined {
  const kind = typeof entry?.props?.ndax_kind === 'string' ? entry.props.ndax_kind : undefined

  switch (kind) {
    case 'support_mirror_customer':
      return 'customer'
    case 'support_mirror_bot':
      return 'bot'
    case 'support_agent_joined':
      return 'system'
    case 'support_public_reply':
      return publicAuthorVerified ? 'agent' : undefined
    default:
      return undefined
  }
}

export function visibleConversationEntries<T extends ConversationEntryDoc> (
  entries: T[],
  publicAuthorVerified = false
): Array<{ message: T, lane: ConversationEntryLane }> {
  return sortConversationEntriesAscending(entries).flatMap((message) => {
    const lane = classifyConversationEntryLane(message, publicAuthorVerified)
    return lane === undefined ? [] : [{ message, lane }]
  })
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
