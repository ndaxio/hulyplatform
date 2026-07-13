//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import {
  AccountRole,
  getRoleAttributeLabel,
  IndexKind,
  SortingOrder,
  type AccountUuid,
  type Domain,
  type Markup,
  type Permission,
  type Ref,
  type Role,
  type Timestamp
} from '@hcengineering/core'
import customerSuccess, {
  type ConversationBinding,
  type ConversationEvent,
  type ConversationEventLane,
  type ConversationEventSource,
  type ConversationEventVisibility,
  type ConversationProjectionSpace,
  type ConversationProjectionSpaceTypeData,
  type LiveSessionRecoveryState,
  type LiveSessionStage,
  type LiveSessionState,
  type SupportActionRequest,
  type SupportActionRequestAction,
  type SupportActionRequestState,
  customerSuccessId,
  customerSuccessLiveInboxId
} from '@hcengineering/customer-success'
import inbox from '@hcengineering/inbox'
import {
  ArrOf,
  type Builder,
  Index,
  Mixin,
  Model,
  Prop,
  TypeAccountUuid,
  TypeBoolean,
  TypeMarkup,
  TypeNumber,
  TypeRef,
  TypeString,
  TypeTimestamp
} from '@hcengineering/model'
import contact from '@hcengineering/model-contact'
import core, { TDoc, TTypedSpace } from '@hcengineering/model-core'
import tracker from '@hcengineering/model-tracker'
import view from '@hcengineering/model-view'
import workbench from '@hcengineering/model-workbench'
import { getEmbeddedLabel } from '@hcengineering/platform'
import { type Person } from '@hcengineering/contact'
import { type Issue, type IssueStatus, type Project } from '@hcengineering/tracker'
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

@Model(customerSuccess.class.ConversationBinding, core.class.Doc, DOMAIN_CUSTOMER_SUCCESS)
export class TConversationBinding extends TDoc implements ConversationBinding {
  @Prop(TypeString(), getEmbeddedLabel('Conversation id'))
  @Index(IndexKind.Indexed)
    conversationId!: string

  @Prop(TypeRef(tracker.class.Issue), getEmbeddedLabel('Issue id'))
  @Index(IndexKind.Indexed)
    issueId!: Ref<Issue>

  @Prop(TypeRef(tracker.class.Project), getEmbeddedLabel('Project id'))
  @Index(IndexKind.Indexed)
    projectId!: Ref<Project>

  @Prop(TypeString(), getEmbeddedLabel('Binding digest'))
    bindingDigest!: string

  @Prop(TypeNumber(), getEmbeddedLabel('Schema version'))
    schemaVersion!: number
}

@Model(customerSuccess.class.SupportActionRequest, core.class.Doc, DOMAIN_CUSTOMER_SUCCESS)
export class TSupportActionRequest extends TDoc implements SupportActionRequest {
  @Prop(TypeRef(tracker.class.Issue), getEmbeddedLabel('Issue id'))
  @Index(IndexKind.Indexed)
    issueId!: Ref<Issue>

  @Prop(TypeString(), getEmbeddedLabel('Action'))
    action!: SupportActionRequestAction

  @Prop(TypeRef(contact.class.Person), getEmbeddedLabel('Requested assignee'))
  @Index(IndexKind.Indexed)
    requestedAssignee!: Ref<Person>

  @Prop(TypeRef(tracker.class.IssueStatus), getEmbeddedLabel('Requested status'))
    requestedStatus?: Ref<IssueStatus>

  @Prop(TypeRef(tracker.class.IssueStatus), getEmbeddedLabel('Expected status'))
    expectedStatus!: Ref<IssueStatus>

  @Prop(TypeRef(contact.class.Person), getEmbeddedLabel('Expected assignee'))
    expectedAssignee!: Ref<Person> | null

  @Prop(TypeTimestamp(), getEmbeddedLabel('Expected modified on'))
  @Index(IndexKind.Indexed)
    expectedModifiedOn!: Timestamp

  @Prop(TypeString(), getEmbeddedLabel('Reason code'))
    reasonCode?: SupportActionRequest['reasonCode']

  @Prop(TypeString(), getEmbeddedLabel('Reason detail'))
    reasonDetail?: string

  @Prop(TypeString(), getEmbeddedLabel('State'))
    state!: SupportActionRequestState

  @Prop(TypeString(), getEmbeddedLabel('Result code'))
    resultCode?: string

  @Prop(TypeString(), getEmbeddedLabel('Error code'))
    errorCode?: string

  @Prop(TypeString(), getEmbeddedLabel('Processing lease id'))
    processingLeaseId?: string

  @Prop(TypeTimestamp(), getEmbeddedLabel('Processing lease expires at'))
    processingLeaseExpiresAt?: Timestamp

  @Prop(TypeTimestamp(), getEmbeddedLabel('Processed at'))
    processedAt?: Timestamp

  @Prop(TypeString(), getEmbeddedLabel('Idempotency key'))
  @Index(IndexKind.Indexed)
    idempotencyKey!: string

  @Prop(TypeNumber(), getEmbeddedLabel('Schema version'))
    schemaVersion!: number
}

@Model(customerSuccess.class.LiveSessionState, core.class.Doc, DOMAIN_CUSTOMER_SUCCESS)
export class TLiveSessionState extends TDoc implements LiveSessionState {
  @Prop(TypeRef(tracker.class.Issue), getEmbeddedLabel('Issue id'))
  @Index(IndexKind.Indexed)
    issueId!: Ref<Issue>

  @Prop(TypeString(), getEmbeddedLabel('Conversation id'))
  @Index(IndexKind.Indexed)
    conversationId?: string

  @Prop(TypeString(), getEmbeddedLabel('Live session stage'))
    stage!: LiveSessionStage

  @Prop(TypeRef(contact.class.Person), getEmbeddedLabel('Claim owner'))
    claimOwner!: Ref<Person> | null

  @Prop(TypeBoolean(), getEmbeddedLabel('Pending acknowledgement'))
    pendingAcknowledgement!: boolean

  @Prop(TypeBoolean(), getEmbeddedLabel('Acknowledged'))
    acknowledged!: boolean

  @Prop(TypeTimestamp(), getEmbeddedLabel('Requested at'))
    requestedAt?: Timestamp

  @Prop(TypeTimestamp(), getEmbeddedLabel('Expires at'))
    expiresAt?: Timestamp

  @Prop(TypeBoolean(), getEmbeddedLabel('Expired'))
    expired!: boolean

  @Prop(TypeString(), getEmbeddedLabel('Recovery state'))
    recoveryState!: LiveSessionRecoveryState

  @Prop(TypeRef(tracker.class.IssueStatus), getEmbeddedLabel('Source status'))
    sourceStatus!: Ref<IssueStatus>

  @Prop(TypeTimestamp(), getEmbeddedLabel('Observed at'))
  @Index(IndexKind.Indexed)
    observedAt!: Timestamp

  @Prop(TypeNumber(), getEmbeddedLabel('Schema version'))
    schemaVersion!: number
}

@Model(customerSuccess.class.ConversationProjectionSpace, core.class.TypedSpace, DOMAIN_CUSTOMER_SUCCESS)
export class TConversationProjectionSpace extends TTypedSpace implements ConversationProjectionSpace {}

@Mixin(customerSuccess.mixin.ConversationProjectionSpaceTypeData, customerSuccess.class.ConversationProjectionSpace)
export class TConversationProjectionSpaceTypeData
  extends TConversationProjectionSpace
  implements ConversationProjectionSpaceTypeData {
  [key: Ref<Role>]: AccountUuid[]
}

const projectionForbidPermissions: Ref<Permission>[] = [
  customerSuccess.permission.ForbidCreateConversationEvent,
  customerSuccess.permission.ForbidUpdateConversationEvent,
  customerSuccess.permission.ForbidRemoveConversationEvent,
  customerSuccess.permission.ForbidCreateConversationBinding,
  customerSuccess.permission.ForbidUpdateConversationBinding,
  customerSuccess.permission.ForbidRemoveConversationBinding,
  customerSuccess.permission.ForbidUpdateSupportActionRequest,
  customerSuccess.permission.ForbidRemoveSupportActionRequest,
  customerSuccess.permission.ForbidCreateLiveSessionState,
  customerSuccess.permission.ForbidUpdateLiveSessionState,
  customerSuccess.permission.ForbidRemoveLiveSessionState,
  customerSuccess.permission.ForbidUpdateProjectionSpace,
  customerSuccess.permission.ForbidRemoveProjectionSpace,
  customerSuccess.permission.ForbidUpdateProjectionRoles
]

const projectionRoles: Array<{ _id: Ref<Role>, name: string }> = [
  { _id: customerSuccess.role.SupportAgent, name: 'Support agent' },
  { _id: customerSuccess.role.SupportLead, name: 'Support lead' },
  { _id: customerSuccess.role.Compliance, name: 'Compliance' }
]

function defineProjectionSecurity (builder: Builder): void {
  for (const role of projectionRoles) {
    Prop(ArrOf(TypeAccountUuid()), getRoleAttributeLabel(role.name))(
      TConversationProjectionSpaceTypeData.prototype,
      role._id
    )
  }

  const permissionSpecs = [
    [
      customerSuccess.permission.ForbidCreateConversationEvent,
      core.class.TxCreateDoc,
      customerSuccess.class.ConversationEvent,
      'Create conversation event'
    ],
    [
      customerSuccess.permission.ForbidUpdateConversationEvent,
      core.class.TxUpdateDoc,
      customerSuccess.class.ConversationEvent,
      'Update conversation event'
    ],
    [
      customerSuccess.permission.ForbidRemoveConversationEvent,
      core.class.TxRemoveDoc,
      customerSuccess.class.ConversationEvent,
      'Remove conversation event'
    ],
    [
      customerSuccess.permission.ForbidCreateConversationBinding,
      core.class.TxCreateDoc,
      customerSuccess.class.ConversationBinding,
      'Create conversation binding'
    ],
    [
      customerSuccess.permission.ForbidUpdateConversationBinding,
      core.class.TxUpdateDoc,
      customerSuccess.class.ConversationBinding,
      'Update conversation binding'
    ],
    [
      customerSuccess.permission.ForbidRemoveConversationBinding,
      core.class.TxRemoveDoc,
      customerSuccess.class.ConversationBinding,
      'Remove conversation binding'
    ],
    [
      customerSuccess.permission.ForbidUpdateSupportActionRequest,
      core.class.TxUpdateDoc,
      customerSuccess.class.SupportActionRequest,
      'Update support action request'
    ],
    [
      customerSuccess.permission.ForbidRemoveSupportActionRequest,
      core.class.TxRemoveDoc,
      customerSuccess.class.SupportActionRequest,
      'Remove support action request'
    ],
    [
      customerSuccess.permission.ForbidCreateLiveSessionState,
      core.class.TxCreateDoc,
      customerSuccess.class.LiveSessionState,
      'Create live session state'
    ],
    [
      customerSuccess.permission.ForbidUpdateLiveSessionState,
      core.class.TxUpdateDoc,
      customerSuccess.class.LiveSessionState,
      'Update live session state'
    ],
    [
      customerSuccess.permission.ForbidRemoveLiveSessionState,
      core.class.TxRemoveDoc,
      customerSuccess.class.LiveSessionState,
      'Remove live session state'
    ],
    [
      customerSuccess.permission.ForbidUpdateProjectionSpace,
      core.class.TxUpdateDoc,
      customerSuccess.class.ConversationProjectionSpace,
      'Update conversation projection space'
    ],
    [
      customerSuccess.permission.ForbidRemoveProjectionSpace,
      core.class.TxRemoveDoc,
      customerSuccess.class.ConversationProjectionSpace,
      'Remove conversation projection space'
    ],
    [
      customerSuccess.permission.ForbidUpdateProjectionRoles,
      core.class.TxUpdateDoc,
      customerSuccess.mixin.ConversationProjectionSpaceTypeData,
      'Update conversation projection roles'
    ]
  ] as const

  for (const [permissionId, txClass, objectClass, label] of permissionSpecs) {
    builder.createDoc(
      core.class.Permission,
      core.space.Model,
      {
        label: getEmbeddedLabel(`Forbid ${label.toLowerCase()}`),
        txClass,
        objectClass,
        scope: 'space',
        forbid: true
      },
      permissionId
    )
  }

  builder.createDoc(
    core.class.SpaceTypeDescriptor,
    core.space.Model,
    {
      name: getEmbeddedLabel('Customer Success conversation projection'),
      description: getEmbeddedLabel('Restricted immutable conversation projection storage'),
      icon: inbox.icon.Inbox,
      baseClass: customerSuccess.class.ConversationProjectionSpace,
      availablePermissions: projectionForbidPermissions,
      system: true
    },
    customerSuccess.descriptor.ConversationProjectionSpace
  )

  builder.createDoc(
    core.class.SpaceType,
    core.space.Model,
    {
      name: 'Customer Success conversation projection',
      descriptor: customerSuccess.descriptor.ConversationProjectionSpace,
      roles: projectionRoles.length,
      targetClass: customerSuccess.mixin.ConversationProjectionSpaceTypeData
    },
    customerSuccess.spaceType.ConversationProjection
  )

  for (const role of projectionRoles) {
    builder.createDoc(
      core.class.Role,
      core.space.Model,
      {
        attachedTo: customerSuccess.spaceType.ConversationProjection,
        attachedToClass: core.class.SpaceType,
        collection: 'roles',
        name: role.name,
        permissions: projectionForbidPermissions
      },
      role._id
    )
  }
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
  builder.createModel(
    TConversationEvent,
    TConversationBinding,
    TSupportActionRequest,
    TLiveSessionState,
    TConversationProjectionSpace,
    TConversationProjectionSpaceTypeData
  )

  defineProjectionSecurity(builder)

  builder.mixin(customerSuccess.class.ConversationEvent, core.class.Class, core.mixin.TxAccessLevel, {
    createAccessLevel: AccountRole.Admin,
    updateAccessLevel: AccountRole.Admin,
    removeAccessLevel: AccountRole.Admin
  })

  builder.mixin(customerSuccess.class.ConversationBinding, core.class.Class, core.mixin.TxAccessLevel, {
    createAccessLevel: AccountRole.Admin,
    updateAccessLevel: AccountRole.Admin,
    removeAccessLevel: AccountRole.Admin
  })

  builder.mixin(customerSuccess.class.SupportActionRequest, core.class.Class, core.mixin.TxAccessLevel, {
    createAccessLevel: AccountRole.User,
    updateAccessLevel: AccountRole.Admin,
    removeAccessLevel: AccountRole.Admin
  })

  builder.mixin(customerSuccess.class.LiveSessionState, core.class.Class, core.mixin.TxAccessLevel, {
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
