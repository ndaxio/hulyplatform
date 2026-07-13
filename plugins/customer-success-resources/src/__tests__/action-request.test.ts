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
import type { Person } from '@hcengineering/contact'
import type { Issue, IssueStatus } from '@hcengineering/tracker'

import {
  buildSupportActionRequestQuery,
  claimSelfSupportActionRequestId,
  isSupportActionRoleMember,
  resolveClaimSelfControlState,
  shouldReleaseActiveSupportActionRequest,
  submitClaimSelfSupportActionRequest
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

  return space as WithLookup<ConversationProjectionSpace> & RolesAssignment
}

describe('Customer Success support action request helpers', () => {
  it('builds deterministic exact-id schema-v1 internal queries', () => {
    const requestId = claimSelfSupportActionRequestId('issue-1' as Ref<Issue>, 'account-1' as AccountUuid, 100)

    expect(requestId).toBe('ndax:support:action-request:issue-1:account-1:claim_self:100')
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
    expect(commit).toHaveBeenCalled()
  })

  it('shows claim-self only to support agents and leads, not compliance-only viewers', () => {
    const hierarchy = {
      as: jest.fn((_space, _targetClass) => ({
        [customerSuccess.role.SupportAgent]: [],
        [customerSuccess.role.SupportLead]: ['lead-account'],
        [customerSuccess.role.Compliance]: ['compliance-account']
      }))
    }

    const space = projectionSpace()

    expect(isSupportActionRoleMember(space, hierarchy as any, 'lead-account' as AccountUuid)).toBe(true)
    expect(isSupportActionRoleMember(space, hierarchy as any, 'compliance-account' as AccountUuid)).toBe(false)
    expect(isSupportActionRoleMember(space, hierarchy as any, 'other-account' as AccountUuid)).toBe(false)
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

  it('releases failed and superseded requests only after the issue advances to a new snapshot', () => {
    for (const state of ['failed', 'superseded'] as const) {
      expect(shouldReleaseActiveSupportActionRequest(actionRequest({ state }), 100)).toBe(false)
      expect(shouldReleaseActiveSupportActionRequest(actionRequest({ state }), 101)).toBe(true)
    }
    expect(shouldReleaseActiveSupportActionRequest(actionRequest({ state: 'processing' }), 101)).toBe(false)
    expect(shouldReleaseActiveSupportActionRequest(undefined, 101)).toBe(false)
  })
})
