//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import {
  defaultInternalProjectionSpaceId,
  defaultPublicProjectionSpaceId,
  defaultRestrictedProjectionSpaceId,
  defaultSupportProjectId,
  type ConversationProjectionSpace
} from '@hcengineering/customer-success'
import type { DocumentQuery, Ref } from '@hcengineering/core'
import type { Person } from '@hcengineering/contact'
import tracker, { type Issue, type IssueStatus, type Project } from '@hcengineering/tracker'

export type LiveInboxContentState = 'loading' | 'empty' | 'ready'
export type LiveInboxQueueView =
  | 'all'
  | 'bot-active'
  | 'takeover-requested'
  | 'unassigned'
  | 'mine'
  | 'customer-waiting'
  | 'sla-risk'
  | 'human-active'
  | 'escalated'
  | 'resolved'

export type LiveInboxLocationQuery = Record<string, string | null> | undefined

export interface LiveInboxQueryContext {
  currentEmployee?: Ref<Person>
  now?: number
  search?: string
}

export type LiveInboxQueueNavigationKey = 'ArrowLeft' | 'ArrowRight'

export const liveInboxQueueViews: LiveInboxQueueView[] = [
  'all',
  'bot-active',
  'takeover-requested',
  'unassigned',
  'mine',
  'customer-waiting',
  'sla-risk',
  'human-active',
  'escalated',
  'resolved'
]

const supportStatus = {
  botActive: 'ndax:status:support:BotActive' as Ref<IssueStatus>,
  takeoverRequested: 'ndax:status:support:TakeoverRequested' as Ref<IssueStatus>,
  humanActive: 'ndax:status:support:HumanActive' as Ref<IssueStatus>,
  waitingOnCustomer: 'ndax:status:support:WaitingOnCustomer' as Ref<IssueStatus>,
  escalated: 'ndax:status:support:Escalated' as Ref<IssueStatus>,
  resolved: 'ndax:status:support:Resolved' as Ref<IssueStatus>,
  closed: 'ndax:status:support:Closed' as Ref<IssueStatus>
} as const

export interface ProjectionSpaceIds {
  public: Ref<ConversationProjectionSpace>
  internal: Ref<ConversationProjectionSpace>
  restricted: Ref<ConversationProjectionSpace>
}

export function resolveSupportProjectId (configured: Ref<Project> | undefined): Ref<Project> {
  return configured ?? defaultSupportProjectId
}

export function resolveProjectionSpaceIds (configured: Partial<ProjectionSpaceIds>): ProjectionSpaceIds {
  return {
    public: configured.public ?? defaultPublicProjectionSpaceId,
    internal: configured.internal ?? defaultInternalProjectionSpaceId,
    restricted: configured.restricted ?? defaultRestrictedProjectionSpaceId
  }
}

export function buildLiveInboxQuery (
  projectId: Ref<Project>,
  view: LiveInboxQueueView = 'all',
  context: LiveInboxQueryContext = {}
): DocumentQuery<Issue> {
  const query: DocumentQuery<Issue> = {
    space: projectId,
    attachedTo: tracker.ids.NoParent
  }
  switch (view) {
    case 'bot-active':
      query.status = { $in: [supportStatus.botActive] }
      break
    case 'takeover-requested':
      query.status = { $in: [supportStatus.takeoverRequested] }
      break
    case 'unassigned':
      query.assignee = { $in: [null] }
      query.status = { $nin: [supportStatus.resolved, supportStatus.closed] }
      break
    case 'mine':
      if (context.currentEmployee === undefined) return { ...query, _id: { $in: [] } }
      query.assignee = { $in: [context.currentEmployee] }
      query.status = { $nin: [supportStatus.resolved, supportStatus.closed] }
      break
    case 'customer-waiting':
      query.status = { $in: [supportStatus.waitingOnCustomer] }
      break
    case 'sla-risk':
      query.dueDate = { $gt: 0, $lte: context.now ?? Date.now() }
      query.status = { $nin: [supportStatus.resolved, supportStatus.closed] }
      break
    case 'human-active':
      query.status = { $in: [supportStatus.humanActive] }
      break
    case 'escalated':
      query.status = { $in: [supportStatus.escalated] }
      break
    case 'resolved':
      query.status = { $in: [supportStatus.resolved, supportStatus.closed] }
      break
    case 'all':
      break
  }
  const search = normalizeLiveInboxSearch(context.search)
  if (search !== undefined) query.$search = search
  return query
}

export function nextLiveInboxQueueView (current: LiveInboxQueueView, key: string): LiveInboxQueueView | undefined {
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return undefined
  const index = liveInboxQueueViews.indexOf(current)
  const offset = key === 'ArrowRight' ? 1 : -1
  return liveInboxQueueViews[(index + offset + liveInboxQueueViews.length) % liveInboxQueueViews.length]
}

export function resolveLiveInboxQueueView (value: unknown): LiveInboxQueueView {
  return typeof value === 'string' && liveInboxQueueViews.includes(value as LiveInboxQueueView)
    ? (value as LiveInboxQueueView)
    : 'all'
}

export function normalizeLiveInboxSearch (value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().replace(/\s+/g, ' ').slice(0, 200)
  return normalized.length > 0 ? normalized : undefined
}

export function resolveLiveInboxLocationState (query: LiveInboxLocationQuery): {
  view: LiveInboxQueueView
  search: string
} {
  return {
    view: resolveLiveInboxQueueView(query?.view),
    search: normalizeLiveInboxSearch(query?.search) ?? ''
  }
}

export function buildLiveInboxNavigationQuery (
  current: LiveInboxLocationQuery,
  view: LiveInboxQueueView,
  search: string
): LiveInboxLocationQuery {
  const next: Record<string, string | null> = { ...(current ?? {}), view }
  const normalizedSearch = normalizeLiveInboxSearch(search)
  if (normalizedSearch === undefined) delete next.search
  else next.search = normalizedSearch
  return next
}

export function resolveProjectLoadState (projectFound: boolean): 'ready' | 'denied' {
  return projectFound ? 'ready' : 'denied'
}

export function resolveContentState (
  loading: boolean,
  count: number,
  filterQueryReady: boolean = true
): LiveInboxContentState {
  if (loading || !filterQueryReady) return 'loading'
  return count === 0 ? 'empty' : 'ready'
}
