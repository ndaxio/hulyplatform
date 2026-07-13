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
import type { Employee, Person } from '@hcengineering/contact'
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
import tracker from '@hcengineering/tracker'

import type { TakeoverChromeState } from './takeover-state'

const claimSelfSourceStatuses = new Set<Ref<IssueStatus>>([
  'ndax:status:support:BotActive' as Ref<IssueStatus>,
  'ndax:status:support:NeedsHuman' as Ref<IssueStatus>,
  'ndax:status:support:Shadowing' as Ref<IssueStatus>,
  'ndax:status:support:Reopened' as Ref<IssueStatus>,
  'ndax:status:support:TakeoverRequested' as Ref<IssueStatus>
])

const assignLeadSourceStatuses = new Set<Ref<IssueStatus>>([
  'ndax:status:support:BotActive' as Ref<IssueStatus>,
  'ndax:status:support:NeedsHuman' as Ref<IssueStatus>,
  'ndax:status:support:Shadowing' as Ref<IssueStatus>,
  'ndax:status:support:Reopened' as Ref<IssueStatus>,
  tracker.status.Backlog as Ref<IssueStatus>
])

export interface ClaimSelfControlState {
  visible: boolean
  canSubmit: boolean
  busy: boolean
  awaitingReconciliation: boolean
  requestState?: SupportActionRequestState
}

export interface AssignLeadControlState {
  visible: boolean
  canSelect: boolean
  canSubmit: boolean
  busy: boolean
  awaitingReconciliation: boolean
  reconciled: boolean
  requestState?: SupportActionRequestState
}

export type SupportStatusTarget = 'ndax:status:support:WaitingOnCustomer' | 'ndax:status:support:WaitingOnInternal'

export interface StatusTransitionControlState {
  visible: boolean
  canSubmit: boolean
  busy: boolean
  awaitingReconciliation: boolean
  reconciled: boolean
  requestState?: SupportActionRequestState
}

export const supportStatusTargets: SupportStatusTarget[] = [
  'ndax:status:support:WaitingOnCustomer',
  'ndax:status:support:WaitingOnInternal'
]

export interface SupportActionRoleAssignments {
  supportAgent: AccountUuid[]
  supportLead: AccountUuid[]
}

export function buildAssignLeadCandidateQuery (candidates: Array<Ref<Person>>): DocumentQuery<Employee> {
  if (candidates.length === 0) return { _id: 'none' as Ref<Employee>, active: true }
  return { _id: { $in: candidates as unknown as Array<Ref<Employee>> }, active: true }
}

export function canonicalSupportAssignee (
  assignee: Ref<Person> | AccountUuid | null,
  employeeRefs: ReadonlyMap<AccountUuid, Ref<Employee>>
): Ref<Person> | null {
  if (assignee === null) return null
  return (employeeRefs.get(assignee as AccountUuid) as Ref<Person> | undefined) ?? (assignee as Ref<Person>)
}

export function claimSelfSupportActionRequestId (
  issueId: Ref<Issue>,
  currentAccountUuid: AccountUuid,
  expectedModifiedOn: Timestamp
): Ref<SupportActionRequest> {
  return `ndax:support:action-request:${issueId}:${currentAccountUuid}:claim_self:${expectedModifiedOn}` as Ref<SupportActionRequest>
}

export function assignAssigneeSupportActionRequestId (
  issueId: Ref<Issue>,
  currentAccountUuid: AccountUuid,
  requestedAssignee: Ref<Person>,
  expectedModifiedOn: Timestamp
): Ref<SupportActionRequest> {
  return `ndax:support:action-request:${issueId}:${currentAccountUuid}:assign_assignee:${requestedAssignee}:${expectedModifiedOn}` as Ref<SupportActionRequest>
}

export function reassignAssigneeSupportActionRequestId (
  issueId: Ref<Issue>,
  currentAccountUuid: AccountUuid,
  requestedAssignee: Ref<Person>,
  expectedModifiedOn: Timestamp
): Ref<SupportActionRequest> {
  return `ndax:support:action-request:${issueId}:${currentAccountUuid}:reassign_assignee:${requestedAssignee}:${expectedModifiedOn}` as Ref<SupportActionRequest>
}

export function transitionStatusSupportActionRequestId (
  issueId: Ref<Issue>,
  currentAccountUuid: AccountUuid,
  requestedStatus: Ref<IssueStatus>,
  expectedModifiedOn: Timestamp
): Ref<SupportActionRequest> {
  return `ndax:support:action-request:${issueId}:${currentAccountUuid}:transition_status:${requestedStatus}:${expectedModifiedOn}` as Ref<SupportActionRequest>
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

export function buildSupportActionRequestHydrationQuery (
  internalSpaceId: Ref<ConversationProjectionSpace>,
  issueId: Ref<Issue>,
  currentAccountUuid: AccountUuid
): DocumentQuery<SupportActionRequest> {
  return {
    _id: {
      $like: `ndax:support:action-request:${issueId}:${currentAccountUuid}:%`
    },
    space: internalSpaceId,
    issueId,
    schemaVersion: 1
  }
}

export function selectHydratedSupportActionRequestId (
  requests: SupportActionRequest[],
  issue: Pick<Issue, 'status' | 'assignee' | 'modifiedOn'>
): Ref<SupportActionRequest> | undefined {
  return [...requests]
    .filter((request) => {
      if (request.schemaVersion !== 1) return false
      if (request.state !== 'succeeded') return true
      if (request.action === 'assign_assignee' || request.action === 'reassign_assignee') {
        return request.requestedAssignee === issue.assignee && issue.modifiedOn >= request.expectedModifiedOn
      }
      if (request.action === 'transition_status') {
        return (
          request.requestedStatus === issue.status &&
          request.requestedAssignee === issue.assignee &&
          issue.modifiedOn >= request.expectedModifiedOn
        )
      }
      return (
        request.requestedAssignee === issue.assignee &&
        (issue.status === 'ndax:status:support:TakeoverRequested' || issue.status === 'ndax:status:support:HumanActive')
      )
    })
    .sort((left, right) => {
      if (right.modifiedOn !== left.modifiedOn) return right.modifiedOn - left.modifiedOn
      return left._id.localeCompare(right._id)
    })[0]?._id
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

export async function submitAssignAssigneeSupportActionRequest (
  client: Pick<TxOperations, 'apply'>,
  internalSpaceId: Ref<ConversationProjectionSpace>,
  issue: Pick<Issue, '_id' | 'status' | 'assignee' | 'modifiedOn'>,
  currentAccountUuid: AccountUuid,
  requestedAssignee: Ref<Person>
): Promise<{ requestId: Ref<SupportActionRequest>, committed: CommitResult }> {
  const requestId = assignAssigneeSupportActionRequestId(
    issue._id,
    currentAccountUuid,
    requestedAssignee,
    issue.modifiedOn
  )
  const request = {
    issueId: issue._id,
    action: 'assign_assignee' as const,
    requestedAssignee,
    expectedStatus: issue.status,
    expectedAssignee: issue.assignee,
    expectedModifiedOn: issue.modifiedOn,
    state: 'pending' as const,
    idempotencyKey: requestId,
    schemaVersion: 1
  }

  const ops = client.apply(requestId, 'customer-success-assign-assignee')
  ops.notMatch(customerSuccess.class.SupportActionRequest, { _id: requestId })
  await ops.createDoc(customerSuccess.class.SupportActionRequest, internalSpaceId, request, requestId)
  const committed = await ops.commit()

  return { requestId, committed }
}

export async function submitReassignAssigneeSupportActionRequest (
  client: Pick<TxOperations, 'apply'>,
  internalSpaceId: Ref<ConversationProjectionSpace>,
  issue: Pick<Issue, '_id' | 'status' | 'assignee' | 'modifiedOn'>,
  currentAccountUuid: AccountUuid,
  requestedAssignee: Ref<Person>
): Promise<{ requestId: Ref<SupportActionRequest>, committed: CommitResult }> {
  const requestId = reassignAssigneeSupportActionRequestId(
    issue._id,
    currentAccountUuid,
    requestedAssignee,
    issue.modifiedOn
  )
  const request = {
    issueId: issue._id,
    action: 'reassign_assignee' as const,
    requestedAssignee,
    expectedStatus: issue.status,
    expectedAssignee: issue.assignee,
    expectedModifiedOn: issue.modifiedOn,
    state: 'pending' as const,
    idempotencyKey: requestId,
    schemaVersion: 1
  }

  const ops = client.apply(requestId, 'customer-success-reassign-assignee')
  ops.notMatch(customerSuccess.class.SupportActionRequest, { _id: requestId })
  await ops.createDoc(customerSuccess.class.SupportActionRequest, internalSpaceId, request, requestId)
  const committed = await ops.commit()

  return { requestId, committed }
}

export async function submitTransitionStatusSupportActionRequest (
  client: Pick<TxOperations, 'apply'>,
  internalSpaceId: Ref<ConversationProjectionSpace>,
  issue: Pick<Issue, '_id' | 'status' | 'assignee' | 'modifiedOn'>,
  currentAccountUuid: AccountUuid,
  requestedAssignee: Ref<Person>,
  requestedStatus: Ref<IssueStatus>
): Promise<{ requestId: Ref<SupportActionRequest>, committed: CommitResult }> {
  const requestId = transitionStatusSupportActionRequestId(
    issue._id,
    currentAccountUuid,
    requestedStatus,
    issue.modifiedOn
  )
  const request = {
    issueId: issue._id,
    action: 'transition_status' as const,
    requestedAssignee,
    requestedStatus,
    expectedStatus: issue.status,
    expectedAssignee: issue.assignee,
    expectedModifiedOn: issue.modifiedOn,
    state: 'pending' as const,
    idempotencyKey: requestId,
    schemaVersion: 1
  }

  const ops = client.apply(requestId, 'customer-success-transition-status')
  ops.notMatch(customerSuccess.class.SupportActionRequest, { _id: requestId })
  await ops.createDoc(customerSuccess.class.SupportActionRequest, internalSpaceId, request, requestId)
  const committed = await ops.commit()

  return { requestId, committed }
}

export function resolveSupportActionRoleAssignments (
  space: WithLookup<ConversationProjectionSpace> | undefined,
  hierarchy: Hierarchy
): SupportActionRoleAssignments {
  const spaceType = space?.$lookup?.type as WithLookup<SpaceType> | undefined
  const roles = spaceType?.$lookup?.roles as Role[] | undefined
  if (space === undefined || spaceType === undefined || roles === undefined) {
    return { supportAgent: [], supportLead: [] }
  }

  const assignments = hierarchy.as(space, spaceType.targetClass) as unknown as RolesAssignment
  const result: SupportActionRoleAssignments = { supportAgent: [], supportLead: [] }

  for (const role of roles) {
    if (role._id === customerSuccess.role.SupportAgent) {
      result.supportAgent = [...(assignments[role._id] ?? [])]
    }
    if (role._id === customerSuccess.role.SupportLead) {
      result.supportLead = [...(assignments[role._id] ?? [])]
    }
  }

  return result
}

export function isSupportActionRoleMember (
  space: WithLookup<ConversationProjectionSpace> | undefined,
  hierarchy: Hierarchy,
  accountUuid: AccountUuid
): boolean {
  const assignments = resolveSupportActionRoleAssignments(space, hierarchy)
  return assignments.supportAgent.includes(accountUuid) || assignments.supportLead.includes(accountUuid)
}

export function isSupportLeadRoleMember (
  space: WithLookup<ConversationProjectionSpace> | undefined,
  hierarchy: Hierarchy,
  accountUuid: AccountUuid
): boolean {
  return resolveSupportActionRoleAssignments(space, hierarchy).supportLead.includes(accountUuid)
}

export function resolveClaimSelfControlState (
  issue: Pick<Issue, 'status' | 'assignee' | 'modifiedOn'>,
  takeover: TakeoverChromeState,
  actionRequest: SupportActionRequest | undefined,
  currentEmployee: Ref<Person> | undefined,
  canManageSupportActions: boolean,
  submitting: boolean
): ClaimSelfControlState {
  const currentRequest = actionRequest?.action === 'claim_self' ? actionRequest : undefined
  const claimableStage = claimSelfSourceStatuses.has(issue.status)
  const assigneeEligible = issue.assignee === null || issue.assignee === currentEmployee
  const visible = canManageSupportActions && currentEmployee !== undefined && claimableStage && assigneeEligible
  const requestState = currentRequest?.state
  const currentSnapshot = currentRequest?.expectedModifiedOn === issue.modifiedOn
  const succeededRelevant =
    requestState === 'succeeded' &&
    currentRequest?.requestedAssignee === issue.assignee &&
    (issue.status === 'ndax:status:support:TakeoverRequested' || issue.status === 'ndax:status:support:HumanActive')
  const awaitingReconciliation = succeededRelevant && !takeover.confirmed
  const busy = submitting || (currentSnapshot && (requestState === 'pending' || requestState === 'processing'))
  const currentSnapshotTerminal =
    currentSnapshot && (requestState === 'failed' || requestState === 'superseded' || requestState === 'succeeded')

  return {
    visible,
    canSubmit: visible && !busy && !awaitingReconciliation && !currentSnapshotTerminal,
    busy,
    awaitingReconciliation,
    requestState
  }
}

export function resolveAssignLeadControlState (
  issue: Pick<Issue, 'status' | 'assignee' | 'modifiedOn'>,
  actionRequest: SupportActionRequest | undefined,
  canAssignLead: boolean,
  submitting: boolean
): AssignLeadControlState {
  const currentRequest = actionRequest?.action === 'assign_assignee' ? actionRequest : undefined
  const visible = canAssignLead && issue.assignee === null && assignLeadSourceStatuses.has(issue.status)
  const requestState = currentRequest?.state
  const currentSnapshot = currentRequest?.expectedModifiedOn === issue.modifiedOn
  const reconciled =
    requestState === 'succeeded' &&
    currentRequest?.requestedAssignee === issue.assignee &&
    issue.modifiedOn >= currentRequest.expectedModifiedOn
  const succeededRelevant = requestState === 'succeeded' && (currentSnapshot || reconciled)
  const awaitingReconciliation = succeededRelevant && !reconciled
  const busy = submitting || (currentSnapshot && (requestState === 'pending' || requestState === 'processing'))
  const currentSnapshotTerminal =
    currentSnapshot && (requestState === 'failed' || requestState === 'superseded' || requestState === 'succeeded')

  return {
    visible,
    canSelect: visible && !busy && !awaitingReconciliation && !reconciled && !currentSnapshotTerminal,
    canSubmit: visible && !busy && !awaitingReconciliation && !reconciled && !currentSnapshotTerminal,
    busy,
    awaitingReconciliation,
    reconciled,
    requestState
  }
}

export function resolveReassignLeadControlState (
  issue: Pick<Issue, 'status' | 'assignee' | 'modifiedOn'>,
  actionRequest: SupportActionRequest | undefined,
  selectedAssignee: Ref<Person> | null | undefined,
  canAssignLead: boolean,
  submitting: boolean
): AssignLeadControlState {
  const currentRequest = actionRequest?.action === 'reassign_assignee' ? actionRequest : undefined
  const visible = canAssignLead && issue.assignee !== null && assignLeadSourceStatuses.has(issue.status)
  const requestState = currentRequest?.state
  const currentSnapshot = currentRequest?.expectedModifiedOn === issue.modifiedOn
  const reconciled =
    requestState === 'succeeded' &&
    currentRequest?.requestedAssignee === issue.assignee &&
    issue.modifiedOn >= currentRequest.expectedModifiedOn
  const succeededRelevant = requestState === 'succeeded' && (currentSnapshot || reconciled)
  const awaitingReconciliation = succeededRelevant && !reconciled
  const busy = submitting || (currentSnapshot && (requestState === 'pending' || requestState === 'processing'))
  const currentSnapshotTerminal =
    currentSnapshot && (requestState === 'failed' || requestState === 'superseded' || requestState === 'succeeded')

  return {
    visible,
    canSelect: visible && !busy && !awaitingReconciliation && !reconciled && !currentSnapshotTerminal,
    canSubmit:
      visible &&
      selectedAssignee != null &&
      selectedAssignee !== issue.assignee &&
      !busy &&
      !awaitingReconciliation &&
      !reconciled &&
      !currentSnapshotTerminal,
    busy,
    awaitingReconciliation,
    reconciled,
    requestState
  }
}

export function resolveStatusTransitionControlState (
  issue: Pick<Issue, 'status' | 'assignee' | 'modifiedOn'>,
  takeover: TakeoverChromeState,
  actionRequest: SupportActionRequest | undefined,
  currentEmployee: Ref<Person> | undefined,
  canManageSupportActions: boolean,
  submitting: boolean
): StatusTransitionControlState {
  const currentRequest = actionRequest?.action === 'transition_status' ? actionRequest : undefined
  const visible =
    canManageSupportActions &&
    currentEmployee !== undefined &&
    issue.assignee === currentEmployee &&
    issue.status === 'ndax:status:support:HumanActive' &&
    takeover.confirmed
  const requestState = currentRequest?.state
  const currentSnapshot = currentRequest?.expectedModifiedOn === issue.modifiedOn
  const reconciled =
    requestState === 'succeeded' &&
    currentRequest?.requestedStatus === issue.status &&
    currentRequest.requestedAssignee === issue.assignee &&
    issue.modifiedOn >= currentRequest.expectedModifiedOn
  const succeededRelevant = requestState === 'succeeded' && (currentSnapshot || reconciled)
  const awaitingReconciliation = succeededRelevant && !reconciled
  const busy = submitting || (currentSnapshot && (requestState === 'pending' || requestState === 'processing'))
  const currentSnapshotTerminal =
    currentSnapshot && (requestState === 'failed' || requestState === 'superseded' || requestState === 'succeeded')

  return {
    visible,
    canSubmit: visible && !busy && !awaitingReconciliation && !reconciled && !currentSnapshotTerminal,
    busy,
    awaitingReconciliation,
    reconciled,
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

export function shouldShowSupportActionRequestState (
  action: SupportActionRequest['action'] | undefined,
  hasStateLabel: boolean,
  canManageSupportActions: boolean,
  canAssignLead: boolean
): boolean {
  if (!hasStateLabel) return false
  if (action === 'assign_assignee' || action === 'reassign_assignee') return canAssignLead
  if (action === 'claim_self' || action === 'transition_status') return canManageSupportActions
  return false
}
