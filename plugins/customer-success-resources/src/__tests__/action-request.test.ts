//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import customerSuccess, {
  type ConversationProjectionSpace,
  type SupportActionRequest
} from '@hcengineering/customer-success'
import type { AccountUuid, Ref, RolesAssignment, SpaceType, WithLookup } from '@hcengineering/core'
import type { Employee, Person } from '@hcengineering/contact'
import type { Issue, IssueStatus } from '@hcengineering/tracker'

import {
  assignAssigneeSupportActionRequestId,
  buildSupportActionRequestHydrationQuery,
  buildAssignLeadCandidateQuery,
  canonicalSupportAssignee,
  buildConversationComposerContentDigest,
  buildSupportActionRequestQuery,
  claimSelfSupportActionRequestId,
  conversationMessageDeliveryId,
  conversationMessageSupportActionRequestId,
  isTerminalReasonAllowed,
  isSupportLeadRoleMember,
  normalizeConversationComposerMessage,
  resolveConversationComposerControlState,
  resolveAssignLeadControlState,
  resolveReassignLeadControlState,
  resolveStatusTransitionControlState,
  resolveTerminalActionControlState,
  resolveSupportActionRoleAssignments,
  isSupportActionRoleMember,
  resolveClaimSelfControlState,
  selectHydratedSupportActionRequestId,
  shouldClearConversationComposerDraft,
  submitAssignAssigneeSupportActionRequest,
  submitConversationMessageSupportActionRequest,
  submitReassignAssigneeSupportActionRequest,
  submitTransitionStatusSupportActionRequest,
  submitTerminalSupportActionRequest,
  shouldReleaseActiveSupportActionRequest,
  shouldShowSupportActionRequestState,
  submitClaimSelfSupportActionRequest,
  terminalSupportActionRequestId,
  transitionStatusSupportActionRequestId,
  normalizeTerminalReasonDetail,
  validateTerminalActionIntent
} from '../action-request'
import { resolveTakeoverChromeState } from '../takeover-state'

function issue (
  status: string,
  assignee: Ref<Person> | null = null,
  modifiedOn = 100
): Pick<Issue, '_id' | 'status' | 'assignee' | 'modifiedOn'> {
  return {
    _id: 'issue-1' as Ref<Issue>,
    status: status as Ref<IssueStatus>,
    assignee,
    modifiedOn
  }
}

function actionRequest (overrides: Partial<SupportActionRequest> = {}): SupportActionRequest {
  return {
    _id: 'request-1' as Ref<SupportActionRequest>,
    _class: 'customer-success:class:SupportActionRequest' as SupportActionRequest['_class'],
    space: 'ndax:support:projection:internal' as SupportActionRequest['space'],
    modifiedOn: 101,
    modifiedBy: 'account-1' as SupportActionRequest['modifiedBy'],
    issueId: 'issue-1' as Ref<Issue>,
    action: 'claim_self',
    requestedAssignee: 'person-1' as Ref<Person>,
    expectedStatus: 'ndax:status:support:TakeoverRequested' as Ref<IssueStatus>,
    expectedAssignee: null,
    expectedModifiedOn: 100,
    deliveryId: 'delivery-1',
    message: 'hello world',
    contentDigest: 'digest-1',
    state: 'pending',
    idempotencyKey: 'request-1',
    schemaVersion: 1,
    ...overrides
  }
}

function projectionSpace (): WithLookup<ConversationProjectionSpace> {
  const space = {
    _id: 'ndax:support:projection:internal' as Ref<ConversationProjectionSpace>,
    _class: 'customer-success:class:ConversationProjectionSpace' as ConversationProjectionSpace['_class'],
    space: 'core:space:Space' as ConversationProjectionSpace['space'],
    modifiedOn: 0,
    modifiedBy: 'account-1' as ConversationProjectionSpace['modifiedBy'],
    name: 'Internal projection',
    description: '',
    private: false,
    archived: false,
    members: [],
    type: 'customer-success:spaceType:ConversationProjection' as unknown as ConversationProjectionSpace['type'],
    $lookup: {
      type: {
        _id: 'customer-success:spaceType:ConversationProjection' as Ref<SpaceType>,
        $lookup: {
          roles: [
            { _id: customerSuccess.role.SupportAgent },
            { _id: customerSuccess.role.SupportLead },
            { _id: customerSuccess.role.Compliance }
          ]
        },
        targetClass: customerSuccess.mixin.ConversationProjectionSpaceTypeData
      }
    }
  }

  return space as unknown as WithLookup<ConversationProjectionSpace> & RolesAssignment
}

describe('Customer Success support action request helpers', () => {
  it('builds exact active-Person candidate queries from resolved support-role assignments', () => {
    expect(buildAssignLeadCandidateQuery([])).toEqual({ _id: 'none', active: true })
    expect(buildAssignLeadCandidateQuery(['person-1', 'person-2'] as Array<Ref<Person>>)).toEqual({
      _id: { $in: ['person-1', 'person-2'] },
      active: true
    })
  })

  it('canonicalizes legacy account assignees to Person refs without changing native Person refs', () => {
    const employeeRefs = new Map<AccountUuid, Ref<Employee>>([
      ['account-1' as AccountUuid, 'person-1' as Ref<Employee>]
    ])

    expect(canonicalSupportAssignee(null, employeeRefs)).toBeNull()
    expect(canonicalSupportAssignee('account-1' as AccountUuid, employeeRefs)).toBe('person-1')
    expect(canonicalSupportAssignee('person-2' as Ref<Person>, employeeRefs)).toBe('person-2')
  })

  it('builds deterministic exact-id schema-v1 internal queries', () => {
    const requestId = claimSelfSupportActionRequestId('issue-1' as Ref<Issue>, 'account-1' as AccountUuid, 100)
    const assignRequestId = assignAssigneeSupportActionRequestId(
      'issue-1' as Ref<Issue>,
      'account-1' as AccountUuid,
      'person-2' as Ref<Person>,
      100
    )

    expect(requestId).toBe('ndax:support:action-request:issue-1:account-1:claim_self:100')
    expect(assignRequestId).toBe('ndax:support:action-request:issue-1:account-1:assign_assignee:person-2:100')
    expect(
      buildSupportActionRequestQuery(
        'ndax:support:projection:internal' as Ref<ConversationProjectionSpace>,
        requestId,
        'issue-1' as Ref<Issue>
      )
    ).toEqual({
      _id: 'ndax:support:action-request:issue-1:account-1:claim_self:100',
      space: 'ndax:support:projection:internal',
      issueId: 'issue-1',
      schemaVersion: 1
    })
    expect(
      buildSupportActionRequestHydrationQuery(
        'ndax:support:projection:internal' as Ref<ConversationProjectionSpace>,
        'issue-1' as Ref<Issue>,
        'account-1' as AccountUuid
      )
    ).toEqual({
      _id: {
        $like: 'ndax:support:action-request:issue-1:account-1:%'
      },
      space: 'ndax:support:projection:internal',
      issueId: 'issue-1',
      schemaVersion: 1
    })
  })

  it('builds namespaced delivery ids, rejects invalid nonces, and binds request ids to the full delivery id', () => {
    const publicDeliveryId = conversationMessageDeliveryId(
      'issue-1' as Ref<Issue>,
      'account-1' as AccountUuid,
      'post_public_reply',
      'delivery-public-1'
    )
    const internalDeliveryId = conversationMessageDeliveryId(
      'issue-1' as Ref<Issue>,
      'account-1' as AccountUuid,
      'post_internal_note',
      'delivery-internal-1'
    )

    expect(publicDeliveryId).toBe('ndax:support:delivery:issue-1:account-1:post_public_reply:delivery-public-1')
    expect(internalDeliveryId).toBe('ndax:support:delivery:issue-1:account-1:post_internal_note:delivery-internal-1')
    expect(() => {
      conversationMessageDeliveryId(
        'issue-1' as Ref<Issue>,
        'account-1' as AccountUuid,
        'post_public_reply',
        'delivery:public:1'
      )
    }).toThrow('conversation_composer_delivery_id_invalid')

    expect(
      conversationMessageSupportActionRequestId(
        'issue-1' as Ref<Issue>,
        'account-1' as AccountUuid,
        'post_public_reply',
        publicDeliveryId,
        100
      )
    ).toBe(
      'ndax:support:action-request:issue-1:account-1:post_public_reply:ndax:support:delivery:issue-1:account-1:post_public_reply:delivery-public-1:100'
    )

    expect(
      conversationMessageSupportActionRequestId(
        'issue-1' as Ref<Issue>,
        'account-1' as AccountUuid,
        'post_internal_note',
        internalDeliveryId,
        100
      )
    ).toBe(
      'ndax:support:action-request:issue-1:account-1:post_internal_note:ndax:support:delivery:issue-1:account-1:post_internal_note:delivery-internal-1:100'
    )
  })

  it('selects the latest relevant support request deterministically after the issue snapshot advances', () => {
    expect(
      selectHydratedSupportActionRequestId(
        [
          actionRequest({
            _id: 'ndax:support:action-request:issue-1:account-1:assign_assignee:person-4:100' as Ref<SupportActionRequest>,
            action: 'assign_assignee',
            requestedAssignee: 'person-4' as Ref<Person>,
            state: 'succeeded',
            modifiedOn: 104
          }),
          actionRequest({
            _id: 'ndax:support:action-request:issue-1:account-1:assign_assignee:person-3:100' as Ref<SupportActionRequest>,
            action: 'assign_assignee',
            requestedAssignee: 'person-3' as Ref<Person>,
            state: 'succeeded',
            modifiedOn: 105
          }),
          actionRequest({
            _id: 'ndax:support:action-request:issue-1:account-1:assign_assignee:person-2:100' as Ref<SupportActionRequest>,
            action: 'assign_assignee',
            requestedAssignee: 'person-2' as Ref<Person>,
            state: 'succeeded',
            modifiedOn: 105
          }),
          actionRequest({
            _id: 'ndax:support:action-request:issue-1:account-1:claim_self:100' as Ref<SupportActionRequest>,
            action: 'claim_self',
            state: 'succeeded',
            modifiedOn: 999
          }),
          actionRequest({
            _id: 'ndax:support:action-request:issue-1:account-1:assign_assignee:person-1:100' as Ref<SupportActionRequest>,
            action: 'assign_assignee',
            schemaVersion: 2,
            modifiedOn: 999
          })
        ],
        issue('ndax:status:support:NeedsHuman', 'person-2' as Ref<Person>, 200)
      )
    ).toBe('ndax:support:action-request:issue-1:account-1:assign_assignee:person-2:100')
    expect(selectHydratedSupportActionRequestId([], issue('ndax:status:support:NeedsHuman'))).toBeUndefined()
  })

  it('never hydrates native composer requests into takeover/status action state', () => {
    expect(
      selectHydratedSupportActionRequestId(
        [
          actionRequest({
            _id: 'ndax:support:action-request:issue-1:account-1:post_public_reply:delivery-public-1:100' as Ref<SupportActionRequest>,
            action: 'post_public_reply',
            requestedAssignee: 'person-1' as Ref<Person>,
            expectedStatus: 'ndax:status:support:WaitingOnCustomer' as Ref<IssueStatus>,
            expectedAssignee: 'person-1' as Ref<Person>,
            state: 'succeeded',
            resultCode: 'sent',
            resultEventId: 'evt-1',
            modifiedOn: 104
          })
        ],
        issue('ndax:status:support:WaitingOnCustomer', 'person-1' as Ref<Person>, 105)
      )
    ).toBeUndefined()
  })

  it('creates assign-assignee requests through exact-id CAS guarded apply().notMatch()', async () => {
    const notMatch = jest.fn().mockReturnThis()
    const createDoc = jest.fn().mockResolvedValue('request-id')
    const commit = jest.fn().mockResolvedValue({ result: true, time: 3, serverTime: 2 })
    const apply = jest.fn().mockReturnValue({ notMatch, createDoc, commit })

    const result = await submitAssignAssigneeSupportActionRequest(
      { apply } as any,
      'ndax:support:projection:internal' as Ref<ConversationProjectionSpace>,
      issue('ndax:status:support:NeedsHuman'),
      'account-1' as AccountUuid,
      'person-2' as Ref<Person>
    )

    expect(result.requestId).toBe('ndax:support:action-request:issue-1:account-1:assign_assignee:person-2:100')
    expect(apply).toHaveBeenCalledWith(
      'ndax:support:action-request:issue-1:account-1:assign_assignee:person-2:100',
      'customer-success-assign-assignee'
    )
    expect(notMatch).toHaveBeenCalledWith(customerSuccess.class.SupportActionRequest, {
      _id: 'ndax:support:action-request:issue-1:account-1:assign_assignee:person-2:100'
    })
    expect(createDoc).toHaveBeenCalledWith(
      customerSuccess.class.SupportActionRequest,
      'ndax:support:projection:internal',
      expect.objectContaining({
        issueId: 'issue-1',
        action: 'assign_assignee',
        requestedAssignee: 'person-2',
        expectedStatus: 'ndax:status:support:NeedsHuman',
        expectedAssignee: null,
        expectedModifiedOn: 100,
        state: 'pending',
        idempotencyKey: 'ndax:support:action-request:issue-1:account-1:assign_assignee:person-2:100',
        schemaVersion: 1
      }),
      'ndax:support:action-request:issue-1:account-1:assign_assignee:person-2:100'
    )
    expect(commit).toHaveBeenCalled()
  })

  it('creates claim-self requests through exact-id CAS guarded apply().notMatch()', async () => {
    const notMatch = jest.fn().mockReturnThis()
    const createDoc = jest.fn().mockResolvedValue('request-id')
    const commit = jest.fn().mockResolvedValue({ result: true, time: 3, serverTime: 2 })
    const apply = jest.fn().mockReturnValue({ notMatch, createDoc, commit })

    const result = await submitClaimSelfSupportActionRequest(
      { apply } as any,
      'ndax:support:projection:internal' as Ref<ConversationProjectionSpace>,
      issue('ndax:status:support:TakeoverRequested'),
      'account-1' as AccountUuid,
      'person-1' as Ref<Person>
    )

    expect(result.requestId).toBe('ndax:support:action-request:issue-1:account-1:claim_self:100')
    expect(apply).toHaveBeenCalledWith(
      'ndax:support:action-request:issue-1:account-1:claim_self:100',
      'customer-success-claim-self'
    )
    expect(notMatch).toHaveBeenCalledWith(customerSuccess.class.SupportActionRequest, {
      _id: 'ndax:support:action-request:issue-1:account-1:claim_self:100'
    })
    expect(createDoc).toHaveBeenCalledWith(
      customerSuccess.class.SupportActionRequest,
      'ndax:support:projection:internal',
      expect.objectContaining({
        issueId: 'issue-1',
        action: 'claim_self',
        requestedAssignee: 'person-1',
        expectedStatus: 'ndax:status:support:TakeoverRequested',
        expectedAssignee: null,
        expectedModifiedOn: 100,
        state: 'pending',
        idempotencyKey: 'ndax:support:action-request:issue-1:account-1:claim_self:100',
        schemaVersion: 1
      }),
      'ndax:support:action-request:issue-1:account-1:claim_self:100'
    )
    const request = createDoc.mock.calls[0][2]
    for (const field of ['deliveryId', 'message', 'contentDigest']) {
      expect(request).not.toHaveProperty(field)
    }
    expect(commit).toHaveBeenCalled()
  })

  it('creates native composer requests with immutable creator and payload binding', async () => {
    const notMatch = jest.fn().mockReturnThis()
    const createDoc = jest.fn().mockResolvedValue('request-id')
    const commit = jest.fn().mockResolvedValue({ result: true, time: 3, serverTime: 2 })
    const apply = jest.fn().mockReturnValue({ notMatch, createDoc, commit })

    const deliveryId = conversationMessageDeliveryId(
      'issue-1' as Ref<Issue>,
      'account-1' as AccountUuid,
      'post_public_reply',
      'delivery-public-1'
    )
    const digest = await buildConversationComposerContentDigest('Hello\ncustomer')
    const result = await submitConversationMessageSupportActionRequest(
      { apply } as any,
      'ndax:support:projection:internal' as Ref<ConversationProjectionSpace>,
      issue('ndax:status:support:WaitingOnCustomer', 'person-9' as Ref<Person>),
      'account-1' as AccountUuid,
      'post_public_reply',
      deliveryId,
      '  Hello\r\ncustomer  '
    )

    expect(result.requestId).toBe(
      'ndax:support:action-request:issue-1:account-1:post_public_reply:ndax:support:delivery:issue-1:account-1:post_public_reply:delivery-public-1:100'
    )
    expect(apply).toHaveBeenCalledWith(
      'ndax:support:action-request:issue-1:account-1:post_public_reply:ndax:support:delivery:issue-1:account-1:post_public_reply:delivery-public-1:100',
      'customer-success-post-public-reply'
    )
    expect(notMatch).toHaveBeenCalledWith(customerSuccess.class.SupportActionRequest, {
      _id: 'ndax:support:action-request:issue-1:account-1:post_public_reply:ndax:support:delivery:issue-1:account-1:post_public_reply:delivery-public-1:100'
    })
    expect(createDoc).toHaveBeenCalledWith(
      customerSuccess.class.SupportActionRequest,
      'ndax:support:projection:internal',
      expect.objectContaining({
        issueId: 'issue-1',
        action: 'post_public_reply',
        expectedStatus: 'ndax:status:support:WaitingOnCustomer',
        expectedAssignee: 'person-9',
        expectedModifiedOn: 100,
        deliveryId,
        message: 'Hello\ncustomer',
        contentDigest: digest,
        state: 'pending',
        idempotencyKey:
          'ndax:support:action-request:issue-1:account-1:post_public_reply:ndax:support:delivery:issue-1:account-1:post_public_reply:delivery-public-1:100',
        schemaVersion: 1
      }),
      'ndax:support:action-request:issue-1:account-1:post_public_reply:ndax:support:delivery:issue-1:account-1:post_public_reply:delivery-public-1:100'
    )
    const request = createDoc.mock.calls[0][2]
    expect(request).not.toHaveProperty('requestedAssignee')
    expect(commit).toHaveBeenCalled()
  })

  it('creates deterministic reassignment requests with the exact prior assignee snapshot', async () => {
    const notMatch = jest.fn().mockReturnThis()
    const createDoc = jest.fn().mockResolvedValue('request-id')
    const commit = jest.fn().mockResolvedValue({ result: true, time: 3, serverTime: 2 })
    const apply = jest.fn().mockReturnValue({ notMatch, createDoc, commit })

    const result = await submitReassignAssigneeSupportActionRequest(
      { apply } as any,
      'ndax:support:projection:internal' as Ref<ConversationProjectionSpace>,
      issue('ndax:status:support:NeedsHuman', 'person-1' as Ref<Person>),
      'account-1' as AccountUuid,
      'person-2' as Ref<Person>
    )

    expect(result.requestId).toBe('ndax:support:action-request:issue-1:account-1:reassign_assignee:person-2:100')
    expect(createDoc).toHaveBeenCalledWith(
      customerSuccess.class.SupportActionRequest,
      'ndax:support:projection:internal',
      expect.objectContaining({
        action: 'reassign_assignee',
        requestedAssignee: 'person-2',
        expectedAssignee: 'person-1',
        expectedModifiedOn: 100
      }),
      'ndax:support:action-request:issue-1:account-1:reassign_assignee:person-2:100'
    )
  })

  it('shows claim-self only to support agents and leads, not compliance-only viewers', () => {
    const hierarchy = {
      as: jest.fn((_space, _targetClass) => ({
        [customerSuccess.role.SupportAgent]: ['agent-account'],
        [customerSuccess.role.SupportLead]: ['lead-account'],
        [customerSuccess.role.Compliance]: ['compliance-account']
      }))
    }

    const space = projectionSpace()

    expect(isSupportActionRoleMember(space, hierarchy as any, 'lead-account' as AccountUuid)).toBe(true)
    expect(isSupportActionRoleMember(space, hierarchy as any, 'agent-account' as AccountUuid)).toBe(true)
    expect(isSupportActionRoleMember(space, hierarchy as any, 'compliance-account' as AccountUuid)).toBe(false)
    expect(isSupportActionRoleMember(space, hierarchy as any, 'other-account' as AccountUuid)).toBe(false)
    expect(isSupportLeadRoleMember(space, hierarchy as any, 'lead-account' as AccountUuid)).toBe(true)
    expect(isSupportLeadRoleMember(space, hierarchy as any, 'agent-account' as AccountUuid)).toBe(false)
    expect(isSupportLeadRoleMember(space, hierarchy as any, 'compliance-account' as AccountUuid)).toBe(false)
    expect(resolveSupportActionRoleAssignments(space, hierarchy as any)).toEqual({
      supportAgent: ['agent-account'],
      supportLead: ['lead-account']
    })
  })

  it('keeps Needs Human and Reopened tickets claimable even though they are not live-session stages', () => {
    for (const status of ['ndax:status:support:NeedsHuman', 'ndax:status:support:Reopened']) {
      const target = issue(status)
      expect(
        resolveClaimSelfControlState(
          target,
          resolveTakeoverChromeState(target),
          undefined,
          'person-1' as Ref<Person>,
          true,
          false
        )
      ).toEqual(expect.objectContaining({ visible: true, canSubmit: true }))
    }
  })

  it('never treats succeeded action requests as takeover success before reconciled live-session confirmation', () => {
    const target = issue('ndax:status:support:TakeoverRequested', 'person-1' as Ref<Person>)
    const takeover = resolveTakeoverChromeState(target)
    const control = resolveClaimSelfControlState(
      target,
      takeover,
      actionRequest({ state: 'succeeded' }),
      'person-1' as Ref<Person>,
      true,
      false
    )

    expect(takeover.confirmed).toBe(false)
    expect(control.awaitingReconciliation).toBe(true)
    expect(control.canSubmit).toBe(false)
  })

  it('keeps unauthorized viewers from seeing claim request state even if a request row exists', () => {
    const target = issue('ndax:status:support:TakeoverRequested')
    const takeover = resolveTakeoverChromeState(target)

    expect(
      resolveClaimSelfControlState(
        target,
        takeover,
        actionRequest({ state: 'failed' }),
        'person-1' as Ref<Person>,
        false,
        false
      )
    ).toEqual(
      expect.objectContaining({
        visible: false,
        canSubmit: false
      })
    )
  })

  it('shows lead-assign only to support leads for unassigned conservative statuses', () => {
    for (const status of [
      'ndax:status:support:BotActive',
      'ndax:status:support:NeedsHuman',
      'ndax:status:support:Shadowing',
      'ndax:status:support:Reopened',
      'tracker:status:Backlog'
    ]) {
      expect(resolveAssignLeadControlState(issue(status), undefined, true, false)).toEqual(
        expect.objectContaining({ visible: true, canSubmit: true, reconciled: false })
      )
    }

    expect(
      resolveAssignLeadControlState(
        issue('ndax:status:support:NeedsHuman', 'person-9' as Ref<Person>),
        undefined,
        true,
        false
      )
    ).toEqual(expect.objectContaining({ visible: false, canSubmit: false }))
    expect(
      resolveAssignLeadControlState(issue('ndax:status:support:TakeoverRequested'), undefined, true, false)
    ).toEqual(expect.objectContaining({ visible: false, canSubmit: false }))
    expect(resolveAssignLeadControlState(issue('ndax:status:support:NeedsHuman'), undefined, false, false)).toEqual(
      expect.objectContaining({ visible: false, canSubmit: false })
    )
  })

  it('treats assign-assignee success as pending until the issue assignee reconciles on a current snapshot', () => {
    const control = resolveAssignLeadControlState(
      issue('ndax:status:support:NeedsHuman'),
      actionRequest({
        action: 'assign_assignee',
        requestedAssignee: 'person-2' as Ref<Person>,
        state: 'succeeded'
      }),
      true,
      false
    )
    expect(control.awaitingReconciliation).toBe(true)
    expect(control.reconciled).toBe(false)
    expect(control.canSubmit).toBe(false)

    const reconciled = resolveAssignLeadControlState(
      issue('ndax:status:support:NeedsHuman', 'person-2' as Ref<Person>, 100),
      actionRequest({
        action: 'assign_assignee',
        requestedAssignee: 'person-2' as Ref<Person>,
        state: 'succeeded'
      }),
      true,
      false
    )
    expect(reconciled.awaitingReconciliation).toBe(false)
    expect(reconciled.reconciled).toBe(true)
    expect(reconciled.canSubmit).toBe(false)
  })

  it('releases failed and superseded requests only after the issue advances to a new snapshot', () => {
    for (const state of ['failed', 'superseded'] as const) {
      expect(shouldReleaseActiveSupportActionRequest(actionRequest({ state }), 100)).toBe(false)
      expect(shouldReleaseActiveSupportActionRequest(actionRequest({ state }), 101)).toBe(true)
    }
    expect(shouldReleaseActiveSupportActionRequest(actionRequest({ state: 'processing' }), 101)).toBe(false)
    expect(shouldReleaseActiveSupportActionRequest(undefined, 101)).toBe(false)
  })

  it('keeps stale terminal outcomes displayable without blocking a valid newer-snapshot action', () => {
    const staleClaim = actionRequest({ state: 'failed', expectedModifiedOn: 100 })
    const claimTarget = issue('ndax:status:support:NeedsHuman', 'person-1' as Ref<Person>, 200)
    expect(
      resolveClaimSelfControlState(
        claimTarget,
        resolveTakeoverChromeState(claimTarget),
        staleClaim,
        'person-1' as Ref<Person>,
        true,
        false
      )
    ).toEqual(expect.objectContaining({ requestState: 'failed', visible: true, canSubmit: true, busy: false }))

    const staleAssign = actionRequest({
      action: 'assign_assignee',
      state: 'superseded',
      expectedModifiedOn: 100
    })
    expect(
      resolveAssignLeadControlState(issue('ndax:status:support:Reopened', null, 200), staleAssign, true, false)
    ).toEqual(expect.objectContaining({ requestState: 'superseded', visible: true, canSubmit: true, busy: false }))
  })

  it('builds deterministic 64-char SHA-256 composer content digests from normalized plain text', async () => {
    const digest = await buildConversationComposerContentDigest('Hello\nworld')

    expect(digest).toBe('46e0ea795802f17d0b340983ca7d7068c94d7d9172ee4daea37a1ab1168649ec')
    expect(digest).toHaveLength(64)
    expect(await buildConversationComposerContentDigest('Hello\nworld')).toBe(digest)
    expect(await buildConversationComposerContentDigest('Hello\nworld!')).not.toBe(digest)
  })

  it('rejects oversized composer messages above the 10000 character ceiling', () => {
    expect(() => normalizeConversationComposerMessage('x'.repeat(10000))).not.toThrow()
    expect(() => normalizeConversationComposerMessage('x'.repeat(10001))).toThrow('conversation_composer_too_long')
  })

  it('keeps public reply and internal note eligibility separate and fail-closed', () => {
    const humanActiveOwner = issue('ndax:status:support:HumanActive', 'person-1' as Ref<Person>)
    const waitingOwner = issue('ndax:status:support:WaitingOnCustomer', 'person-1' as Ref<Person>)
    const confirmed = { ...resolveTakeoverChromeState(humanActiveOwner), confirmed: true }
    const waitingProjection = {
      ...resolveTakeoverChromeState(waitingOwner),
      projectionCurrent: true,
      claimOwner: 'person-1' as Ref<Person>
    }

    expect(
      resolveConversationComposerControlState(
        'post_public_reply',
        humanActiveOwner,
        confirmed,
        undefined,
        'person-1' as Ref<Person>,
        true,
        true,
        false,
        false
      )
    ).toEqual(expect.objectContaining({ visible: true, enabled: true, canSubmit: true, status: 'idle' }))

    expect(
      resolveConversationComposerControlState(
        'post_public_reply',
        waitingOwner,
        waitingProjection,
        undefined,
        'person-1' as Ref<Person>,
        true,
        true,
        false,
        false
      )
    ).toEqual(expect.objectContaining({ visible: true, enabled: true, canSubmit: true, status: 'idle' }))

    expect(
      resolveConversationComposerControlState(
        'post_public_reply',
        waitingOwner,
        { ...waitingProjection, projectionCurrent: false },
        undefined,
        'person-1' as Ref<Person>,
        true,
        true,
        false,
        false
      )
    ).toEqual(expect.objectContaining({ visible: true, enabled: false, canSubmit: false }))

    expect(
      resolveConversationComposerControlState(
        'post_internal_note',
        issue('ndax:status:support:NeedsHuman', 'person-9' as Ref<Person>),
        resolveTakeoverChromeState(issue('ndax:status:support:NeedsHuman', 'person-9' as Ref<Person>)),
        undefined,
        'person-1' as Ref<Person>,
        true,
        true,
        false,
        false
      )
    ).toEqual(expect.objectContaining({ visible: true, enabled: true, canSubmit: true, status: 'idle' }))

    expect(
      resolveConversationComposerControlState(
        'post_internal_note',
        issue('ndax:status:support:Resolved', 'person-9' as Ref<Person>),
        resolveTakeoverChromeState(issue('ndax:status:support:Resolved', 'person-9' as Ref<Person>)),
        undefined,
        'person-1' as Ref<Person>,
        true,
        true,
        false,
        false
      )
    ).toEqual(expect.objectContaining({ visible: false, canSubmit: false }))
  })

  it('maps native composer state into the five UI outcomes', () => {
    const baseIssue = issue('ndax:status:support:WaitingOnCustomer', 'person-1' as Ref<Person>)
    const proof = {
      ...resolveTakeoverChromeState(baseIssue),
      projectionCurrent: true,
      claimOwner: 'person-1' as Ref<Person>
    }

    expect(
      resolveConversationComposerControlState(
        'post_public_reply',
        baseIssue,
        proof,
        undefined,
        'person-1' as Ref<Person>,
        true,
        true,
        false,
        false
      ).status
    ).toBe('idle')
    expect(
      resolveConversationComposerControlState(
        'post_public_reply',
        baseIssue,
        proof,
        actionRequest({ action: 'post_public_reply', state: 'pending' }),
        'person-1' as Ref<Person>,
        true,
        true,
        false,
        false
      ).status
    ).toBe('sending')
    const deliveredPublic = resolveConversationComposerControlState(
      'post_public_reply',
      baseIssue,
      proof,
      actionRequest({ action: 'post_public_reply', state: 'succeeded', resultCode: 'sent', resultEventId: 'evt-1' }),
      'person-1' as Ref<Person>,
      true,
      true,
      false,
      false
    )
    expect(deliveredPublic.status).toBe('delivered')
    expect(deliveredPublic.canSubmit).toBe(false)
    expect(
      resolveConversationComposerControlState(
        'post_internal_note',
        issue('ndax:status:support:NeedsHuman', 'person-9' as Ref<Person>),
        resolveTakeoverChromeState(issue('ndax:status:support:NeedsHuman', 'person-9' as Ref<Person>)),
        actionRequest({
          action: 'post_internal_note',
          state: 'succeeded',
          resultCode: 'recorded',
          resultEventId: 'evt-note-1'
        }),
        'person-1' as Ref<Person>,
        true,
        true,
        false,
        false
      ).status
    ).toBe('delivered')
    expect(
      resolveConversationComposerControlState(
        'post_internal_note',
        issue('ndax:status:support:NeedsHuman', 'person-9' as Ref<Person>),
        resolveTakeoverChromeState(issue('ndax:status:support:NeedsHuman', 'person-9' as Ref<Person>)),
        actionRequest({ action: 'post_internal_note', state: 'succeeded', resultCode: 'suppressed' }),
        'person-1' as Ref<Person>,
        true,
        true,
        false,
        false
      ).status
    ).toBe('suppressed')
    expect(
      resolveConversationComposerControlState(
        'post_internal_note',
        issue('ndax:status:support:NeedsHuman', 'person-9' as Ref<Person>),
        resolveTakeoverChromeState(issue('ndax:status:support:NeedsHuman', 'person-9' as Ref<Person>)),
        actionRequest({ action: 'post_internal_note', state: 'failed' }),
        'person-1' as Ref<Person>,
        true,
        true,
        false,
        false
      ).status
    ).toBe('failed')
    expect(
      resolveConversationComposerControlState(
        'post_internal_note',
        issue('ndax:status:support:NeedsHuman', 'person-9' as Ref<Person>),
        resolveTakeoverChromeState(issue('ndax:status:support:NeedsHuman', 'person-9' as Ref<Person>)),
        actionRequest({ action: 'post_internal_note', state: 'failed' }),
        'person-1' as Ref<Person>,
        true,
        true,
        false,
        false
      ).canSubmit
    ).toBe(true)
  })

  it('clears composer drafts only after trusted delivery or suppression reconciliation', () => {
    expect(
      shouldClearConversationComposerDraft(
        actionRequest({ action: 'post_public_reply', state: 'succeeded', resultCode: 'sent', resultEventId: 'evt-1' }),
        false
      )
    ).toBe(false)
    expect(
      shouldClearConversationComposerDraft(
        actionRequest({ action: 'post_public_reply', state: 'succeeded', resultCode: 'sent', resultEventId: 'evt-1' }),
        true
      )
    ).toBe(true)
    expect(
      shouldClearConversationComposerDraft(
        actionRequest({
          action: 'post_internal_note',
          state: 'succeeded',
          resultCode: 'already_recorded',
          resultEventId: 'evt-note-1'
        }),
        true
      )
    ).toBe(true)
    expect(
      shouldClearConversationComposerDraft(
        actionRequest({ action: 'post_internal_note', state: 'succeeded', resultCode: 'suppressed' }),
        false
      )
    ).toBe(true)
    expect(
      shouldClearConversationComposerDraft(actionRequest({ action: 'post_internal_note', state: 'failed' }), false)
    ).toBe(false)
  })

  it('keeps request outcome state visible after control eligibility changes without exposing it to unauthorized viewers', () => {
    expect(shouldShowSupportActionRequestState('claim_self', true, true, false)).toBe(true)
    expect(shouldShowSupportActionRequestState('claim_self', true, false, true)).toBe(false)
    expect(shouldShowSupportActionRequestState('assign_assignee', true, true, true)).toBe(true)
    expect(shouldShowSupportActionRequestState('assign_assignee', true, true, false)).toBe(false)
    expect(shouldShowSupportActionRequestState('assign_assignee', false, true, true)).toBe(false)
    expect(shouldShowSupportActionRequestState('reassign_assignee', true, true, true)).toBe(true)
    expect(shouldShowSupportActionRequestState('transition_status', true, true, false)).toBe(true)
    expect(shouldShowSupportActionRequestState('transition_status', true, false, true)).toBe(false)
    expect(shouldShowSupportActionRequestState('post_public_reply', true, true, true)).toBe(false)
    expect(shouldShowSupportActionRequestState('post_internal_note', true, true, true)).toBe(false)
    expect(shouldShowSupportActionRequestState(undefined, true, true, true)).toBe(false)
  })

  it('allows only leads to reassign eligible assigned tickets to a different target', () => {
    const target = issue('ndax:status:support:NeedsHuman', 'person-1' as Ref<Person>)
    expect(resolveReassignLeadControlState(target, undefined, 'person-2' as Ref<Person>, true, false)).toEqual(
      expect.objectContaining({ visible: true, canSubmit: true })
    )
    expect(resolveReassignLeadControlState(target, undefined, 'person-1' as Ref<Person>, true, false)).toEqual(
      expect.objectContaining({ visible: true, canSelect: true, canSubmit: false })
    )
    expect(resolveReassignLeadControlState(target, undefined, 'person-2' as Ref<Person>, false, false)).toEqual(
      expect.objectContaining({ visible: false, canSubmit: false })
    )
    for (const status of ['ndax:status:support:TakeoverRequested', 'ndax:status:support:HumanActive']) {
      expect(
        resolveReassignLeadControlState(
          issue(status, 'person-1' as Ref<Person>),
          undefined,
          'person-2' as Ref<Person>,
          true,
          false
        )
      ).toEqual(expect.objectContaining({ visible: false, canSubmit: false }))
    }
  })

  it('creates a deterministic status request with an unchanged owner snapshot', async () => {
    const notMatch = jest.fn().mockReturnThis()
    const createDoc = jest.fn().mockResolvedValue('request-id')
    const commit = jest.fn().mockResolvedValue({ result: true, time: 3, serverTime: 2 })
    const apply = jest.fn().mockReturnValue({ notMatch, createDoc, commit })
    const target = 'ndax:status:support:WaitingOnCustomer' as Ref<IssueStatus>

    const result = await submitTransitionStatusSupportActionRequest(
      { apply } as any,
      'ndax:support:projection:internal' as Ref<ConversationProjectionSpace>,
      issue('ndax:status:support:HumanActive', 'person-1' as Ref<Person>),
      'account-1' as AccountUuid,
      'person-1' as Ref<Person>,
      target
    )

    expect(result.requestId).toBe(
      transitionStatusSupportActionRequestId('issue-1' as Ref<Issue>, 'account-1' as AccountUuid, target, 100)
    )
    expect(createDoc).toHaveBeenCalledWith(
      customerSuccess.class.SupportActionRequest,
      'ndax:support:projection:internal',
      expect.objectContaining({
        action: 'transition_status',
        requestedAssignee: 'person-1',
        requestedStatus: target,
        expectedStatus: 'ndax:status:support:HumanActive',
        expectedAssignee: 'person-1'
      }),
      result.requestId
    )
  })

  it('shows status controls only to the confirmed current owner on Human Active', () => {
    const target = issue('ndax:status:support:HumanActive', 'person-1' as Ref<Person>)
    const confirmed = { ...resolveTakeoverChromeState(target), confirmed: true }
    expect(
      resolveStatusTransitionControlState(target, confirmed, undefined, 'person-1' as Ref<Person>, true, false)
    ).toEqual(expect.objectContaining({ visible: true, canSubmit: true }))
    expect(
      resolveStatusTransitionControlState(target, confirmed, undefined, 'person-2' as Ref<Person>, true, false)
    ).toEqual(expect.objectContaining({ visible: false, canSubmit: false }))
    expect(
      resolveStatusTransitionControlState(
        target,
        { ...confirmed, confirmed: false },
        undefined,
        'person-1' as Ref<Person>,
        true,
        false
      )
    ).toEqual(expect.objectContaining({ visible: false, canSubmit: false }))
    expect(
      resolveStatusTransitionControlState(
        issue('ndax:status:support:WaitingOnInternal', 'person-1' as Ref<Person>),
        confirmed,
        undefined,
        'person-1' as Ref<Person>,
        true,
        false
      )
    ).toEqual(expect.objectContaining({ visible: false, canSubmit: false }))
  })

  it('does not reconcile or rehydrate a status request after the owner changes', () => {
    const request = actionRequest({
      action: 'transition_status',
      requestedAssignee: 'person-1' as Ref<Person>,
      requestedStatus: 'ndax:status:support:WaitingOnCustomer' as Ref<IssueStatus>,
      expectedStatus: 'ndax:status:support:HumanActive' as Ref<IssueStatus>,
      expectedAssignee: 'person-1' as Ref<Person>,
      state: 'succeeded'
    })
    const changedOwner = issue('ndax:status:support:WaitingOnCustomer', 'person-2' as Ref<Person>, 101)
    expect(selectHydratedSupportActionRequestId([request], changedOwner)).toBeUndefined()
    expect(
      resolveStatusTransitionControlState(
        changedOwner,
        { ...resolveTakeoverChromeState(changedOwner), confirmed: false },
        request,
        'person-2' as Ref<Person>,
        true,
        false
      )
    ).toEqual(expect.objectContaining({ reconciled: false }))
  })

  it('normalizes terminal detail and builds the full deterministic lifecycle id', () => {
    expect(normalizeTerminalReasonDetail('  first  \r\nsecond\t \r\n  ')).toBe('first\nsecond')
    expect(normalizeTerminalReasonDetail('   ')).toBeUndefined()
    expect(() => normalizeTerminalReasonDetail(`x${String.fromCharCode(0)}y`)).toThrow(
      'terminal_reason_detail_not_plain_text'
    )
    expect(() => normalizeTerminalReasonDetail(`x${String.fromCharCode(9)}y`)).toThrow(
      'terminal_reason_detail_not_plain_text'
    )
    expect(() => normalizeTerminalReasonDetail(`x${String.fromCharCode(0x85)}y`)).toThrow(
      'terminal_reason_detail_not_plain_text'
    )
    expect(() => normalizeTerminalReasonDetail(`x${String.fromCharCode(0x2028)}y`)).toThrow(
      'terminal_reason_detail_not_plain_text'
    )
    expect(() => normalizeTerminalReasonDetail(`x${String.fromCharCode(0x202e)}y`)).toThrow(
      'terminal_reason_detail_not_plain_text'
    )
    expect(() => normalizeTerminalReasonDetail(`x${String.fromCharCode(0x2068)}y`)).toThrow(
      'terminal_reason_detail_not_plain_text'
    )
    expect(() => normalizeTerminalReasonDetail('x'.repeat(501))).toThrow('terminal_reason_detail_too_long')
    expect(
      terminalSupportActionRequestId(
        'issue-1' as Ref<Issue>,
        'account-1' as AccountUuid,
        'resolve_case',
        'ndax:status:support:Resolved' as Ref<IssueStatus>,
        'request_completed',
        100
      )
    ).toBe(
      'ndax:support:action-request:issue-1:account-1:resolve_case:ndax:status:support:Resolved:request_completed:100'
    )
  })

  it('keeps terminal drafts scoped to the active lifecycle action', () => {
    expect(isTerminalReasonAllowed('resolve_case', 'customer_confirmed')).toBe(true)
    expect(isTerminalReasonAllowed('resolve_case', 'customer_follow_up')).toBe(false)
    expect(isTerminalReasonAllowed('reopen_case', 'customer_follow_up')).toBe(true)
    expect(isTerminalReasonAllowed('reopen_case', 'customer_confirmed')).toBe(false)
    expect(isTerminalReasonAllowed('reopen_case', undefined)).toBe(false)
  })

  it('fails terminal intent locally for invalid role, source, target, reason, owner, and live evidence', () => {
    const owner = 'person-1' as Ref<Person>
    const target = issue('ndax:status:support:HumanActive', owner)
    const allowed = {
      canManageSupportActions: true,
      canReopenCase: false,
      assigneeInActiveRoster: true,
      liveSessionConfirmed: true,
      hasCurrentProjectionProof: true,
      projectionOwnerMatchesAssignee: true
    }
    const validateResolve = (authorization = allowed, source = target): void => {
      validateTerminalActionIntent(
        source,
        owner,
        'resolve_case',
        'ndax:status:support:Resolved' as Ref<IssueStatus>,
        'request_completed',
        authorization
      )
    }

    expect(validateResolve).not.toThrow()
    expect(() => {
      validateResolve({ ...allowed, canManageSupportActions: false })
    }).toThrow('terminal_role_not_allowed')
    expect(() => {
      validateResolve({ ...allowed, liveSessionConfirmed: false })
    }).toThrow('terminal_live_session_not_confirmed')
    expect(() => {
      validateResolve(allowed, issue('ndax:status:support:Escalated', owner))
    }).toThrow('terminal_source_not_allowed')
    expect(() => {
      validateTerminalActionIntent(
        target,
        'person-2' as Ref<Person>,
        'resolve_case',
        'ndax:status:support:Resolved' as Ref<IssueStatus>,
        'request_completed',
        allowed
      )
    }).toThrow('terminal_owner_mismatch')
    expect(() => {
      validateTerminalActionIntent(
        target,
        owner,
        'resolve_case',
        'ndax:status:support:Closed' as Ref<IssueStatus>,
        'request_completed',
        allowed
      )
    }).toThrow('terminal_target_not_allowed')
    expect(() => {
      validateTerminalActionIntent(
        target,
        owner,
        'resolve_case',
        'ndax:status:support:Resolved' as Ref<IssueStatus>,
        'quality_review',
        allowed
      )
    }).toThrow('terminal_reason_not_allowed')

    expect(() => {
      validateTerminalActionIntent(
        issue('ndax:status:support:WaitingOnCustomer', owner),
        owner,
        'resolve_case',
        'ndax:status:support:Resolved' as Ref<IssueStatus>,
        'request_completed',
        { ...allowed, hasCurrentProjectionProof: false }
      )
    }).toThrow('terminal_projection_not_current')
    expect(() => {
      validateTerminalActionIntent(
        issue('ndax:status:support:WaitingOnInternal', owner),
        owner,
        'resolve_case',
        'ndax:status:support:Resolved' as Ref<IssueStatus>,
        'request_completed',
        { ...allowed, projectionOwnerMatchesAssignee: false }
      )
    }).toThrow('terminal_projection_owner_mismatch')

    const reopenAuthorization = { ...allowed, canReopenCase: true }
    const resolved = issue('ndax:status:support:Resolved', owner)
    expect(() => {
      validateTerminalActionIntent(
        resolved,
        owner,
        'reopen_case',
        'ndax:status:support:Reopened' as Ref<IssueStatus>,
        'quality_review',
        reopenAuthorization
      )
    }).not.toThrow()
    expect(() => {
      validateTerminalActionIntent(
        resolved,
        owner,
        'reopen_case',
        'ndax:status:support:Reopened' as Ref<IssueStatus>,
        'request_completed',
        reopenAuthorization
      )
    }).toThrow('terminal_reason_not_allowed')
    expect(() => {
      validateTerminalActionIntent(
        resolved,
        owner,
        'reopen_case',
        'ndax:status:support:Reopened' as Ref<IssueStatus>,
        'quality_review',
        { ...reopenAuthorization, assigneeInActiveRoster: false }
      )
    }).toThrow('terminal_owner_not_eligible')
  })

  it('enforces resolve/reopen visibility and active-roster owner preservation', () => {
    const owner = 'person-1' as Ref<Person>
    const humanActive = issue('ndax:status:support:HumanActive', owner)
    expect(
      resolveTerminalActionControlState(
        humanActive,
        { ...resolveTakeoverChromeState(humanActive), confirmed: true },
        undefined,
        owner,
        true,
        false,
        true,
        false
      )
    ).toEqual(expect.objectContaining({ action: 'resolve_case', visible: true, canSubmit: true }))

    const waitingOnCustomer = issue('ndax:status:support:WaitingOnCustomer', owner)
    expect(
      resolveTerminalActionControlState(
        waitingOnCustomer,
        {
          ...resolveTakeoverChromeState(waitingOnCustomer),
          projectionCurrent: true,
          claimOwner: owner
        },
        undefined,
        owner,
        true,
        false,
        true,
        false
      )
    ).toEqual(expect.objectContaining({ action: 'resolve_case', visible: true, canSubmit: true }))
    expect(
      resolveTerminalActionControlState(
        waitingOnCustomer,
        resolveTakeoverChromeState(waitingOnCustomer),
        undefined,
        owner,
        true,
        false,
        true,
        false
      )
    ).toEqual(expect.objectContaining({ action: 'resolve_case', visible: true, canSubmit: false }))
    expect(
      resolveTerminalActionControlState(
        waitingOnCustomer,
        {
          ...resolveTakeoverChromeState(waitingOnCustomer),
          projectionCurrent: true,
          claimOwner: 'person-2' as Ref<Person>
        },
        undefined,
        owner,
        true,
        false,
        true,
        false
      )
    ).toEqual(expect.objectContaining({ action: 'resolve_case', visible: true, canSubmit: false }))

    const resolved = issue('ndax:status:support:Resolved', owner)
    const chrome = resolveTakeoverChromeState(resolved)
    expect(resolveTerminalActionControlState(resolved, chrome, undefined, owner, true, true, true, false)).toEqual(
      expect.objectContaining({ action: 'reopen_case', visible: true, canSubmit: true })
    )
    expect(resolveTerminalActionControlState(resolved, chrome, undefined, owner, true, false, true, false)).toEqual(
      expect.objectContaining({ visible: false, canSubmit: false })
    )
    expect(resolveTerminalActionControlState(resolved, chrome, undefined, owner, true, true, false, false)).toEqual(
      expect.objectContaining({ visible: true, canSubmit: false })
    )
    for (const status of [
      'ndax:status:support:Closed',
      'ndax:status:support:Escalated',
      'ndax:status:support:BotActive'
    ]) {
      const forbidden = issue(status, owner)
      expect(
        resolveTerminalActionControlState(
          forbidden,
          resolveTakeoverChromeState(forbidden),
          undefined,
          owner,
          true,
          true,
          true,
          false
        )
      ).toEqual(expect.objectContaining({ visible: false, canSubmit: false }))
    }
  })

  it('creates immutable terminal intent and reconciles only the exact target and owner', async () => {
    const notMatch = jest.fn().mockReturnThis()
    const createDoc = jest.fn().mockResolvedValue('request-id')
    const commit = jest.fn().mockResolvedValue({ result: true, time: 3, serverTime: 2 })
    const apply = jest.fn().mockReturnValue({ notMatch, createDoc, commit })
    const target = issue('ndax:status:support:WaitingOnCustomer', 'person-1' as Ref<Person>)
    const result = await submitTerminalSupportActionRequest(
      { apply } as any,
      'ndax:support:projection:internal' as Ref<ConversationProjectionSpace>,
      target,
      'account-1' as AccountUuid,
      'person-1' as Ref<Person>,
      'resolve_case',
      'ndax:status:support:Resolved' as Ref<IssueStatus>,
      'customer_confirmed',
      '  Customer replied. \r\n',
      {
        canManageSupportActions: true,
        canReopenCase: false,
        assigneeInActiveRoster: true,
        liveSessionConfirmed: false,
        hasCurrentProjectionProof: true,
        projectionOwnerMatchesAssignee: true
      }
    )

    expect(apply).toHaveBeenCalledWith(result.requestId, 'customer-success-resolve-case')
    expect(notMatch).toHaveBeenCalledWith(customerSuccess.class.SupportActionRequest, { _id: result.requestId })
    const request = createDoc.mock.calls[0][2]
    expect(request).toEqual(
      expect.objectContaining({
        action: 'resolve_case',
        requestedAssignee: 'person-1',
        requestedStatus: 'ndax:status:support:Resolved',
        expectedStatus: 'ndax:status:support:WaitingOnCustomer',
        expectedAssignee: 'person-1',
        reasonCode: 'customer_confirmed',
        reasonDetail: 'Customer replied.',
        state: 'pending',
        idempotencyKey: result.requestId,
        schemaVersion: 1
      })
    )
    for (const forbidden of ['actor', 'role', 'approval', 'processedAt', 'commitMarker', 'auditIdentity']) {
      expect(request).not.toHaveProperty(forbidden)
    }

    const succeeded = actionRequest({
      ...request,
      _id: result.requestId,
      requestedStatus: 'ndax:status:support:Resolved' as Ref<IssueStatus>,
      state: 'succeeded'
    })
    expect(
      selectHydratedSupportActionRequestId(
        [succeeded],
        issue('ndax:status:support:Resolved', 'person-1' as Ref<Person>, 101)
      )
    ).toBe(result.requestId)
    const reconciledIssue = issue('ndax:status:support:Resolved', 'person-1' as Ref<Person>, 101)
    expect(
      resolveTerminalActionControlState(
        reconciledIssue,
        resolveTakeoverChromeState(reconciledIssue),
        succeeded,
        'person-1' as Ref<Person>,
        true,
        false,
        true,
        false
      )
    ).toEqual(expect.objectContaining({ reconciled: true, awaitingReconciliation: false, canSubmit: false }))
    expect(
      selectHydratedSupportActionRequestId(
        [succeeded],
        issue('ndax:status:support:Resolved', 'person-2' as Ref<Person>, 101)
      )
    ).toBeUndefined()
    expect(
      selectHydratedSupportActionRequestId(
        [{ ...succeeded, state: 'failed' }],
        issue('ndax:status:support:WaitingOnCustomer', 'person-1' as Ref<Person>, 101)
      )
    ).toBeUndefined()
  })

  it('allows terminal retry only after the operator changes reason or the issue snapshot advances', () => {
    const owner = 'person-1' as Ref<Person>
    const target = issue('ndax:status:support:WaitingOnCustomer', owner)
    const failed = actionRequest({
      action: 'resolve_case',
      requestedAssignee: owner,
      requestedStatus: 'ndax:status:support:Resolved' as Ref<IssueStatus>,
      expectedStatus: target.status,
      expectedAssignee: owner,
      reasonCode: 'customer_confirmed',
      state: 'failed'
    })

    expect(
      resolveTerminalActionControlState(
        target,
        { ...resolveTakeoverChromeState(target), projectionCurrent: true, claimOwner: owner },
        failed,
        owner,
        true,
        false,
        true,
        false
      )
    ).toEqual(expect.objectContaining({ visible: true, canSubmit: true, requestState: 'failed' }))
  })
})
