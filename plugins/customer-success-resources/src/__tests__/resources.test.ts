//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import loadResources from '..'

jest.mock('../components/LiveInbox.svelte', () => ({ __esModule: true, default: 'LiveInbox' }))
jest.mock('../components/TicketPresenter.svelte', () => ({ __esModule: true, default: 'TicketPresenter' }))
jest.mock('../routing/resolveLocation', () => ({ resolveLocation: 'resolveLocation' }))

it('registers the inbox, safe ticket presenter, and location resolver together', async () => {
  await expect(loadResources()).resolves.toEqual({
    component: {
      LiveInbox: 'LiveInbox',
      TicketPresenter: 'TicketPresenter'
    },
    resolver: {
      Location: 'resolveLocation'
    }
  })
})
