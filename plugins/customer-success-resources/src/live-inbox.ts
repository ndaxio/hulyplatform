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
import tracker, { type Issue, type Project } from '@hcengineering/tracker'

export type LiveInboxContentState = 'loading' | 'empty' | 'ready'

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

export function buildLiveInboxQuery (projectId: Ref<Project>): DocumentQuery<Issue> {
  return {
    space: projectId,
    attachedTo: tracker.ids.NoParent
  }
}

export function resolveProjectLoadState (projectFound: boolean): 'ready' | 'denied' {
  return projectFound ? 'ready' : 'denied'
}

export function resolveContentState (loading: boolean, count: number): LiveInboxContentState {
  if (loading) return 'loading'
  return count === 0 ? 'empty' : 'ready'
}
