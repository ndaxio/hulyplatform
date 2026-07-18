//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { AccountRole } from '@hcengineering/core'
import customerSuccess from '@hcengineering/customer-success'
import tracker from '@hcengineering/model-tracker'
import workbench from '@hcengineering/model-workbench'

import { createModel, customerSuccessId, customerSuccessLiveInboxId, liveInboxViewletConfig } from '..'

describe('Customer Success inbox viewlet', () => {
  it('maps workflow status to handoff state and due date to SLA', () => {
    expect(liveInboxViewletConfig).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: customerSuccess.string.TakeoverState,
          presenter: tracker.component.StatusPresenter,
          displayProps: expect.objectContaining({ key: 'status' })
        }),
        expect.objectContaining({
          key: 'dueDate',
          label: customerSuccess.string.SlaDue,
          presenter: tracker.component.DueDatePresenter
        }),
        expect.objectContaining({
          key: 'modifiedOn',
          label: customerSuccess.string.LastActivity,
          presenter: tracker.component.ModificationDatePresenter
        })
      ])
    )
  })

  it('uses presenters instead of ticket mutation editors', () => {
    const presenters = liveInboxViewletConfig
      .filter((entry) => typeof entry !== 'string')
      .map((entry) => (typeof entry !== 'string' ? entry.presenter : undefined))

    expect(presenters).not.toContain(tracker.component.PriorityEditor)
    expect(presenters).not.toContain(tracker.component.StatusEditor)
    expect(presenters).toContain(customerSuccess.component.TicketPresenter)
    expect(presenters).not.toContain(tracker.component.IssuePresenter)
    expect(presenters).not.toContain(tracker.component.TitlePresenter)

    const ticketPresenters = liveInboxViewletConfig.filter(
      (entry) => typeof entry !== 'string' && entry.presenter === customerSuccess.component.TicketPresenter
    )
    expect(ticketPresenters).toHaveLength(2)
    expect(ticketPresenters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ props: expect.objectContaining({ field: 'identifier', interactive: false }) }),
        expect.objectContaining({ props: expect.objectContaining({ field: 'title' }) })
      ])
    )
  })
})

describe('Customer Success application model', () => {
  it('registers projection documents and keeps support action requests human-creatable but human-immutable', () => {
    const builder = {
      createDoc: jest.fn(),
      createModel: jest.fn(),
      mixin: jest.fn()
    }

    createModel(builder as any)

    expect(builder.createModel).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function)
    )
    expect(builder.createModel.mock.calls.flat().some((model) => model.name === 'TConversationEvent')).toBe(true)
    expect(builder.createModel.mock.calls.flat().some((model) => model.name === 'TConversationBinding')).toBe(true)
    expect(builder.createModel.mock.calls.flat().some((model) => model.name === 'TSupportActionRequest')).toBe(true)
    expect(builder.createModel.mock.calls.flat().some((model) => model.name === 'TLiveSessionState')).toBe(true)
    expect(builder.createModel.mock.calls.flat().some((model) => model.name === 'TConversationProjectionSpace')).toBe(
      true
    )
    expect(
      builder.createModel.mock.calls.flat().some((model) => model.name === 'TConversationProjectionSpaceTypeData')
    ).toBe(true)
    const modelSource = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8')
    expect(modelSource).toContain("export const DOMAIN_CUSTOMER_SUCCESS = 'customer-success' as Domain")
    expect(modelSource).toContain(
      '@Model(customerSuccess.class.ConversationEvent, core.class.Doc, DOMAIN_CUSTOMER_SUCCESS)'
    )
    expect(modelSource).toMatch(
      /@Prop\(TypeString\(\), getEmbeddedLabel\('Payload digest'\)\)[\s\S]*payloadDigest!: string/
    )
    expect(modelSource).toContain(
      '@Model(customerSuccess.class.ConversationBinding, core.class.Doc, DOMAIN_CUSTOMER_SUCCESS)'
    )
    expect(modelSource).toContain(
      '@Model(customerSuccess.class.SupportActionRequest, core.class.Doc, DOMAIN_CUSTOMER_SUCCESS)'
    )
    expect(modelSource).toContain(
      '@Model(customerSuccess.class.LiveSessionState, core.class.Doc, DOMAIN_CUSTOMER_SUCCESS)'
    )
    expect(modelSource).toMatch(/class TConversationEvent[\s\S]*?conversationId!: string/)
    expect(modelSource).toMatch(/class TConversationBinding[\s\S]*?conversationId!: string/)
    expect(modelSource).toMatch(/class TSupportActionRequest[\s\S]*?requestedAssignee\?: Ref<Person>/)
    expect(modelSource).toMatch(/class TSupportActionRequest[\s\S]*?requestedStatus\?: Ref<IssueStatus>/)
    expect(modelSource).toMatch(/class TSupportActionRequest[\s\S]*?deliveryId\?: string/)
    expect(modelSource).toMatch(/class TSupportActionRequest[\s\S]*?message\?: Markup/)
    expect(modelSource).toMatch(/class TSupportActionRequest[\s\S]*?contentDigest\?: string/)
    expect(modelSource).toMatch(/class TSupportActionRequest[\s\S]*?resultEventId\?: string/)
    expect(modelSource).toMatch(/class TSupportActionRequest[\s\S]*?reasonCode\?: SupportActionRequest\['reasonCode'\]/)
    expect(modelSource).toMatch(/class TSupportActionRequest[\s\S]*?reasonDetail\?: string/)
    expect(
      readFileSync(join(__dirname, '..', '..', '..', '..', 'plugins', 'customer-success', 'src', 'index.ts'), 'utf8')
    ).toMatch(
      /SupportActionRequestAction =[\s\S]*?'resolve_case'[\s\S]*?'reopen_case'[\s\S]*?'post_public_reply'[\s\S]*?'post_internal_note'[\s\S]*?'post_restricted_note'/
    )
    expect(modelSource).toMatch(/class TSupportActionRequest[\s\S]*?processingLeaseId\?: string/)
    expect(modelSource).toMatch(/class TSupportActionRequest[\s\S]*?processingLeaseExpiresAt\?: Timestamp/)
    expect(modelSource).toMatch(/class TLiveSessionState[\s\S]*?conversationId\?: string/)
    expect(builder.mixin).toHaveBeenCalledWith(
      'customer-success:class:ConversationEvent',
      'core:class:Class',
      'core:mixin:TxAccessLevel',
      {
        createAccessLevel: AccountRole.Admin,
        updateAccessLevel: AccountRole.Admin,
        removeAccessLevel: AccountRole.Admin
      }
    )
    expect(builder.mixin).toHaveBeenCalledWith(
      'customer-success:class:ConversationBinding',
      'core:class:Class',
      'core:mixin:TxAccessLevel',
      {
        createAccessLevel: AccountRole.Admin,
        updateAccessLevel: AccountRole.Admin,
        removeAccessLevel: AccountRole.Admin
      }
    )
    expect(builder.mixin).toHaveBeenCalledWith(
      'customer-success:class:SupportActionRequest',
      'core:class:Class',
      'core:mixin:TxAccessLevel',
      {
        createAccessLevel: AccountRole.User,
        updateAccessLevel: AccountRole.Admin,
        removeAccessLevel: AccountRole.Admin
      }
    )
    expect(builder.mixin).toHaveBeenCalledWith(
      'customer-success:class:LiveSessionState',
      'core:class:Class',
      'core:mixin:TxAccessLevel',
      {
        createAccessLevel: AccountRole.Admin,
        updateAccessLevel: AccountRole.Admin,
        removeAccessLevel: AccountRole.Admin
      }
    )

    const permissionCalls = builder.createDoc.mock.calls.filter(([docClass]) => docClass === 'core:class:Permission')
    expect(permissionCalls).toHaveLength(14)
    expect(permissionCalls.every(([, , permission]) => permission.forbid === true)).toBe(true)
    expect(permissionCalls.every(([, , permission]) => permission.scope === 'space')).toBe(true)
    expect(new Set(permissionCalls.map(([, , permission]) => permission.txClass))).toEqual(
      new Set(['core:class:TxCreateDoc', 'core:class:TxUpdateDoc', 'core:class:TxRemoveDoc'])
    )
    expect(new Set(permissionCalls.map(([, , permission]) => permission.objectClass))).toEqual(
      new Set([
        'customer-success:class:ConversationEvent',
        'customer-success:class:ConversationBinding',
        'customer-success:class:SupportActionRequest',
        'customer-success:class:LiveSessionState',
        'customer-success:class:ConversationProjectionSpace',
        'customer-success:mixin:ConversationProjectionSpaceTypeData'
      ])
    )

    const descriptorCall = builder.createDoc.mock.calls.find(
      ([docClass, , , docId]) =>
        docClass === 'core:class:SpaceTypeDescriptor' &&
        docId === 'customer-success:descriptor:ConversationProjectionSpace'
    )
    expect(descriptorCall?.[2]).toEqual(
      expect.objectContaining({
        baseClass: 'customer-success:class:ConversationProjectionSpace',
        system: true,
        availablePermissions: expect.arrayContaining(permissionCalls.map(([, , , permissionId]) => permissionId))
      })
    )

    const spaceTypeCall = builder.createDoc.mock.calls.find(
      ([docClass, , , docId]) =>
        docClass === 'core:class:SpaceType' && docId === 'customer-success:spaceType:ConversationProjection'
    )
    expect(spaceTypeCall?.[2]).toEqual(
      expect.objectContaining({
        roles: 3,
        targetClass: 'customer-success:mixin:ConversationProjectionSpaceTypeData'
      })
    )

    const roleCalls = builder.createDoc.mock.calls.filter(
      ([docClass, , role]) =>
        docClass === 'core:class:Role' && role.attachedTo === 'customer-success:spaceType:ConversationProjection'
    )
    expect(roleCalls).toHaveLength(3)
    expect(roleCalls.every(([, , role]) => role.permissions.length === 14)).toBe(true)
  })

  it('pins the system-only bypass in native restricted-space enforcement', () => {
    const middlewareSource = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'foundations',
        'server',
        'packages',
        'middleware',
        'src',
        'spacePermissions.ts'
      ),
      'utf8'
    )

    expect(middlewareSource).toContain('if (account.primarySocialId === core.account.System) return true')
    expect(middlewareSource).toContain('if (space.restricted === true)')
    expect(middlewareSource).toContain('if (!this.restrictedSpaces.has(space))')
    expect(middlewareSource).not.toContain('if (isSpace || !this.restrictedSpaces.has(space))')
    expect(middlewareSource).toMatch(/permission\.forbid !== undefined \? !permission\.forbid : true/)
  })

  it('wires optional production metadata overrides for every projection lane', () => {
    const productionSource = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'dev', 'prod', 'src', 'platform.ts'),
      'utf8'
    )

    for (const key of [
      'CUSTOMER_SUCCESS_PUBLIC_PROJECTION_SPACE_ID',
      'CUSTOMER_SUCCESS_INTERNAL_PROJECTION_SPACE_ID',
      'CUSTOMER_SUCCESS_RESTRICTED_PROJECTION_SPACE_ID'
    ]) {
      expect(productionSource).toContain(key)
    }
    expect(productionSource).toContain('customerSuccess.metadata.PublicProjectionSpaceId')
    expect(productionSource).toContain('customerSuccess.metadata.InternalProjectionSpaceId')
    expect(productionSource).toContain('customerSuccess.metadata.RestrictedProjectionSpaceId')
  })

  it('registers a standalone app with a single live inbox special and no mutation chrome', () => {
    const builder = {
      createDoc: jest.fn(),
      createModel: jest.fn(),
      mixin: jest.fn()
    }

    createModel(builder as any)

    const applicationCall = builder.createDoc.mock.calls.find(
      ([docClass, _space, _data, docId]) =>
        docClass === workbench.class.Application && docId === customerSuccess.app.CustomerSuccess
    )

    expect(applicationCall).toBeDefined()
    expect(builder.createDoc.mock.calls.some(([docClass]) => docClass === workbench.class.ApplicationNavModel)).toBe(
      false
    )

    const [, , application] = applicationCall as [string, string, Record<string, any>, string]

    expect(application).toEqual(
      expect.objectContaining({
        label: customerSuccess.string.CustomerSuccess,
        alias: customerSuccessId,
        hidden: false,
        accessLevel: AccountRole.User,
        locationResolver: customerSuccess.resolver.Location,
        disablePanels: true,
        navigatorModel: {
          spaces: [],
          hideSavedViews: true,
          specials: [
            expect.objectContaining({
              id: customerSuccessLiveInboxId,
              label: customerSuccess.string.LiveInbox,
              component: customerSuccess.component.LiveInbox,
              accessLevel: AccountRole.User
            })
          ]
        }
      })
    )

    expect(application).not.toHaveProperty('component')
    expect(application).not.toHaveProperty('navHeaderComponent')
    expect(application).not.toHaveProperty('navHeaderActions')
    expect(application.disablePanels).toBe(true)
    expect(application.navigatorModel.spaces).toEqual([])
    expect(application.navigatorModel.hideSavedViews).toBe(true)
    expect(application.navigatorModel.specials).toHaveLength(1)
    expect(application.navigatorModel.specials[0]).not.toHaveProperty('createComponent')
    expect(application.navigatorModel.specials[0]).not.toHaveProperty('createLabel')
  })

  it('declares and enforces the read-only workbench shell contracts', () => {
    const workbenchTypesSource = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'plugins', 'workbench', 'src', 'types.ts'),
      'utf8'
    )
    const navigatorSource = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'plugins',
        'workbench-resources',
        'src',
        'components',
        'Navigator.svelte'
      ),
      'utf8'
    )
    const workbenchSource = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'plugins',
        'workbench-resources',
        'src',
        'components',
        'Workbench.svelte'
      ),
      'utf8'
    )

    expect(workbenchTypesSource).toContain('hideSavedViews?: boolean')
    expect(workbenchTypesSource).toContain('disablePanels?: boolean')
    expect(navigatorSource).toMatch(/\{#if !model\.hideSavedViews\}[\s\S]*<SavedView /)
    expect(workbenchSource).toMatch(
      /currentApplication\?\.disablePanels === true[\s\S]*loc\.fragment = undefined[\s\S]*closePanel\(\)/
    )
    expect(workbenchSource).toMatch(
      /currentApplication\?\.disablePanels === true \? JSON\.stringify\(loc\) : originalLoc/
    )
  })

  it('strips malicious fragments on valid specials before the disablePanels app can persist them', () => {
    const workbenchSource = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'plugins',
        'workbench-resources',
        'src',
        'components',
        'Workbench.svelte'
      ),
      'utf8'
    )

    const specialAssignmentIndex = workbenchSource.indexOf('let special = loc.path[4]')
    const disablePanelsGuardIndex = workbenchSource.indexOf(
      'if (currentApplication?.disablePanels === true && fragment != null && fragment.trim().length > 0)'
    )
    const storageIndex = workbenchSource.indexOf(
      'currentApplication?.disablePanels === true ? JSON.stringify(loc) : originalLoc'
    )

    expect(specialAssignmentIndex).toBeGreaterThan(-1)
    expect(disablePanelsGuardIndex).toBeGreaterThan(specialAssignmentIndex)
    expect(storageIndex).toBeGreaterThan(disablePanelsGuardIndex)
    expect(workbenchSource).toContain('fragment = undefined')
    expect(workbenchSource).toContain('loc.fragment = undefined')
    expect(workbenchSource).toContain('closePanel()')
    expect(workbenchSource).toContain('if (navigate(loc)) {')
  })

  it('stores the canonical fragment-free location only for disablePanels apps and preserves originalLoc otherwise', () => {
    const workbenchSource = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'plugins',
        'workbench-resources',
        'src',
        'components',
        'Workbench.svelte'
      ),
      'utf8'
    )

    const originalLocIndex = workbenchSource.indexOf('const originalLoc = JSON.stringify(loc)')
    const disablePanelsGuardIndex = workbenchSource.indexOf(
      'if (currentApplication?.disablePanels === true && fragment != null && fragment.trim().length > 0)'
    )
    const storageBranchIndex = workbenchSource.indexOf(
      'currentApplication?.disablePanels === true ? JSON.stringify(loc) : originalLoc'
    )
    const storageBlockMatch = workbenchSource.match(
      /if \(app !== undefined\) \{[\s\S]*?\n {4}}\n {4}currentQuery = loc\.query/
    )
    const storageBlock = storageBlockMatch?.[0] ?? ''

    expect(originalLocIndex).toBeGreaterThan(-1)
    expect(disablePanelsGuardIndex).toBeGreaterThan(originalLocIndex)
    expect(storageBranchIndex).toBeGreaterThan(originalLocIndex)
    expect(storageBranchIndex).toBeGreaterThan(disablePanelsGuardIndex)
    expect(storageBlock).toContain(
      'const storedLocation = currentApplication?.disablePanels === true ? JSON.stringify(loc) : originalLoc'
    )
    expect(storageBlock).toContain('localStorage.setItem(`$' + '{locationStorageKeyId}_$' + '{app}`, storedLocation)')
    expect(storageBlock).toContain('if (currentApplication?.disablePanels === true) {')
    expect(storageBlock).toContain('localStorage.setItem(locationStorageKeyId, storedLocation)')
    expect(storageBlock).toContain('if (loc.path[1] !== undefined) {')
    expect(storageBlock).toContain(
      'localStorage.setItem(`$' + '{locationStorageKeyId}_$' + '{loc.path[1]}`, storedLocation)'
    )
  })
})
