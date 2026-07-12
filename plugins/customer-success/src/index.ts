//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import type {
  AccountUuid,
  Class,
  Doc,
  Markup,
  Mixin,
  Permission,
  Ref,
  Role,
  RolesAssignment,
  SpaceType,
  SpaceTypeDescriptor,
  Timestamp,
  TypedSpace
} from '@hcengineering/core'
import type { IntlString, Metadata, Plugin, Resource } from '@hcengineering/platform'
import { plugin } from '@hcengineering/platform'
import type { Issue, Project } from '@hcengineering/tracker'
import type { AnyComponent, Location, ResolvedLocation } from '@hcengineering/ui'
import type { Viewlet } from '@hcengineering/view'

export const customerSuccessId = 'customer-success' as Plugin
export const customerSuccessLiveInboxId = 'customer-success-live-inbox'

export const defaultSupportProjectId = 'ndax:support:project:customer-success-inbox' as Ref<Project>
export const defaultPublicProjectionSpaceId = 'ndax:support:projection:public' as Ref<ConversationProjectionSpace>
export const defaultInternalProjectionSpaceId = 'ndax:support:projection:internal' as Ref<ConversationProjectionSpace>
export const defaultRestrictedProjectionSpaceId =
  'ndax:support:projection:restricted' as Ref<ConversationProjectionSpace>

export type ConversationEventLane = 'customer' | 'bot' | 'agent' | 'system'
export type ConversationEventVisibility = 'public' | 'internal' | 'restricted'
export type ConversationEventSource = 'chat-orchestrator' | 'huly-agent' | 'support-system'

/**
 * Immutable operator-facing projection of a support conversation event.
 * Raw ChatMessage comments are not an authorization boundary and must not be
 * used as the production transcript source.
 */
export interface ConversationEvent extends Doc {
  issueId: Ref<Issue>
  conversationId: string
  eventId: string
  lane: ConversationEventLane
  visibility: ConversationEventVisibility
  source: ConversationEventSource
  sourceMessageId?: string
  occurredAt: Timestamp
  message: Markup
  authorAccount?: AccountUuid
  idempotencyKey: string
  payloadDigest: string
  schemaVersion: number
}

export interface ConversationBinding extends Doc {
  conversationId: string
  issueId: Ref<Issue>
  projectId: Ref<Project>
  bindingDigest: string
  schemaVersion: number
}

export interface ConversationProjectionSpace extends TypedSpace {}

export interface ConversationProjectionSpaceTypeData extends ConversationProjectionSpace, RolesAssignment {}

const customerSuccess = plugin(customerSuccessId, {
  app: {
    CustomerSuccess: '' as Ref<Doc>
  },
  class: {
    ConversationEvent: '' as Ref<Class<ConversationEvent>>,
    ConversationBinding: '' as Ref<Class<ConversationBinding>>,
    ConversationProjectionSpace: '' as Ref<Class<ConversationProjectionSpace>>
  },
  mixin: {
    ConversationProjectionSpaceTypeData: '' as Ref<Mixin<ConversationProjectionSpaceTypeData>>
  },
  descriptor: {
    ConversationProjectionSpace: '' as Ref<SpaceTypeDescriptor>
  },
  spaceType: {
    ConversationProjection: '' as Ref<SpaceType>
  },
  role: {
    SupportAgent: '' as Ref<Role>,
    SupportLead: '' as Ref<Role>,
    Compliance: '' as Ref<Role>
  },
  permission: {
    ForbidCreateConversationEvent: '' as Ref<Permission>,
    ForbidUpdateConversationEvent: '' as Ref<Permission>,
    ForbidRemoveConversationEvent: '' as Ref<Permission>,
    ForbidCreateConversationBinding: '' as Ref<Permission>,
    ForbidUpdateConversationBinding: '' as Ref<Permission>,
    ForbidRemoveConversationBinding: '' as Ref<Permission>,
    ForbidUpdateProjectionSpace: '' as Ref<Permission>,
    ForbidRemoveProjectionSpace: '' as Ref<Permission>,
    ForbidUpdateProjectionRoles: '' as Ref<Permission>
  },
  component: {
    LiveInbox: '' as AnyComponent,
    TicketPresenter: '' as AnyComponent
  },
  metadata: {
    SupportProjectId: '' as Metadata<Ref<Project>>,
    PublicProjectionSpaceId: '' as Metadata<Ref<ConversationProjectionSpace>>,
    InternalProjectionSpaceId: '' as Metadata<Ref<ConversationProjectionSpace>>,
    RestrictedProjectionSpaceId: '' as Metadata<Ref<ConversationProjectionSpace>>
  },
  resolver: {
    Location: '' as Resource<(loc: Location) => Promise<ResolvedLocation | undefined>>
  },
  string: {
    CustomerSuccess: '' as IntlString,
    LiveInbox: '' as IntlString,
    Refresh: '' as IntlString,
    TakeoverState: '' as IntlString,
    SlaDue: '' as IntlString,
    LastActivity: '' as IntlString,
    NoTickets: '' as IntlString,
    BackToInbox: '' as IntlString,
    Conversation: '' as IntlString,
    Activity: '' as IntlString,
    Customer: '' as IntlString,
    Bot: '' as IntlString,
    SupportAgent: '' as IntlString,
    System: '' as IntlString,
    NoMessages: '' as IntlString,
    LoadEarlier: '' as IntlString,
    PublicVisibility: '' as IntlString,
    InternalVisibility: '' as IntlString,
    RestrictedVisibility: '' as IntlString,
    NoActivity: '' as IntlString,
    TicketNotFound: '' as IntlString,
    QueueViews: '' as IntlString,
    AllTickets: '' as IntlString,
    BotActiveQueue: '' as IntlString,
    TakeoverRequestedQueue: '' as IntlString,
    UnassignedQueue: '' as IntlString,
    MineQueue: '' as IntlString,
    CustomerWaitingQueue: '' as IntlString,
    SlaRiskQueue: '' as IntlString,
    HumanActiveQueue: '' as IntlString,
    EscalatedQueue: '' as IntlString,
    ResolvedQueue: '' as IntlString,
    NoBotActiveTickets: '' as IntlString,
    NoTakeoverRequestedTickets: '' as IntlString,
    NoUnassignedTickets: '' as IntlString,
    NoMineTickets: '' as IntlString,
    NoCustomerWaitingTickets: '' as IntlString,
    NoSlaRiskTickets: '' as IntlString,
    NoHumanActiveTickets: '' as IntlString,
    NoEscalatedTickets: '' as IntlString,
    NoResolvedTickets: '' as IntlString
  },
  viewlet: {
    LiveInbox: '' as Ref<Viewlet>
  }
})

export default customerSuccess
