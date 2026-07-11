//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import { AccountRole, SortingOrder } from '@hcengineering/core'
import customerSuccess, { customerSuccessId, customerSuccessLiveInboxId } from '@hcengineering/customer-success'
import inbox from '@hcengineering/inbox'
import { type Builder } from '@hcengineering/model'
import contact from '@hcengineering/model-contact'
import core from '@hcengineering/model-core'
import tracker from '@hcengineering/model-tracker'
import view from '@hcengineering/model-view'
import workbench from '@hcengineering/model-workbench'
import { type Viewlet } from '@hcengineering/view'

export { customerSuccessId, customerSuccessLiveInboxId } from '@hcengineering/customer-success'
export { customerSuccess as default }

export const liveInboxViewletConfig: Viewlet['config'] = [
  {
    key: '',
    label: tracker.string.Identifier,
    presenter: tracker.component.IssuePresenter,
    displayProps: { key: 'issue', fixed: 'left' }
  },
  {
    key: '',
    label: customerSuccess.string.TakeoverState,
    presenter: tracker.component.StatusPresenter,
    props: { kind: 'list', size: 'small' },
    displayProps: { key: 'status' }
  },
  {
    key: '',
    label: tracker.string.Title,
    presenter: tracker.component.TitlePresenter,
    props: { grow: true, minWidth: '12rem' },
    displayProps: { key: 'title', grow: true }
  },
  {
    key: 'dueDate',
    label: customerSuccess.string.SlaDue,
    presenter: tracker.component.DueDatePresenter,
    props: { kind: 'list' },
    displayProps: { key: 'dueDate', compression: true }
  },
  {
    key: 'modifiedOn',
    label: customerSuccess.string.LastActivity,
    presenter: tracker.component.ModificationDatePresenter,
    displayProps: { key: 'modified', fixed: 'left', dividerBefore: true }
  },
  {
    key: 'assignee',
    presenter: contact.component.PersonPresenter,
    props: { size: 'x-small', shouldShowName: true },
    displayProps: { key: 'assignee', fixed: 'right' }
  }
]

export function createModel (builder: Builder): void {
  builder.createDoc(
    workbench.class.Application,
    core.space.Model,
    {
      label: customerSuccess.string.CustomerSuccess,
      icon: inbox.icon.Inbox,
      alias: customerSuccessId,
      hidden: false,
      accessLevel: AccountRole.User,
      locationResolver: customerSuccess.resolver.Location,
      disablePanels: true,
      navigatorModel: {
        spaces: [],
        hideSavedViews: true,
        specials: [
          {
            id: customerSuccessLiveInboxId,
            label: customerSuccess.string.LiveInbox,
            icon: inbox.icon.Inbox,
            component: customerSuccess.component.LiveInbox,
            position: 'top',
            accessLevel: AccountRole.User
          }
        ]
      }
    },
    customerSuccess.app.CustomerSuccess
  )

  builder.createDoc(
    view.class.Viewlet,
    core.space.Model,
    {
      attachTo: tracker.class.Issue,
      descriptor: view.viewlet.List,
      variant: 'customer-success-inbox',
      viewOptions: {
        groupBy: ['status', 'assignee', 'priority'],
        orderBy: [['modifiedOn', SortingOrder.Descending]],
        other: []
      },
      configOptions: {
        strict: true,
        hiddenKeys: [
          'description',
          'relations',
          'reportedTime',
          'reports',
          'component',
          'milestone',
          'estimation',
          'remainingTime',
          'attachedTo',
          'createdBy',
          'modifiedBy'
        ]
      },
      config: liveInboxViewletConfig
    },
    customerSuccess.viewlet.LiveInbox
  )
}
