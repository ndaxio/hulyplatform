//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import core, {
  AccountRole,
  MeasureMetricsContext,
  type Account,
  type Class,
  type Doc,
  type MeasureContext,
  type Permission,
  type PersonId,
  type Ref,
  type SessionData,
  type Space,
  type TxUpdateDoc
} from '@hcengineering/core'
import type { PipelineContext } from '@hcengineering/server-core'

import { SpacePermissionsMiddleware } from '../spacePermissions'

const projectionClass = 'customer-success:class:ConversationProjectionSpace' as Ref<Class<Doc>>
const projectionSpace = 'ndax:support:projection:restricted' as Ref<Space>

function makeAccount (primarySocialId: PersonId): Account {
  return {
    uuid: 'test-account' as any,
    role: AccountRole.Admin,
    primarySocialId,
    socialIds: [primarySocialId],
    fullSocialIds: []
  }
}

function makeContext (account: Account): MeasureContext<SessionData> {
  const context = new MeasureMetricsContext('test', {}) as MeasureContext<SessionData>
  context.contextData = {
    account,
    broadcast: { txes: [], queue: [], sessions: {} }
  } as any
  return context
}

function makeMiddleware (): SpacePermissionsMiddleware {
  const permission = {
    _id: 'customer-success:permission:ForbidUpdateProjectionSpace',
    _class: core.class.Permission,
    space: core.space.Model,
    txClass: core.class.TxUpdateDoc,
    objectClass: projectionClass,
    scope: 'space',
    forbid: true
  } as unknown as Permission
  const context = {
    hierarchy: {
      getAncestors: (value: Ref<Class<Doc>>) => [value],
      isDerived: (value: Ref<Class<Doc>>, target: Ref<Class<Doc>>) => value === target
    },
    modelDb: {
      findAllSync: (_class: Ref<Class<Doc>>) => (_class === core.class.Permission ? [permission] : [])
    }
  } as unknown as PipelineContext
  const middleware = new (SpacePermissionsMiddleware as any)(context, undefined) as SpacePermissionsMiddleware
  ;(middleware as any).restrictedSpaces.add(projectionSpace)
  ;(middleware as any).permissionsBySpace[projectionSpace] = {}
  return middleware
}

function projectionUpdate (): TxUpdateDoc<Doc> {
  return {
    _class: core.class.TxUpdateDoc,
    objectClass: projectionClass,
    objectId: projectionSpace,
    objectSpace: core.space.Space,
    operations: { restricted: false }
  } as unknown as TxUpdateDoc<Doc>
}

describe('SpacePermissionsMiddleware restricted space mutation', () => {
  it('denies an unassigned non-system administrator when a matching space permission exists', () => {
    const middleware = makeMiddleware()
    const allowed = (middleware as any).checkPermission(
      makeContext(makeAccount('test:account:Human' as PersonId)),
      projectionSpace,
      projectionUpdate(),
      true
    )

    expect(allowed).toBe(false)
  })

  it('keeps the explicit system-account bypass for the trusted projection writer', () => {
    const middleware = makeMiddleware()
    const allowed = (middleware as any).checkPermission(
      makeContext(makeAccount(core.account.System)),
      projectionSpace,
      projectionUpdate(),
      true
    )

    expect(allowed).toBe(true)
  })
})
