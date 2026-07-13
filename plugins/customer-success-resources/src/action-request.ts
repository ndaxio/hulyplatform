//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import customerSuccess, {
  type ConversationProjectionSpace,
  type LiveSessionState,
  type SupportActionRequest,
  type SupportActionRequestState
} from '@hcengineering/customer-success'
import type { Issue, IssueStatus } from '@hcengineering/tracker'
import type { Person } from '@hcengineering/contact'
import type {
  AccountUuid,
  CommitResult,
  DocumentQuery,
  Hierarchy,
  Ref,
  Role,
  RolesAssignment,
  SpaceType,
  Timestamp,
  TxOperations,
  WithLookup
} from '@hcengineering/core'

import type { TakeoverChromeState } from './takeover-state'

const claimSelfSourceStatuses = new Set<Ref<IssueStatus>>([
  'ndax:status:support:BotActive' as Ref<IssueStatus>,
  'ndax:status:support:NeedsHuman' as Ref<IssueStatus>,
  'ndax:status:support:Shadowing' as Ref<IssueStatus>,
  'ndax:status:support:Reopened' as Ref<IssueStatus>,
  'ndax:status:support:TakeoverRequested' as Ref<IssueStatus>
])

export interface ClaimSelfControlState {
  visible: boolean
  canSubmit: boolean
  busy: boolean
  awaitingReconciliation: boolean
  requestState?: SupportActionRequestState
}

export function claimSelfSupportActionRequestId (
  issueId: Ref<Issue>,
  currentAccountUuid: AccountUuid,
  expectedModifiedOn: Timestamp
): Ref<SupportActionRequest> {
  return `ndax:support:action-request:${issueId}:${currentAccountUuid}:claim_self:${expectedModifiedOn}` as Ref<SupportActionRequest>
}

export function buildSupportActionRequestQuery (
  internalSpaceId: Ref<ConversationProjectionSpace>,
  requestId: Ref<SupportActionRequest>,
  issueId: Ref<Issue>
): DocumentQuery<SupportActionRequest> {
  return {
    _id: requestId,
    space: internalSpaceId,
    issueId,
    schemaVersion: 1
  }
}

export async function submitClaimSelfSupportActionRequest (
  client: Pick<TxOperations, 'apply'>,
  internalSpaceId: Ref<ConversationProjectionSpace>,
  issue: Pick<Issue, '_id' | 'status' | 'assignee' | 'modifiedOn'>,
  currentAccountUuid: AccountUuid,
  requestedAssignee: Ref<Person>
): Promise<{ requestId: Ref<SupportActionRequest>, committed: CommitResult }> {
  const requestId = claimSelfSupportActionRequestId(issue._id, currentAccountUuid, issue.modifiedOn)
  const request = {
    issueId: issue._id,
    action: 'claim_self' as const,
    requestedAssignee,
    expectedStatus: issue.status,
    expectedAssignee: issue.assignee,
    expectedModifiedOn: issue.modifiedOn,
    state: 'pending' as const,
    idempotencyKey: requestId,
    schemaVersion: 1
  }

  const ops = client.apply(requestId, 'customer-success-claim-self')
  ops.notMatch(customerSuccess.class.SupportActionRequest, { _id: requestId })
  await ops.createDoc(customerSuccess.class.SupportActionRequest, internalSpaceId, request, requestId)
  const committed = await ops.commit()

  return { requestId, committed }
}

export function isSupportActionRoleMember (
  space: WithLookup<ConversationProjectionSpace> | undefined,
  hierarchy: Hierarchy,
  accountUuid: AccountUuid
): boolean {
  const spaceType = space?.$lookup?.type as WithLookup<SpaceType> | undefined
  const roles = spaceType?.$lookup?.roles as Role[] | undefined
  if (space === undefined || spaceType === undefined || roles === undefined) return false

  const assignments = hierarchy.as(space, spaceType.targetClass) as unknown as RolesAssignment

  for (const role of roles) {
    if (role._id !== customerSuccess.role.SupportAgent && role._id !== customerSuccess.role.SupportLead) continue
    if ((assignments[role._id] ?? []).includes(accountUuid)) return true
  }

  return false
}

export function resolveClaimSelfControlState (
  issue: Pick<Issue, 'status' | 'assignee'>,
  takeover: TakeoverChromeState,
  actionRequest: SupportActionRequest | undefined,
  currentEmployee: Ref<Person> | undefined,
  canManageSupportActions: boolean,
  submitting: boolean
): ClaimSelfControlState {
  const claimableStage = claimSelfSourceStatuses.has(issue.status)
  const assigneeEligible = issue.assignee === null || issue.assignee === currentEmployee
  const visible = canManageSupportActions && currentEmployee !== undefined && claimableStage && assigneeEligible
  const requestState = actionRequest?.state
  const awaitingReconciliation = requestState === 'succeeded' && !takeover.confirmed
  const busy = submitting || requestState === 'pending' || requestState === 'processing'

  return {
    visible,
    canSubmit:
      visible &&
      !busy &&
      !awaitingReconciliation &&
      requestState !== 'failed' &&
      requestState !== 'superseded' &&
      requestState !== 'succeeded',
    busy,
    awaitingReconciliation,
    requestState
  }
}

export function isLiveSessionConfirmed (
  takeover: TakeoverChromeState,
  projection: LiveSessionState | undefined
): boolean {
  return takeover.confirmed && projection?.acknowledged === true
}

export function shouldReleaseActiveSupportActionRequest (
  request: SupportActionRequest | undefined,
  currentIssueModifiedOn: Timestamp
): boolean {
  return (
    (request?.state === 'failed' || request?.state === 'superseded') &&
    request.expectedModifiedOn !== currentIssueModifiedOn
  )
}
