//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(__dirname, '..', 'components', 'LiveInbox.svelte'), 'utf8')
const filterButtonSource = readFileSync(
  join(__dirname, '..', '..', '..', 'view-resources', 'src', 'components', 'filter', 'FilterButton.svelte'),
  'utf8'
)

describe('Customer Success queue workspace wiring guards', () => {
  it('wires the behavior-tested queue helpers to native persisted Huly filters', () => {
    expect(source).toContain('buildLiveInboxQuery(projectId, view, { currentEmployee, search: value })')
    expect(source).toContain('<FilterButton')
    expect(source).toContain('<FilterBar')
    expect(source).toContain('resetFilteredQuery(query)')
    expect(source).toContain('applyFilteredQuery(event.detail)')
    expect(source).toContain("state === 'ready' && filterQueryReady")
    expect(source).toContain('hideSaveButtons')
    expect(filterButtonSource).toContain('localStorage.getItem(key)')
    expect(filterButtonSource).toContain('localStorage.setItem(key, JSON.stringify(p))')
    expect(source).not.toContain('.filter((ticket)')
  })

  it('persists queue and search in navigation while preserving read-only ticket selection', () => {
    expect(source).toContain('buildLiveInboxNavigationQuery(loc.query, view, value)')
    expect(source).toContain('navigate(loc, replace)')
    expect(source).toContain('selectedIssueIdentifier')
    expect(source).toContain('readonly')
  })

  it('connects behavior-tested keyboard navigation to a complete ARIA tab interface', () => {
    expect(source).toContain('role="tablist"')
    expect(source).toContain('role="tab"')
    expect(source).toContain('nextLiveInboxQueueView(liveInboxQueueViews[index], event.key)')
    expect(source).toContain('aria-controls="customer-success-queue-panel"')
    expect(source).toContain('role="tabpanel"')
    expect(source).toMatch(/aria-labelledby=\{`customer-success-queue-tab-\$\{activeQueueView\}`\}/)
    expect(source).toContain('emptyViewLabel(activeQueueView)')
    expect(source).toContain('overflow-x: auto')
  })

  it('keeps large-queue counting bounded and delegates row rendering to the native viewlet', () => {
    expect(source).toContain('{ limit: 1 }')
    expect(source).toContain('<ViewletContentView')
    expect(source).toContain('query={resultQuery}')
  })
})
