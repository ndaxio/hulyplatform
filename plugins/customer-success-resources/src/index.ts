//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import type { Resources } from '@hcengineering/platform'

import LiveInbox from './components/LiveInbox.svelte'
import { resolveLocation } from './routing/resolveLocation'

export default async (): Promise<Resources> => ({
  component: {
    LiveInbox
  },
  resolver: {
    Location: resolveLocation
  }
})
