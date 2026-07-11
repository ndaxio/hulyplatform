//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import type { Resources } from '@hcengineering/platform'

import LiveInbox from './components/LiveInbox.svelte'
import TicketPresenter from './components/TicketPresenter.svelte'
import { resolveLocation } from './routing/resolveLocation'

export default async (): Promise<Resources> => ({
  component: {
    LiveInbox,
    TicketPresenter
  },
  resolver: {
    Location: resolveLocation
  }
})
