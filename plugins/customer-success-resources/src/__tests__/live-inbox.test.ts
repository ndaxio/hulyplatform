//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import {
  customerSuccessId,
  customerSuccessLiveInboxId,
  defaultInternalProjectionSpaceId,
  defaultPublicProjectionSpaceId,
  defaultRestrictedProjectionSpaceId,
  defaultSupportProjectId
} from '@hcengineering/customer-success'
import type { Ref } from '@hcengineering/core'
import type { Person } from '@hcengineering/contact'
import type { Project } from '@hcengineering/tracker'
import { accessDeniedStore } from '@hcengineering/view-resources'

import {
  buildLiveInboxQuery,
  buildLiveInboxNavigationQuery,
  liveInboxQueueViews,
  nextLiveInboxQueueView,
  normalizeLiveInboxSearch,
  resolveContentState,
  resolveProjectionSpaceIds,
  resolveProjectLoadState,
  resolveLiveInboxRefreshState,
  resolveLiveInboxLocationState,
  resolveSupportProjectId
} from '../live-inbox'
import { buildLiveInboxResolvedLocation, resolveLocation } from '../routing/resolveLocation'

jest.mock('@hcengineering/view-resources', () => ({
  accessDeniedStore: {
    set: jest.fn()
  }
}))

describe('Customer Success live inbox', () => {
  const mockAccessDeniedSet = accessDeniedStore.set as jest.Mock
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    consoleError.mockRestore()
  })

  it('uses the deterministic support project when no deployment override exists', () => {
    expect(resolveSupportProjectId(undefined)).toBe(defaultSupportProjectId)
  })

  it('uses the deployment-specific support project override', () => {
    const projectId = 'test:support:project' as Ref<Project>

    expect(resolveSupportProjectId(projectId)).toBe(projectId)
  })

  it('resolves each projection lane independently with deterministic defaults', () => {
    expect(resolveProjectionSpaceIds({ internal: 'test:projection:internal' as any })).toEqual({
      public: defaultPublicProjectionSpaceId,
      internal: 'test:projection:internal',
      restricted: defaultRestrictedProjectionSpaceId
    })
    expect(resolveProjectionSpaceIds({})).toEqual({
      public: defaultPublicProjectionSpaceId,
      internal: defaultInternalProjectionSpaceId,
      restricted: defaultRestrictedProjectionSpaceId
    })
  })

  it('queries only top-level issues in the selected support project', () => {
    const projectId = 'test:support:project' as Ref<Project>

    expect(buildLiveInboxQuery(projectId)).toEqual({
      space: projectId,
      attachedTo: 'tracker:ids:NoParent'
    })
  })

  it('provides every required production queue view plus an all-tickets view', () => {
    expect(liveInboxQueueViews).toEqual([
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
    ])
  })

  it.each([
    ['bot-active', { status: { $in: ['ndax:status:support:BotActive'] } }],
    ['takeover-requested', { status: { $in: ['ndax:status:support:TakeoverRequested'] } }],
    ['customer-waiting', { status: { $in: ['ndax:status:support:WaitingOnCustomer'] } }],
    ['human-active', { status: { $in: ['ndax:status:support:HumanActive'] } }],
    ['escalated', { status: { $in: ['ndax:status:support:Escalated'] } }],
    ['resolved', { status: { $in: ['ndax:status:support:Resolved', 'ndax:status:support:Closed'] } }]
  ] as const)('builds the indexed status query for %s', (view, expected) => {
    expect(buildLiveInboxQuery('test:support:project' as Ref<Project>, view)).toEqual({
      space: 'test:support:project',
      attachedTo: 'tracker:ids:NoParent',
      ...expected
    })
  })

  it('builds bounded unassigned, mine, and SLA-risk queries without client-side filtering', () => {
    const projectId = 'test:support:project' as Ref<Project>
    const me = 'contact:person:me' as Ref<Person>
    const terminal = ['ndax:status:support:Resolved', 'ndax:status:support:Closed']

    expect(buildLiveInboxQuery(projectId, 'unassigned')).toEqual({
      space: projectId,
      attachedTo: 'tracker:ids:NoParent',
      assignee: { $in: [null] },
      status: { $nin: terminal }
    })
    expect(buildLiveInboxQuery(projectId, 'mine', { currentEmployee: me })).toEqual({
      space: projectId,
      attachedTo: 'tracker:ids:NoParent',
      assignee: { $in: [me] },
      status: { $nin: terminal }
    })
    expect(buildLiveInboxQuery(projectId, 'mine')).toEqual({
      space: projectId,
      attachedTo: 'tracker:ids:NoParent',
      _id: { $in: [] }
    })
    expect(buildLiveInboxQuery(projectId, 'sla-risk', { now: 1_800_000_000_000 })).toEqual({
      space: projectId,
      attachedTo: 'tracker:ids:NoParent',
      dueDate: { $gt: 0, $lte: 1_800_000_000_000 },
      status: { $nin: terminal }
    })
  })

  it('moves queue focus with arrows and boundaries without reacting to unrelated keys', () => {
    expect(nextLiveInboxQueueView('all', 'ArrowRight')).toBe('bot-active')
    expect(nextLiveInboxQueueView('all', 'ArrowLeft')).toBe('resolved')
    expect(nextLiveInboxQueueView('resolved', 'ArrowRight')).toBe('all')
    expect(nextLiveInboxQueueView('mine', 'Home')).toBe('all')
    expect(nextLiveInboxQueueView('mine', 'End')).toBe('resolved')
    expect(nextLiveInboxQueueView('mine', 'Enter')).toBeUndefined()
  })

  it('uses filter-compatible operator objects for every constrained reference field', () => {
    expect(buildLiveInboxQuery('test:support:project' as Ref<Project>, 'bot-active').status).toEqual({
      $in: ['ndax:status:support:BotActive']
    })
    expect(buildLiveInboxQuery('test:support:project' as Ref<Project>, 'unassigned').assignee).toEqual({
      $in: [null]
    })
    expect(
      buildLiveInboxQuery('test:support:project' as Ref<Project>, 'mine', {
        currentEmployee: 'contact:person:me' as Ref<Person>
      }).assignee
    ).toEqual({ $in: ['contact:person:me'] })
  })

  it('normalizes bounded full-text search and rejects untrusted queue state', () => {
    expect(normalizeLiveInboxSearch('  withdrawal   pending  ')).toBe('withdrawal pending')
    expect(normalizeLiveInboxSearch('x'.repeat(250))).toHaveLength(200)
    expect(resolveLiveInboxLocationState({ view: 'not-a-view', search: '  case  ' })).toEqual({
      view: 'all',
      search: 'case'
    })
    expect(buildLiveInboxQuery('test:support:project' as Ref<Project>, 'all', { search: '  withdrawal  ' })).toEqual({
      space: 'test:support:project',
      attachedTo: 'tracker:ids:NoParent',
      $search: 'withdrawal'
    })
  })

  it('persists queue and search while preserving the selected ticket', () => {
    expect(
      buildLiveInboxNavigationQuery(
        { issue: 'CSI-42', view: 'all', search: 'old' },
        'takeover-requested',
        '  urgent withdrawal '
      )
    ).toEqual({
      issue: 'CSI-42',
      view: 'takeover-requested',
      search: 'urgent withdrawal'
    })
    expect(buildLiveInboxNavigationQuery({ issue: 'CSI-42' }, 'mine', '   ')).toEqual({
      issue: 'CSI-42',
      view: 'mine'
    })
  })

  it.each([
    [true, 0, 'loading'],
    [false, 0, 'empty'],
    [false, 1, 'ready']
  ] as const)('resolves content state from loading=%s count=%s', (loading, count, expected) => {
    expect(resolveContentState(loading, count)).toBe(expected)
  })

  it('keeps queue content hidden until persisted filters are merged', () => {
    expect(resolveContentState(false, 12, false)).toBe('loading')
    expect(resolveContentState(false, 0, false)).toBe('loading')
    expect(resolveContentState(false, 12, true)).toBe('ready')
  })

  it('fails closed when the configured project is not visible', () => {
    expect(resolveProjectLoadState(false)).toBe('denied')
    expect(resolveProjectLoadState(true)).toBe('ready')
  })

  it('keeps last-good queue data visible and marks a transient refresh failure', () => {
    const current = { _id: 'project:support', name: 'Customer Success' } as any

    expect(resolveLiveInboxRefreshState(current, undefined, true)).toEqual({
      state: 'ready',
      project: current,
      refreshFailed: true
    })
  })

  it('fails closed when a successful refresh proves project access was revoked', () => {
    const current = { _id: 'project:support', name: 'Customer Success' } as any

    expect(resolveLiveInboxRefreshState(current, undefined, false)).toEqual({
      state: 'denied',
      project: undefined,
      refreshFailed: false
    })
  })

  it('resolves the standalone customer success app root to the live inbox special', () => {
    expect(
      buildLiveInboxResolvedLocation({
        path: ['workbench', 'workspace-1', customerSuccessId]
      })
    ).toEqual({
      loc: {
        path: ['workbench', 'workspace-1']
      },
      defaultLocation: {
        path: ['workbench', 'workspace-1', customerSuccessId, customerSuccessLiveInboxId]
      }
    })
  })

  it('redirects unknown customer success routes back to the live inbox', async () => {
    expect(
      await resolveLocation({
        path: ['workbench', 'workspace-1', customerSuccessId, 'unexpected']
      })
    ).toEqual({
      loc: {
        path: ['workbench', 'workspace-1']
      },
      defaultLocation: {
        path: ['workbench', 'workspace-1', customerSuccessId, customerSuccessLiveInboxId]
      }
    })
  })

  it.each(['SUP-42', 'CS-1', 'LIVE-999999'])(
    'denies every issue deep-link until the read-only detail milestone is implemented (%s)',
    async (issueId) => {
      await expect(
        resolveLocation({
          path: ['workbench', 'workspace-1', customerSuccessId, issueId],
          fragment: 'tracker:component:EditIssue|issue-1|tracker:class:Issue|content'
        })
      ).resolves.toEqual({
        loc: {
          path: ['workbench', 'workspace-1'],
          fragment: ''
        },
        defaultLocation: {
          path: ['workbench', 'workspace-1', customerSuccessId, customerSuccessLiveInboxId]
        }
      })

      expect(mockAccessDeniedSet).toHaveBeenCalledWith(true)
      expect(consoleError).toHaveBeenCalledWith(
        'Customer success issue detail is disabled in the read-only inbox tracer.'
      )
    }
  )

  it('clears denied short-link fragments instead of reflecting attacker-controlled payloads', async () => {
    const fragment = 'javascript:alert(1)|<img src=x onerror=alert(1)>|tracker:class:Issue|content'

    await expect(
      resolveLocation({
        path: ['workbench', 'workspace-1', customerSuccessId, 'SUP-42'],
        fragment
      })
    ).resolves.toEqual({
      loc: {
        path: ['workbench', 'workspace-1'],
        fragment: ''
      },
      defaultLocation: {
        path: ['workbench', 'workspace-1', customerSuccessId, customerSuccessLiveInboxId]
      }
    })

    expect(mockAccessDeniedSet).toHaveBeenCalledWith(true)
    expect(consoleError).toHaveBeenCalledWith(
      'Customer success issue detail is disabled in the read-only inbox tracer.'
    )
  })

  it.each([
    'tracker:component:EditIssue|issue-1|tracker:class:Issue|content',
    'javascript:alert(1)|<img src=x onerror=alert(1)>|tracker:class:Issue|content'
  ])('always resolves denied issue detail fragments to a blank fragment (%s)', async (fragment) => {
    const resolved = await resolveLocation({
      path: ['workbench', 'workspace-1', customerSuccessId, 'SUP-42'],
      fragment
    })

    expect(resolved).toEqual(
      expect.objectContaining({
        loc: expect.objectContaining({
          path: ['workbench', 'workspace-1'],
          fragment: ''
        }),
        defaultLocation: {
          path: ['workbench', 'workspace-1', customerSuccessId, customerSuccessLiveInboxId]
        }
      })
    )
  })
})
