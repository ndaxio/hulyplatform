//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import customerSuccess, {
  type ConversationProjectionSpace,
  type LiveSessionState,
  type SupportActionRequest,
  type SupportLifecycleReasonCode,
  type SupportReopenReasonCode,
  type SupportResolveReasonCode,
  type SupportActionRequestState
} from '@hcengineering/customer-success'
import type { Issue, IssueStatus } from '@hcengineering/tracker'
import type { Employee, Person } from '@hcengineering/contact'
import type {
  AccountUuid,
  CommitResult,
  DocumentQuery,
  Hierarchy,
  Markup,
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

export const supportResolvedStatus = 'ndax:status:support:Resolved' as Ref<IssueStatus>
export const supportReopenedStatus = 'ndax:status:support:Reopened' as Ref<IssueStatus>
const supportClosedStatus = 'ndax:status:support:Closed' as Ref<IssueStatus>
const supportHumanActiveStatus = 'ndax:status:support:HumanActive' as Ref<IssueStatus>
const resolveCaseSourceStatuses = new Set<Ref<IssueStatus>>([
  supportHumanActiveStatus,
  'ndax:status:support:WaitingOnCustomer' as Ref<IssueStatus>,
  'ndax:status:support:WaitingOnInternal' as Ref<IssueStatus>
])
const publicReplySourceStatuses = new Set<Ref<IssueStatus>>([
  supportHumanActiveStatus,
  'ndax:status:support:WaitingOnCustomer' as Ref<IssueStatus>,
  'ndax:status:support:WaitingOnInternal' as Ref<IssueStatus>
])
const nonTerminalSupportStatuses = new Set<Ref<IssueStatus>>([
  'ndax:status:support:BotActive' as Ref<IssueStatus>,
  'ndax:status:support:NeedsHuman' as Ref<IssueStatus>,
  'ndax:status:support:Shadowing' as Ref<IssueStatus>,
  'ndax:status:support:TakeoverRequested' as Ref<IssueStatus>,
  supportHumanActiveStatus,
  'ndax:status:support:WaitingOnCustomer' as Ref<IssueStatus>,
  'ndax:status:support:WaitingOnInternal' as Ref<IssueStatus>,
  supportReopenedStatus,
  'ndax:status:support:Escalated' as Ref<IssueStatus>,
  tracker.status.Backlog as Ref<IssueStatus>
])

export const resolveCaseReasonCodes: SupportResolveReasonCode[] = [
  'customer_confirmed',
  'request_completed',
  'information_provided',
  'duplicate_request'
]
export const reopenCaseReasonCodes: SupportReopenReasonCode[] = [
  'customer_follow_up',
  'incomplete_resolution',
  'new_information',
  'quality_review'
]
const resolveCaseReasons = new Set<SupportLifecycleReasonCode>(resolveCaseReasonCodes)
const reopenCaseReasons = new Set<SupportLifecycleReasonCode>(reopenCaseReasonCodes)
export const terminalReasonDetailMaxLength = 500

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

export type TerminalAction = 'resolve_case' | 'reopen_case'
export type ConversationComposerAction = 'post_public_reply' | 'post_internal_note'
export type ConversationComposerUiState = 'idle' | 'sending' | 'delivered' | 'suppressed' | 'failed'
export const conversationComposerMessageMaxLength = 10000

export interface ConversationComposerControlState {
  visible: boolean
  enabled: boolean
  canSubmit: boolean
  busy: boolean
  status: ConversationComposerUiState
  requestState?: SupportActionRequestState
}

export function isTerminalReasonAllowed (
  action: TerminalAction,
  reasonCode: SupportLifecycleReasonCode | undefined
): reasonCode is SupportLifecycleReasonCode {
  if (reasonCode === undefined) return false
  return action === 'resolve_case' ? resolveCaseReasons.has(reasonCode) : reopenCaseReasons.has(reasonCode)
}

export interface TerminalActionControlState extends StatusTransitionControlState {
  action?: TerminalAction
  targetStatus?: Ref<IssueStatus>
}

export interface TerminalActionAuthorization {
  canManageSupportActions: boolean
  canReopenCase: boolean
  assigneeInActiveRoster: boolean
  liveSessionConfirmed: boolean
  hasCurrentProjectionProof: boolean
  projectionOwnerMatchesAssignee: boolean
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

export function terminalSupportActionRequestId (
  issueId: Ref<Issue>,
  currentAccountUuid: AccountUuid,
  action: TerminalAction,
  targetStatus: Ref<IssueStatus>,
  reasonCode: SupportLifecycleReasonCode,
  expectedModifiedOn: Timestamp
): Ref<SupportActionRequest> {
  return `ndax:support:action-request:${issueId}:${currentAccountUuid}:${action}:${targetStatus}:${reasonCode}:${expectedModifiedOn}` as Ref<SupportActionRequest>
}

export function conversationMessageSupportActionRequestId (
  issueId: Ref<Issue>,
  currentAccountUuid: AccountUuid,
  action: ConversationComposerAction,
  deliveryId: string,
  expectedModifiedOn: Timestamp
): Ref<SupportActionRequest> {
  return `ndax:support:action-request:${issueId}:${currentAccountUuid}:${action}:${deliveryId}:${expectedModifiedOn}` as Ref<SupportActionRequest>
}

export function conversationMessageDeliveryId (
  issueId: Ref<Issue>,
  currentAccountUuid: AccountUuid,
  action: ConversationComposerAction,
  clientDeliveryId: string
): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(clientDeliveryId)) {
    throw new Error('conversation_composer_delivery_id_invalid')
  }
  return `ndax:support:delivery:${issueId}:${currentAccountUuid}:${action}:${clientDeliveryId}`
}

export function normalizeConversationComposerMessage (message: string): Markup {
  const normalized = message
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ ]+$/g, ''))
    .join('\n')
    .trim()

  const containsDisallowedCharacter = Array.from(normalized).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return (
      (codePoint >= 0 && codePoint <= 31 && codePoint !== 10) ||
      (codePoint >= 127 && codePoint <= 159) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029 ||
      (codePoint >= 0x202a && codePoint <= 0x202e) ||
      (codePoint >= 0x2066 && codePoint <= 0x2069)
    )
  })
  if (containsDisallowedCharacter) {
    throw new Error('conversation_composer_not_plain_text')
  }
  if (normalized.length === 0) {
    throw new Error('conversation_composer_empty')
  }
  if (normalized.length > conversationComposerMessageMaxLength) {
    throw new Error('conversation_composer_too_long')
  }
  return normalized
}

export async function buildConversationComposerContentDigest (message: Markup): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (subtle === undefined) throw new Error('conversation_composer_digest_unavailable')
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(String(message)))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function normalizeTerminalReasonDetail (detail: string): string | undefined {
  const normalized = detail
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ ]+$/g, ''))
    .join('\n')
    .trim()

  const containsDisallowedCharacter = Array.from(normalized).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return (
      (codePoint >= 0 && codePoint <= 31 && codePoint !== 10) ||
      (codePoint >= 127 && codePoint <= 159) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029 ||
      (codePoint >= 0x202a && codePoint <= 0x202e) ||
      (codePoint >= 0x2066 && codePoint <= 0x2069)
    )
  })
  if (containsDisallowedCharacter) {
    throw new Error('terminal_reason_detail_not_plain_text')
  }
  if (normalized.length > terminalReasonDetailMaxLength) {
    throw new Error('terminal_reason_detail_too_long')
  }
  return normalized.length === 0 ? undefined : normalized
}

export function validateTerminalActionIntent (
  issue: Pick<Issue, 'status' | 'assignee'>,
  currentEmployee: Ref<Person> | undefined,
  action: TerminalAction,
  targetStatus: Ref<IssueStatus>,
  reasonCode: SupportLifecycleReasonCode,
  authorization: TerminalActionAuthorization
): void {
  if (action === 'resolve_case') {
    if (targetStatus !== supportResolvedStatus) throw new Error('terminal_target_not_allowed')
    if (!isTerminalReasonAllowed(action, reasonCode)) throw new Error('terminal_reason_not_allowed')
    if (!authorization.canManageSupportActions) throw new Error('terminal_role_not_allowed')
    if (currentEmployee === undefined || issue.assignee !== currentEmployee) throw new Error('terminal_owner_mismatch')
    if (!resolveCaseSourceStatuses.has(issue.status)) throw new Error('terminal_source_not_allowed')
    if (issue.status !== supportHumanActiveStatus && !authorization.hasCurrentProjectionProof) {
      throw new Error('terminal_projection_not_current')
    }
    if (issue.status !== supportHumanActiveStatus && !authorization.projectionOwnerMatchesAssignee) {
      throw new Error('terminal_projection_owner_mismatch')
    }
    if (issue.status === supportHumanActiveStatus && !authorization.liveSessionConfirmed) {
      throw new Error('terminal_live_session_not_confirmed')
    }
    return
  }

  if (targetStatus !== supportReopenedStatus) throw new Error('terminal_target_not_allowed')
  if (!isTerminalReasonAllowed(action, reasonCode)) throw new Error('terminal_reason_not_allowed')
  if (!authorization.canReopenCase) throw new Error('terminal_role_not_allowed')
  if (issue.status !== supportResolvedStatus) throw new Error('terminal_source_not_allowed')
  if (issue.assignee === null || !authorization.assigneeInActiveRoster) {
    throw new Error('terminal_owner_not_eligible')
  }
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
      if (request.action === 'post_public_reply' || request.action === 'post_internal_note') return false
      if (request.action === 'resolve_case' || request.action === 'reopen_case') {
        if (request.state !== 'succeeded') {
          return (
            request.expectedStatus === issue.status &&
            request.expectedAssignee === issue.assignee &&
            request.expectedModifiedOn === issue.modifiedOn
          )
        }
        return (
          request.requestedStatus === issue.status &&
          request.requestedAssignee === issue.assignee &&
          issue.modifiedOn >= request.expectedModifiedOn
        )
      }
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

export async function submitTerminalSupportActionRequest (
  client: Pick<TxOperations, 'apply'>,
  internalSpaceId: Ref<ConversationProjectionSpace>,
  issue: Pick<Issue, '_id' | 'status' | 'assignee' | 'modifiedOn'>,
  currentAccountUuid: AccountUuid,
  currentEmployee: Ref<Person> | undefined,
  action: TerminalAction,
  targetStatus: Ref<IssueStatus>,
  reasonCode: SupportLifecycleReasonCode,
  reasonDetail: string,
  authorization: TerminalActionAuthorization
): Promise<{ requestId: Ref<SupportActionRequest>, committed: CommitResult }> {
  validateTerminalActionIntent(issue, currentEmployee, action, targetStatus, reasonCode, authorization)
  const normalizedReasonDetail = normalizeTerminalReasonDetail(reasonDetail)
  if (issue.assignee === null) throw new Error('terminal_owner_not_eligible')

  const requestId = terminalSupportActionRequestId(
    issue._id,
    currentAccountUuid,
    action,
    targetStatus,
    reasonCode,
    issue.modifiedOn
  )
  const request = {
    issueId: issue._id,
    action,
    requestedAssignee: issue.assignee,
    requestedStatus: targetStatus,
    expectedStatus: issue.status,
    expectedAssignee: issue.assignee,
    expectedModifiedOn: issue.modifiedOn,
    reasonCode,
    ...(normalizedReasonDetail === undefined ? {} : { reasonDetail: normalizedReasonDetail }),
    state: 'pending' as const,
    idempotencyKey: requestId,
    schemaVersion: 1
  }

  const ops = client.apply(requestId, `customer-success-${action.replace('_', '-')}`)
  ops.notMatch(customerSuccess.class.SupportActionRequest, { _id: requestId })
  await ops.createDoc(customerSuccess.class.SupportActionRequest, internalSpaceId, request, requestId)
  const committed = await ops.commit()

  return { requestId, committed }
}

export async function submitConversationMessageSupportActionRequest (
  client: Pick<TxOperations, 'apply'>,
  internalSpaceId: Ref<ConversationProjectionSpace>,
  issue: Pick<Issue, '_id' | 'status' | 'assignee' | 'modifiedOn'>,
  currentAccountUuid: AccountUuid,
  action: ConversationComposerAction,
  deliveryId: string,
  message: string
): Promise<{ requestId: Ref<SupportActionRequest>, committed: CommitResult }> {
  const normalizedMessage = normalizeConversationComposerMessage(message)
  const requestId = conversationMessageSupportActionRequestId(
    issue._id,
    currentAccountUuid,
    action,
    deliveryId,
    issue.modifiedOn
  )
  const request = {
    issueId: issue._id,
    action,
    expectedStatus: issue.status,
    expectedAssignee: issue.assignee,
    expectedModifiedOn: issue.modifiedOn,
    deliveryId,
    message: normalizedMessage,
    contentDigest: await buildConversationComposerContentDigest(normalizedMessage),
    state: 'pending' as const,
    idempotencyKey: requestId,
    schemaVersion: 1
  }

  const suffix = action === 'post_public_reply' ? 'post-public-reply' : 'post-internal-note'
  const ops = client.apply(requestId, `customer-success-${suffix}`)
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

export function resolveTerminalActionControlState (
  issue: Pick<Issue, 'status' | 'assignee' | 'modifiedOn'>,
  takeover: TakeoverChromeState,
  actionRequest: SupportActionRequest | undefined,
  currentEmployee: Ref<Person> | undefined,
  canManageSupportActions: boolean,
  canReopenCase: boolean,
  assigneeInActiveRoster: boolean,
  submitting: boolean
): TerminalActionControlState {
  const action: TerminalAction | undefined = resolveCaseSourceStatuses.has(issue.status)
    ? 'resolve_case'
    : issue.status === supportResolvedStatus
      ? 'reopen_case'
      : undefined
  const targetStatus =
    action === 'resolve_case' ? supportResolvedStatus : action === 'reopen_case' ? supportReopenedStatus : undefined
  const ownerCanResolve =
    action === 'resolve_case' &&
    canManageSupportActions &&
    currentEmployee !== undefined &&
    issue.assignee === currentEmployee
  const resolveProofCurrent =
    ownerCanResolve &&
    (issue.status === supportHumanActiveStatus
      ? takeover.confirmed
      : takeover.projectionCurrent && takeover.claimOwner === issue.assignee)
  const leadCanReopen = action === 'reopen_case' && canReopenCase && issue.assignee !== null
  const reopenProofCurrent = leadCanReopen && assigneeInActiveRoster
  const visible = ownerCanResolve || leadCanReopen
  const currentRequest =
    actionRequest?.action === 'resolve_case' || actionRequest?.action === 'reopen_case' ? actionRequest : undefined
  const requestState = currentRequest?.state
  const currentSnapshot =
    currentRequest?.expectedModifiedOn === issue.modifiedOn &&
    currentRequest.expectedStatus === issue.status &&
    currentRequest.expectedAssignee === issue.assignee
  const reconciled =
    requestState === 'succeeded' &&
    currentRequest?.requestedStatus === issue.status &&
    currentRequest.requestedAssignee === issue.assignee &&
    issue.modifiedOn >= currentRequest.expectedModifiedOn
  const succeededRelevant = requestState === 'succeeded' && (currentSnapshot || reconciled)
  const awaitingReconciliation = succeededRelevant && !reconciled
  const busy = submitting || (currentSnapshot && (requestState === 'pending' || requestState === 'processing'))
  const proofCurrent = action === 'resolve_case' ? resolveProofCurrent : reopenProofCurrent

  return {
    action,
    targetStatus,
    visible,
    canSubmit: visible && proofCurrent && !busy && !awaitingReconciliation && !reconciled,
    busy,
    awaitingReconciliation,
    reconciled,
    requestState
  }
}

export function resolveConversationComposerControlState (
  action: ConversationComposerAction,
  issue: Pick<Issue, '_id' | 'status' | 'assignee' | 'modifiedOn'>,
  takeover: TakeoverChromeState,
  actionRequest: SupportActionRequest | undefined,
  currentEmployee: Ref<Person> | undefined,
  currentEmployeeActive: boolean,
  canManageSupportActions: boolean,
  submitting: boolean,
  submissionFailed: boolean
): ConversationComposerControlState {
  const currentRequest = actionRequest?.action === action ? actionRequest : undefined
  const requestState = currentRequest?.state
  const publicReplyVisible =
    canManageSupportActions &&
    currentEmployee !== undefined &&
    issue.assignee === currentEmployee &&
    publicReplySourceStatuses.has(issue.status)
  const publicReplyEvidenceCurrent =
    publicReplyVisible &&
    (issue.status === supportHumanActiveStatus
      ? takeover.confirmed
      : takeover.projectionCurrent && takeover.claimOwner === issue.assignee)
  const internalNoteVisible =
    canManageSupportActions &&
    currentEmployee !== undefined &&
    nonTerminalSupportStatuses.has(issue.status) &&
    issue.status !== supportResolvedStatus &&
    issue.status !== supportClosedStatus
  const internalNoteEvidenceCurrent = internalNoteVisible && currentEmployeeActive
  const visible = action === 'post_public_reply' ? publicReplyVisible : internalNoteVisible
  const enabled = action === 'post_public_reply' ? publicReplyEvidenceCurrent : internalNoteEvidenceCurrent

  let status: ConversationComposerUiState = 'idle'
  if (submissionFailed || requestState === 'failed' || requestState === 'superseded') {
    status = 'failed'
  } else if (submitting || requestState === 'pending' || requestState === 'processing') {
    status = 'sending'
  } else if (requestState === 'succeeded') {
    if (currentRequest?.resultCode === 'suppressed') {
      status = 'suppressed'
    } else if (
      currentRequest?.resultCode === 'sent' ||
      currentRequest?.resultCode === 'already_sent' ||
      currentRequest?.resultCode === 'recorded' ||
      currentRequest?.resultCode === 'already_recorded'
    ) {
      status = 'delivered'
    } else {
      status = 'sending'
    }
  }

  return {
    visible,
    enabled,
    canSubmit: visible && enabled && (status === 'idle' || status === 'failed'),
    busy: status === 'sending',
    status,
    requestState
  }
}

export function shouldClearConversationComposerDraft (
  request: SupportActionRequest | undefined,
  deliveryEventObserved: boolean
): boolean {
  if (request === undefined) return false
  if (request.action !== 'post_public_reply' && request.action !== 'post_internal_note') return false
  if (request.state !== 'succeeded') return false
  if (request.resultCode === 'suppressed') return true
  if (
    (request.resultCode === 'sent' ||
      request.resultCode === 'already_sent' ||
      request.resultCode === 'recorded' ||
      request.resultCode === 'already_recorded') &&
    request.resultEventId !== undefined
  ) {
    return deliveryEventObserved
  }
  return false
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
  if (action === 'reopen_case') return canAssignLead
  if (action === 'claim_self' || action === 'transition_status' || action === 'resolve_case') {
    return canManageSupportActions
  }
  return false
}
