//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import type { Doc, Ref } from '@hcengineering/core'
import type { IntlString, Metadata, Plugin, Resource } from '@hcengineering/platform'
import { plugin } from '@hcengineering/platform'
import type { Project } from '@hcengineering/tracker'
import type { AnyComponent, Location, ResolvedLocation } from '@hcengineering/ui'
import type { Viewlet } from '@hcengineering/view'

export const customerSuccessId = 'customer-success' as Plugin
export const customerSuccessLiveInboxId = 'customer-success-live-inbox'

export const defaultSupportProjectId = 'ndax:support:project:customer-success-inbox' as Ref<Project>

const customerSuccess = plugin(customerSuccessId, {
  app: {
    CustomerSuccess: '' as Ref<Doc>
  },
  component: {
    LiveInbox: '' as AnyComponent,
    TicketPresenter: '' as AnyComponent
  },
  metadata: {
    SupportProjectId: '' as Metadata<Ref<Project>>
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
    NoActivity: '' as IntlString,
    TicketNotFound: '' as IntlString
  },
  viewlet: {
    LiveInbox: '' as Ref<Viewlet>
  }
})

export default customerSuccess
