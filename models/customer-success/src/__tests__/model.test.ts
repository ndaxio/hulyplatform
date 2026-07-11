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
  it('registers a standalone app with a single live inbox special and no mutation chrome', () => {
    const builder = {
      createDoc: jest.fn()
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
    const storageBlockMatch = workbenchSource.match(/if \(app !== undefined\) \{[\s\S]*?\n    }\n    currentQuery = loc\.query/)
    const storageBlock = storageBlockMatch?.[0] ?? ''

    expect(originalLocIndex).toBeGreaterThan(-1)
    expect(disablePanelsGuardIndex).toBeGreaterThan(originalLocIndex)
    expect(storageBranchIndex).toBeGreaterThan(originalLocIndex)
    expect(storageBranchIndex).toBeGreaterThan(disablePanelsGuardIndex)
    expect(storageBlock).toContain(
      'const storedLocation = currentApplication?.disablePanels === true ? JSON.stringify(loc) : originalLoc'
    )
    expect(storageBlock).toContain('localStorage.setItem(`${locationStorageKeyId}_${app}`, storedLocation)')
    expect(storageBlock).toContain('if (currentApplication?.disablePanels === true) {')
    expect(storageBlock).toContain('localStorage.setItem(locationStorageKeyId, storedLocation)')
    expect(storageBlock).toContain('if (loc.path[1] !== undefined) {')
    expect(storageBlock).toContain('localStorage.setItem(`${locationStorageKeyId}_${loc.path[1]}`, storedLocation)')
  })
})
