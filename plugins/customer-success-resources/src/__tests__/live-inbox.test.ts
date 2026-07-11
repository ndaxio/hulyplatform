//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import { customerSuccessId, customerSuccessLiveInboxId, defaultSupportProjectId } from '@hcengineering/customer-success'
import type { Ref } from '@hcengineering/core'
import type { Project } from '@hcengineering/tracker'
import { accessDeniedStore } from '@hcengineering/view-resources'

import {
  buildLiveInboxQuery,
  resolveContentState,
  resolveProjectLoadState,
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

  it('queries only top-level issues in the selected support project', () => {
    const projectId = 'test:support:project' as Ref<Project>

    expect(buildLiveInboxQuery(projectId)).toEqual({
      space: projectId,
      attachedTo: 'tracker:ids:NoParent'
    })
  })

  it.each([
    [true, 0, 'loading'],
    [false, 0, 'empty'],
    [false, 1, 'ready']
  ] as const)('resolves content state from loading=%s count=%s', (loading, count, expected) => {
    expect(resolveContentState(loading, count)).toBe(expected)
  })

  it('fails closed when the configured project is not visible', () => {
    expect(resolveProjectLoadState(false)).toBe('denied')
    expect(resolveProjectLoadState(true)).toBe('ready')
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
