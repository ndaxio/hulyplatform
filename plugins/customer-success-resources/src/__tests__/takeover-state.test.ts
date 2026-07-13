//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import type { ConversationProjectionSpace, LiveSessionState } from '@hcengineering/customer-success'
import type { Ref } from '@hcengineering/core'
import type { Person } from '@hcengineering/contact'
import type { Issue, IssueStatus } from '@hcengineering/tracker'

import { buildLiveSessionStateQuery, resolveTakeoverChromeState } from '../takeover-state'

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

function projection (overrides: Partial<LiveSessionState> = {}): LiveSessionState {
  return {
    _id: 'session-1' as Ref<LiveSessionState>,
    _class: 'customer-success:class:LiveSessionState' as LiveSessionState['_class'],
    space: 'ndax:support:projection:internal' as LiveSessionState['space'],
    modifiedOn: 101,
    modifiedBy: 'account-1' as LiveSessionState['modifiedBy'],
    issueId: 'issue-1' as Ref<Issue>,
    conversationId: 'conversation-1',
    stage: 'takeover_requested',
    claimOwner: 'person-1' as Ref<Person>,
    pendingAcknowledgement: true,
    acknowledged: false,
    requestedAt: 100,
    expiresAt: 200,
    expired: false,
    recoveryState: 'none',
    sourceStatus: 'ndax:status:support:TakeoverRequested' as Ref<IssueStatus>,
    observedAt: 101,
    schemaVersion: 1,
    ...overrides
  }
}

describe('Customer Success takeover chrome state', () => {
  it('subscribes only to the issue-bound schema-v1 internal projection', () => {
    expect(
      buildLiveSessionStateQuery(
        'ndax:support:projection:internal' as Ref<ConversationProjectionSpace>,
        'issue-1' as Ref<Issue>
      )
    ).toEqual({
      _id: 'ndax:support:live-session-state:issue-1',
      space: 'ndax:support:projection:internal',
      issueId: 'issue-1',
      schemaVersion: 1
    })
  })

  it.each([
    ['ndax:status:support:BotActive', 'bot_active', false, false],
    ['ndax:status:support:Shadowing', 'shadowing', false, false],
    ['ndax:status:support:TakeoverRequested', 'takeover_requested', true, false],
    ['ndax:status:support:HumanActive', 'human_active', false, false]
  ] as const)('maps authoritative status %s to %s', (status, stage, pending, confirmed) => {
    expect(resolveTakeoverChromeState(issue(status, 'person-1' as Ref<Person>))).toEqual(
      expect.objectContaining({ stage, pendingAcknowledgement: pending, confirmed })
    )
  })

  it('shows adapter expiry only when projection identity and issue truth are current', () => {
    const target = issue('ndax:status:support:TakeoverRequested', 'person-1' as Ref<Person>)
    expect(resolveTakeoverChromeState(target, projection())).toEqual(
      expect.objectContaining({ projectionCurrent: true, expiresAt: 200, expired: false })
    )
    expect(
      resolveTakeoverChromeState(target, projection({ sourceStatus: 'status:stale' as Ref<IssueStatus> }))
    ).toEqual(expect.objectContaining({ projectionCurrent: false, expiresAt: undefined, expired: false }))
    expect(resolveTakeoverChromeState(target, projection({ observedAt: 99 }))).toEqual(
      expect.objectContaining({ projectionCurrent: false, expiresAt: undefined })
    )
    expect(resolveTakeoverChromeState(target, projection({ expired: true, recoveryState: 'lock_expired' }))).toEqual(
      expect.objectContaining({ projectionCurrent: true, expired: true, recoveryState: 'lock_expired' })
    )
  })

  it('uses the system projection Person when a current legacy Issue assignee is a social identity', () => {
    const target = issue(
      'ndax:status:support:TakeoverRequested',
      'legacy-social-account' as Ref<Person>
    )

    expect(resolveTakeoverChromeState(target, projection({ claimOwner: 'person-1' as Ref<Person> }))).toEqual(
      expect.objectContaining({
        projectionCurrent: true,
        claimOwner: 'person-1',
        pendingAcknowledgement: true
      })
    )
  })

  it('never lets projection intent report a confirmed takeover before Human Active', () => {
    const state = resolveTakeoverChromeState(
      issue('ndax:status:support:TakeoverRequested', 'person-1' as Ref<Person>),
      projection({ acknowledged: true, stage: 'human_active' })
    )
    expect(state.pendingAcknowledgement).toBe(true)
    expect(state.confirmed).toBe(false)
    expect(state.stage).toBe('takeover_requested')
  })

  it('confirms Human Active only when the current adapter projection also acknowledges it', () => {
    const target = issue('ndax:status:support:HumanActive', 'person-1' as Ref<Person>)
    expect(resolveTakeoverChromeState(target)).toEqual(
      expect.objectContaining({ confirmed: false, reconciliationPending: true })
    )
    expect(
      resolveTakeoverChromeState(
        target,
        projection({
          stage: 'human_active',
          sourceStatus: 'ndax:status:support:HumanActive' as Ref<IssueStatus>,
          pendingAcknowledgement: false,
          acknowledged: true,
          requestedAt: undefined,
          expiresAt: undefined
        })
      )
    ).toEqual(expect.objectContaining({ confirmed: true, reconciliationPending: false }))
  })

  it('accepts the adapter schema when optional binding and lock timestamps are omitted', () => {
    const target = issue('ndax:status:support:TakeoverRequested', 'person-1' as Ref<Person>)
    const adapterDocument = projection({
      conversationId: undefined,
      requestedAt: undefined,
      expiresAt: undefined
    })

    expect(resolveTakeoverChromeState(target, adapterDocument)).toEqual(
      expect.objectContaining({
        projectionCurrent: true,
        pendingAcknowledgement: true,
        expiresAt: undefined,
        confirmed: false
      })
    )
  })

  it('derives the available unassigned recovery state without trusting stale projection data', () => {
    expect(resolveTakeoverChromeState(issue('ndax:status:support:TakeoverRequested'))).toEqual(
      expect.objectContaining({ recoveryState: 'unassigned', claimOwner: null, confirmed: false })
    )
  })
})
