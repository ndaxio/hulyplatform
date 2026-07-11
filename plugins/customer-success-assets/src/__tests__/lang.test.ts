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
  const localeFiles = readdirSync(langDir).filter((file) => file.endsWith('.json')).sort()
  const englishShape = toLocaleShape(JSON.parse(readFileSync(join(langDir, 'en.json'), 'utf8')))

  expect(localeFiles.length).toBeGreaterThan(1)

  for (const file of localeFiles) {
    const localeShape = toLocaleShape(JSON.parse(readFileSync(join(langDir, file), 'utf8')))
    expect(localeShape).toEqual(englishShape)
  }
})
