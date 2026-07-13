import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { makeLocalesTest } from '@hcengineering/platform'

it(
  'keeps Customer Success locale keys aligned',
  makeLocalesTest((lang) => import(`../../lang/${lang}.json`))
)

function toLocaleShape (value: unknown): unknown {
  if (typeof value === 'string') return 'string'

  if (Array.isArray(value)) {
    return value.map(toLocaleShape)
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, toLocaleShape(entry)])
    )
  }

  return typeof value
}

it('keeps every shipped locale file structurally aligned with english', () => {
  const langDir = join(__dirname, '../../lang')
  const localeFiles = readdirSync(langDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
  const englishShape = toLocaleShape(JSON.parse(readFileSync(join(langDir, 'en.json'), 'utf8')))

  expect(localeFiles.length).toBeGreaterThan(1)

  for (const file of localeFiles) {
    const localeShape = toLocaleShape(JSON.parse(readFileSync(join(langDir, file), 'utf8')))
    expect(localeShape).toEqual(englishShape)
  }
})

it('ships genuine non-English lifecycle and reconciliation copy in every registered locale', () => {
  const langDir = join(__dirname, '../../lang')
  const english = JSON.parse(readFileSync(join(langDir, 'en.json'), 'utf8')).string
  const localeFiles = readdirSync(langDir)
    .filter((file) => file.endsWith('.json') && file !== 'en.json')
    .sort()

  for (const key of [
    'ResolvedQueue',
    'NoResolvedTickets',
    'PendingAcknowledgement',
    'TakeoverConfirmed',
    'ReconciliationPending',
    'ClaimRequestPending',
    'ClaimRequestProcessing',
    'ClaimRequestAwaitingReconciliation',
    'ClaimRequestFailed',
    'ClaimRequestSuperseded',
    'ResolveCase',
    'ReopenCase',
    'ResolveCaseTitle',
    'ReopenCaseTitle',
    'TerminalActionReason',
    'TerminalActionReasonPlaceholder',
    'TerminalActionDetail',
    'TerminalActionDetailLimit',
    'TerminalActionStale',
    'TerminalActionConflict',
    'CustomerConfirmedReason',
    'RequestCompletedReason',
    'InformationProvidedReason',
    'DuplicateRequestReason',
    'CustomerFollowUpReason',
    'IncompleteResolutionReason',
    'NewInformationReason',
    'QualityReviewReason',
    'TerminalRequestPending',
    'TerminalRequestProcessing',
    'TerminalRequestAwaitingReconciliation',
    'TerminalRequestFailed',
    'TerminalRequestSuperseded',
    'TerminalRequestConfirmed'
  ]) {
    expect(english[key]).toEqual(expect.any(String))
    for (const file of localeFiles) {
      const locale = JSON.parse(readFileSync(join(langDir, file), 'utf8')).string
      expect(locale[key]).toEqual(expect.any(String))
      expect(locale[key]).not.toBe(english[key])
    }
  }
})
