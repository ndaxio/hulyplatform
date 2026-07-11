//
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
//

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { isListMutationEnabled } from '../listReadonly'

describe('read-only list guard', () => {
  it('disables list mutations in read-only views', () => {
    expect(isListMutationEnabled(true)).toBe(false)
  })

  it('keeps list mutations enabled for existing editable views', () => {
    expect(isListMutationEnabled(false)).toBe(true)
  })

  it('threads readonly through the fixed view shell into the rendered descriptor component', () => {
    const viewletContentViewSource = readFileSync(
      join(__dirname, '..', 'components', 'ViewletContentView.svelte'),
      'utf8'
    )
    const listViewSource = readFileSync(join(__dirname, '..', 'components', 'list', 'ListView.svelte'), 'utf8')

    expect(viewletContentViewSource).toMatch(/props=\{\{[\s\S]*readonly[\s\S]*\}\}/)
    expect(listViewSource).toMatch(/<List[\s\S]*\{readonly\}[\s\S]*\{listProvider\}/)
  })

  it('suppresses list drag affordances and row context actions when readonly', () => {
    const listItemSource = readFileSync(join(__dirname, '..', 'components', 'list', 'ListItem.svelte'), 'utf8')
    const listCategorySource = readFileSync(join(__dirname, '..', 'components', 'list', 'ListCategory.svelte'), 'utf8')

    expect(listItemSource).toContain('draggable={isListMutationEnabled(readonly)}')
    expect(listItemSource).toMatch(/\{#if isListMutationEnabled\(readonly\)\}[\s\S]*draggable-mark/)
    expect(listItemSource).toMatch(
      /function getOnChange[\s\S]*if \(!isListMutationEnabled\(readonly\)\) return[\s\S]*onChange/
    )
    expect(listCategorySource).toMatch(
      /on:contextmenu=\{async \(event\) => \{\s*if \(isListMutationEnabled\(readonly\)\) \{\s*await handleMenuOpened/
    )
    expect(listCategorySource).toMatch(
      /async function drop[\s\S]*if \(!isListMutationEnabled\(readonly\)\) return[\s\S]*client\.update/
    )
    expect(listCategorySource).toMatch(/function dragEnterCat[\s\S]*if \(!isListMutationEnabled\(readonly\)\) return/)
  })

  it('keeps the editable path wired for list mutations and inline value updates', () => {
    const listItemSource = readFileSync(join(__dirname, '..', 'components', 'list', 'ListItem.svelte'), 'utf8')
    const listCategorySource = readFileSync(join(__dirname, '..', 'components', 'list', 'ListCategory.svelte'), 'utf8')

    expect(listItemSource).toMatch(
      /function getOnChange[\s\S]*return \(value: any\) => \{\s*onChange\(value, docObject, attribute\.key, attr\)/
    )
    expect(listItemSource).toMatch(/<ListPresenter[\s\S]*onChange=\{getOnChange\(docObject, attributeModel\)\}/)
    expect(listCategorySource).toMatch(
      /function dropItemHandle[\s\S]*const update: DocumentUpdate<Doc> = \{\}[\s\S]*void drop\(update\)/
    )
    expect(listCategorySource).toMatch(
      /function dragOverCat[\s\S]*ev\.preventDefault\(\)[\s\S]*ev\.stopPropagation\(\)/
    )
  })
})
