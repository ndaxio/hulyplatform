<!--
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
-->
<script lang="ts">
  import customerSuccess from '@hcengineering/customer-success'
  import { SortingOrder, type DocumentQuery, type WithLookup } from '@hcengineering/core'
  import inbox from '@hcengineering/inbox'
  import { getMetadata } from '@hcengineering/platform'
  import presentation, { createQuery, getClient } from '@hcengineering/presentation'
  import tracker, { type Issue, type Project } from '@hcengineering/tracker'
  import {
    Breadcrumb,
    Button,
    ButtonIcon,
    Header,
    IconRedo,
    Loading,
    SearchInput,
    SectionEmpty
  } from '@hcengineering/ui'
  import view, { type ViewOptions, type Viewlet } from '@hcengineering/view'
  import { ViewletContentView } from '@hcengineering/view-resources'
  import { onMount } from 'svelte'

  import {
    buildLiveInboxQuery,
    resolveContentState,
    resolveProjectLoadState,
    resolveSupportProjectId
  } from '../live-inbox'

  type InboxState = 'loading' | 'ready' | 'denied' | 'error'

  const client = getClient()
  const contentQuery = createQuery()
  const viewletQuery = createQuery()
  const projectId = resolveSupportProjectId(getMetadata(customerSuccess.metadata.SupportProjectId))

  let state: InboxState = 'loading'
  let project: Project | undefined
  let viewlet: WithLookup<Viewlet> | undefined
  let viewletLoading = true
  const viewOptions: ViewOptions = {
    groupBy: ['status'],
    orderBy: ['modifiedOn', SortingOrder.Descending]
  }
  let search = ''
  let query: DocumentQuery<Issue> = buildLiveInboxQuery(projectId)
  let resultQuery: DocumentQuery<Issue> = query
  let contentLoading = true
  let contentCount = 0
  $: contentState = resolveContentState(contentLoading, contentCount)

  function updateSearchQuery (value: string): void {
    query =
      value.trim() === ''
        ? buildLiveInboxQuery(projectId)
        : { ...buildLiveInboxQuery(projectId), $search: value.trim() }
  }

  $: updateSearchQuery(search)
  $: resultQuery = query

  function watchContent (query: DocumentQuery<Issue>): void {
    contentLoading = true
    contentQuery.query(
      tracker.class.Issue,
      query,
      (result) => {
        contentCount = result.length
        contentLoading = false
      },
      { limit: 1 }
    )
  }

  $: if (state === 'ready') {
    watchContent(resultQuery)
  }

  async function loadProject (): Promise<void> {
    state = 'loading'
    try {
      project = await client.findOne(tracker.class.Project, { _id: projectId })
      state = resolveProjectLoadState(project !== undefined)
    } catch {
      state = 'error'
    }
  }

  function loadViewlet (): void {
    viewletLoading = true
    viewletQuery.query(
      view.class.Viewlet,
      { _id: customerSuccess.viewlet.LiveInbox },
      (result) => {
        viewlet = result[0]
        viewletLoading = false
      },
      { lookup: { descriptor: view.class.ViewletDescriptor } }
    )
  }

  async function refreshInbox (): Promise<void> {
    loadViewlet()
    await loadProject()
  }

  onMount(() => {
    void refreshInbox()
  })
</script>

{#if state === 'loading'}
  <Loading />
{:else if state === 'denied'}
  <SectionEmpty icon={inbox.icon.Inbox} label={presentation.string.AccessDenied} />
{:else if state === 'error'}
  <SectionEmpty icon={inbox.icon.Inbox} label={presentation.string.FailedToPreview}>
    <div class="mt-2">
      <Button icon={IconRedo} label={customerSuccess.string.Refresh} kind="ghost" on:click={refreshInbox} />
    </div>
  </SectionEmpty>
{:else if project !== undefined}
  <Header adaptive="doubleRow" hideExtra>
    <Breadcrumb icon={inbox.icon.Inbox} title={project.name} size="large" isCurrent />
    <svelte:fragment slot="search">
      <SearchInput bind:value={search} collapsed />
    </svelte:fragment>
    <svelte:fragment slot="actions">
      <ButtonIcon
        icon={IconRedo}
        size="small"
        tooltip={{ label: customerSuccess.string.Refresh, direction: 'bottom' }}
        on:click={refreshInbox}
      />
    </svelte:fragment>
  </Header>
  {#if contentState === 'loading' || viewletLoading}
    <Loading />
  {:else if viewlet === undefined}
    <SectionEmpty icon={inbox.icon.Inbox} label={presentation.string.FailedToPreview}>
      <div class="mt-2">
        <Button icon={IconRedo} label={customerSuccess.string.Refresh} kind="ghost" on:click={refreshInbox} />
      </div>
    </SectionEmpty>
  {:else if contentState === 'empty'}
    <SectionEmpty icon={inbox.icon.Inbox} label={customerSuccess.string.NoTickets} />
  {:else}
    <ViewletContentView
      _class={tracker.class.Issue}
      {viewlet}
      query={resultQuery}
      space={project._id}
      {viewOptions}
      readonly
    />
  {/if}
{/if}
