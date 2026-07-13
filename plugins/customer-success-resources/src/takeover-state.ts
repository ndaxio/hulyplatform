//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import type { ConversationProjectionSpace, LiveSessionState, LiveSessionStage } from '@hcengineering/customer-success'
import type { DocumentQuery, Ref } from '@hcengineering/core'
import type { Person } from '@hcengineering/contact'
import type { Issue, IssueStatus } from '@hcengineering/tracker'

const supportStatus = {
  botActive: 'ndax:status:support:BotActive' as Ref<IssueStatus>,
  shadowing: 'ndax:status:support:Shadowing' as Ref<IssueStatus>,
  takeoverRequested: 'ndax:status:support:TakeoverRequested' as Ref<IssueStatus>,
  humanActive: 'ndax:status:support:HumanActive' as Ref<IssueStatus>
} as const

export interface TakeoverChromeState {
  stage: LiveSessionStage
  claimOwner: Ref<Person> | null
  pendingAcknowledgement: boolean
  confirmed: boolean
  reconciliationPending: boolean
  expiresAt?: number
  expired: boolean
  recoveryState: LiveSessionState['recoveryState']
  projectionCurrent: boolean
}

export function liveSessionStateId (issueId: Ref<Issue>): Ref<LiveSessionState> {
  return `ndax:support:live-session-state:${issueId}` as Ref<LiveSessionState>
}

export function buildLiveSessionStateQuery (
  internalSpaceId: Ref<ConversationProjectionSpace>,
  issueId: Ref<Issue>
): DocumentQuery<LiveSessionState> {
  return {
    _id: liveSessionStateId(issueId),
    space: internalSpaceId,
    issueId,
    schemaVersion: 1
  }
}

export function resolveLiveSessionStage (status: Ref<IssueStatus>): LiveSessionStage {
  switch (status) {
    case supportStatus.botActive:
      return 'bot_active'
    case supportStatus.shadowing:
      return 'shadowing'
    case supportStatus.takeoverRequested:
      return 'takeover_requested'
    case supportStatus.humanActive:
      return 'human_active'
    default:
      return 'other'
  }
}

export function resolveTakeoverChromeState (
  issue: Pick<Issue, '_id' | 'status' | 'assignee' | 'modifiedOn'>,
  projection?: LiveSessionState
): TakeoverChromeState {
  const stage = resolveLiveSessionStage(issue.status)
  const projectionCurrent =
    projection !== undefined &&
    projection.issueId === issue._id &&
    projection.sourceStatus === issue.status &&
    projection.stage === stage &&
    projection.observedAt >= issue.modifiedOn
  const claimOwner = projectionCurrent ? projection.claimOwner : issue.assignee

  const recoveryState =
    stage === 'takeover_requested' && claimOwner === null
      ? 'unassigned'
      : projectionCurrent && stage === 'takeover_requested'
        ? projection.recoveryState
        : 'none'

  const confirmed = stage === 'human_active' && projectionCurrent && projection.acknowledged

  return {
    stage,
    claimOwner,
    pendingAcknowledgement: stage === 'takeover_requested',
    confirmed,
    reconciliationPending: stage === 'human_active' && !confirmed,
    expiresAt: projectionCurrent && stage === 'takeover_requested' ? projection.expiresAt : undefined,
    expired: projectionCurrent && stage === 'takeover_requested' ? projection.expired : false,
    recoveryState,
    projectionCurrent
  }
}
