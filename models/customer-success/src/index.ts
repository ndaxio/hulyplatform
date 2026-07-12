//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import {
  AccountRole,
  IndexKind,
  SortingOrder,
  type AccountUuid,
  type Domain,
  type Markup,
  type Ref,
  type Timestamp
} from '@hcengineering/core'
import customerSuccess, {
  type ConversationEvent,
  type ConversationEventLane,
  type ConversationEventSource,
  type ConversationEventVisibility,
  customerSuccessId,
  customerSuccessLiveInboxId
} from '@hcengineering/customer-success'
import inbox from '@hcengineering/inbox'
import {
  type Builder,
  Index,
  Model,
  Prop,
  TypeAccountUuid,
  TypeMarkup,
  TypeNumber,
  TypeRef,
  TypeString,
  TypeTimestamp
} from '@hcengineering/model'
import contact from '@hcengineering/model-contact'
import core, { TDoc } from '@hcengineering/model-core'
import tracker from '@hcengineering/model-tracker'
import view from '@hcengineering/model-view'
import workbench from '@hcengineering/model-workbench'
import { getEmbeddedLabel } from '@hcengineering/platform'
import { type Issue } from '@hcengineering/tracker'
import { type Viewlet } from '@hcengineering/view'

export { customerSuccessId, customerSuccessLiveInboxId } from '@hcengineering/customer-success'
export { customerSuccess as default }

export const DOMAIN_CUSTOMER_SUCCESS = 'customer-success' as Domain

@Model(customerSuccess.class.ConversationEvent, core.class.Doc, DOMAIN_CUSTOMER_SUCCESS)
export class TConversationEvent extends TDoc implements ConversationEvent {
  @Prop(TypeRef(tracker.class.Issue), getEmbeddedLabel('Issue id'))
  @Index(IndexKind.Indexed)
    issueId!: Ref<Issue>

  @Prop(TypeString(), getEmbeddedLabel('Conversation id'))
  @Index(IndexKind.Indexed)
    conversationId!: string

  @Prop(TypeString(), getEmbeddedLabel('Event id'))
  @Index(IndexKind.Indexed)
    eventId!: string

  @Prop(TypeString(), getEmbeddedLabel('Lane'))
    lane!: ConversationEventLane

  @Prop(TypeString(), getEmbeddedLabel('Visibility'))
    visibility!: ConversationEventVisibility

  @Prop(TypeString(), getEmbeddedLabel('Source'))
    source!: ConversationEventSource

  @Prop(TypeString(), getEmbeddedLabel('Source message id'))
    sourceMessageId?: string

  @Prop(TypeTimestamp(), getEmbeddedLabel('Occurred at'))
  @Index(IndexKind.Indexed)
    occurredAt!: Timestamp

  @Prop(TypeMarkup(), getEmbeddedLabel('Message'))
    message!: Markup

  @Prop(TypeAccountUuid(), getEmbeddedLabel('Author account'))
    authorAccount?: AccountUuid

  @Prop(TypeString(), getEmbeddedLabel('Idempotency key'))
  @Index(IndexKind.Indexed)
    idempotencyKey!: string

  @Prop(TypeString(), getEmbeddedLabel('Payload digest'))
    payloadDigest!: string

  @Prop(TypeNumber(), getEmbeddedLabel('Schema version'))
    schemaVersion!: number
}

export const liveInboxViewletConfig: Viewlet['config'] = [
  {
    key: '',
    label: tracker.string.Identifier,
    presenter: customerSuccess.component.TicketPresenter,
    props: { field: 'identifier', interactive: false },
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
    presenter: customerSuccess.component.TicketPresenter,
    props: { field: 'title', grow: true, minWidth: '12rem' },
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
  builder.createModel(TConversationEvent)

  builder.mixin(customerSuccess.class.ConversationEvent, core.class.Class, core.mixin.TxAccessLevel, {
    createAccessLevel: AccountRole.Admin,
    updateAccessLevel: AccountRole.Admin,
    removeAccessLevel: AccountRole.Admin
  })

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
