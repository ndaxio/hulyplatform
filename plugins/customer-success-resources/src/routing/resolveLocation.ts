//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import { customerSuccessId, customerSuccessLiveInboxId } from '@hcengineering/customer-success'
import type { Location, ResolvedLocation } from '@hcengineering/ui'
import { accessDeniedStore } from '@hcengineering/view-resources'

export function isIssueIdentifier (value: string | undefined): value is string {
  return value !== undefined && /^\S+-\d+$/.test(value)
}

export function buildLiveInboxResolvedLocation (location: Location): ResolvedLocation {
  const appComponent = location.path[0] ?? ''
  const workspace = location.path[1] ?? ''

  return {
    loc: {
      path: [appComponent, workspace]
    },
    defaultLocation: {
      path: [appComponent, workspace, customerSuccessId, customerSuccessLiveInboxId]
    }
  }
}

function denyLocation (location: Location, message: string): ResolvedLocation {
  accessDeniedStore.set(true)
  console.error(message)
  const resolved = buildLiveInboxResolvedLocation(location)
  resolved.loc.fragment = ''
  return resolved
}

export async function resolveLocation (location: Location): Promise<ResolvedLocation | undefined> {
  if (location.path[2] !== customerSuccessId) {
    return undefined
  }

  const target = location.path[3]
  if (target === undefined || target === '' || target === customerSuccessLiveInboxId) {
    return buildLiveInboxResolvedLocation(location)
  }

  if (!isIssueIdentifier(target)) {
    return buildLiveInboxResolvedLocation(location)
  }

  return denyLocation(location, 'Customer success issue detail is disabled in the read-only inbox tracer.')
}
