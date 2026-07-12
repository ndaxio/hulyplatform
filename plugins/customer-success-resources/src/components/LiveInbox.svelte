<!--
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
-->
<script lang="ts">
  import customerSuccess from '@hcengineering/customer-success'
  import { getCurrentEmployee } from '@hcengineering/contact'
  import { SortingOrder, type DocumentQuery, type WithLookup } from '@hcengineering/core'
  import inbox from '@hcengineering/inbox'
  import { getMetadata, type IntlString } from '@hcengineering/platform'
  import presentation, { createQuery, getClient } from '@hcengineering/presentation'
  import tracker, { type Issue, type Project } from '@hcengineering/tracker'
  import {
    Breadcrumb,
    Button,
    ButtonIcon,
    Header,
    IconRedo,
    Label,
    Loading,
    getCurrentResolvedLocation,
    location,
    navigate,
    SearchInput,
    SectionEmpty
  } from '@hcengineering/ui'
  import view, { type ViewOptions, type Viewlet } from '@hcengineering/view'
  import { FilterBar, FilterButton, ViewletContentView } from '@hcengineering/view-resources'
  import { onMount } from 'svelte'

  import {
    buildLiveInboxQuery,
    buildLiveInboxNavigationQuery,
    liveInboxQueueViews,
    nextLiveInboxQueueView,
    resolveContentState,
    resolveProjectionSpaceIds,
    resolveProjectLoadState,
    resolveSupportProjectId,
    resolveLiveInboxLocationState,
    type LiveInboxQueueView
  } from '../live-inbox'
  import { closeConversationQuery } from '../conversation-detail'
  import ConversationDetail from './ConversationDetail.svelte'

  type InboxState = 'loading' | 'ready' | 'denied' | 'error'

  const client = getClient()
  const contentQuery = createQuery()
  const viewletQuery = createQuery()
  const projectId = resolveSupportProjectId(getMetadata(customerSuccess.metadata.SupportProjectId))
  const currentEmployee = getCurrentEmployee()
  const projectionSpaceIds = resolveProjectionSpaceIds({
    public: getMetadata(customerSuccess.metadata.PublicProjectionSpaceId),
    internal: getMetadata(customerSuccess.metadata.InternalProjectionSpaceId),
    restricted: getMetadata(customerSuccess.metadata.RestrictedProjectionSpaceId)
  })

  let state: InboxState = 'loading'
  let project: Project | undefined
  let viewlet: WithLookup<Viewlet> | undefined
  let viewletLoading = true
  const viewOptions: ViewOptions = {
    groupBy: ['status'],
    orderBy: ['modifiedOn', SortingOrder.Descending]
  }
  let activeQueueView: LiveInboxQueueView = 'all'
  let search = ''
  let locationStateKey = ''
  let query: DocumentQuery<Issue> = buildLiveInboxQuery(projectId)
  let resultQuery: DocumentQuery<Issue> = query
  let filterQueryReady = false
  let contentLoading = true
  let contentCount = 0
  $: selectedIssueIdentifier = typeof $location.query?.issue === 'string' ? $location.query.issue : undefined
  $: contentState = resolveContentState(contentLoading, contentCount, filterQueryReady)
  $: {
    const persisted = resolveLiveInboxLocationState($location.query)
    const key = `${persisted.view}\u0000${persisted.search}`
    if (key !== locationStateKey) {
      locationStateKey = key
      activeQueueView = persisted.view
      search = persisted.search
    }
  }

  function updateSearchQuery (value: string, view: LiveInboxQueueView): void {
    query = buildLiveInboxQuery(projectId, view, { currentEmployee, search: value })
  }

  $: updateSearchQuery(search, activeQueueView)
  $: resetFilteredQuery(query)

  function resetFilteredQuery (_query: DocumentQuery<Issue>): void {
    void _query
    filterQueryReady = false
    contentLoading = true
  }

  function applyFilteredQuery (filteredQuery: DocumentQuery<Issue>): void {
    resultQuery = filteredQuery
    filterQueryReady = true
  }

  function persistQueueState (view: LiveInboxQueueView, value: string, replace = false): void {
    const loc = getCurrentResolvedLocation()
    loc.query = buildLiveInboxNavigationQuery(loc.query, view, value)
    loc.fragment = ''
    navigate(loc, replace)
  }

  function selectQueueView (view: LiveInboxQueueView): void {
    activeQueueView = view
    persistQueueState(view, search)
  }

  function handleQueueViewKeydown (event: KeyboardEvent, index: number): void {
    const nextView = nextLiveInboxQueueView(liveInboxQueueViews[index], event.key)
    if (nextView === undefined) return
    event.preventDefault()
    const nextIndex = liveInboxQueueViews.indexOf(nextView)
    const buttons =
      event.currentTarget instanceof HTMLElement
        ? event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
        : undefined
    buttons?.[nextIndex]?.focus()
    selectQueueView(nextView)
  }

  function queueViewLabel (view: LiveInboxQueueView): IntlString {
    switch (view) {
      case 'all':
        return customerSuccess.string.AllTickets
      case 'bot-active':
        return customerSuccess.string.BotActiveQueue
      case 'takeover-requested':
        return customerSuccess.string.TakeoverRequestedQueue
      case 'unassigned':
        return customerSuccess.string.UnassignedQueue
      case 'mine':
        return customerSuccess.string.MineQueue
      case 'customer-waiting':
        return customerSuccess.string.CustomerWaitingQueue
      case 'sla-risk':
        return customerSuccess.string.SlaRiskQueue
      case 'human-active':
        return customerSuccess.string.HumanActiveQueue
      case 'escalated':
        return customerSuccess.string.EscalatedQueue
      case 'resolved':
        return customerSuccess.string.ResolvedQueue
    }
  }

  function emptyViewLabel (view: LiveInboxQueueView): IntlString {
    switch (view) {
      case 'all':
        return customerSuccess.string.NoTickets
      case 'bot-active':
        return customerSuccess.string.NoBotActiveTickets
      case 'takeover-requested':
        return customerSuccess.string.NoTakeoverRequestedTickets
      case 'unassigned':
        return customerSuccess.string.NoUnassignedTickets
      case 'mine':
        return customerSuccess.string.NoMineTickets
      case 'customer-waiting':
        return customerSuccess.string.NoCustomerWaitingTickets
      case 'sla-risk':
        return customerSuccess.string.NoSlaRiskTickets
      case 'human-active':
        return customerSuccess.string.NoHumanActiveTickets
      case 'escalated':
        return customerSuccess.string.NoEscalatedTickets
      case 'resolved':
        return customerSuccess.string.NoResolvedTickets
    }
  }

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

  $: if (state === 'ready' && filterQueryReady) {
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

  function closeConversation (): void {
    const loc = getCurrentResolvedLocation()
    loc.query = closeConversationQuery(loc.query)
    loc.fragment = ''
    navigate(loc)
  }

  onMount(() => {
    void refreshInbox()
  })
</script>

{#if selectedIssueIdentifier !== undefined}
  <ConversationDetail
    {projectId}
    {projectionSpaceIds}
    issueIdentifier={selectedIssueIdentifier}
    onClose={closeConversation}
  />
{:else if state === 'loading'}
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
    <svelte:fragment slot="search" let:doubleRow>
      <SearchInput
        bind:value={search}
        collapsed
        on:change={() => {
          persistQueueState(activeQueueView, search, true)
        }}
      />
      <FilterButton _class={tracker.class.Issue} space={projectId} {viewOptions} adaptive={doubleRow} />
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
  <div class="queue-view-band">
    <h2 id="customer-success-queue-views" class="sr-only"><Label label={customerSuccess.string.QueueViews} /></h2>
    <div class="queue-views" role="tablist" aria-labelledby="customer-success-queue-views">
      {#each liveInboxQueueViews as queueView, index}
        <button
          id={`customer-success-queue-tab-${queueView}`}
          type="button"
          role="tab"
          aria-selected={activeQueueView === queueView}
          aria-controls="customer-success-queue-panel"
          tabindex={activeQueueView === queueView ? 0 : -1}
          class:active={activeQueueView === queueView}
          on:click={() => {
            selectQueueView(queueView)
          }}
          on:keydown={(event) => {
            handleQueueViewKeydown(event, index)
          }}><Label label={queueViewLabel(queueView)} /></button
        >
      {/each}
    </div>
  </div>
  <div
    id="customer-success-queue-panel"
    role="tabpanel"
    aria-labelledby={`customer-success-queue-tab-${activeQueueView}`}
    class="queue-panel"
  >
    <FilterBar
      _class={tracker.class.Issue}
      space={projectId}
      {query}
      {viewOptions}
      hideSaveButtons
      on:change={(event) => {
        applyFilteredQuery(event.detail)
      }}
    />
    {#if contentState === 'loading' || viewletLoading}
      <Loading />
    {:else if viewlet === undefined}
      <SectionEmpty icon={inbox.icon.Inbox} label={presentation.string.FailedToPreview}>
        <div class="mt-2">
          <Button icon={IconRedo} label={customerSuccess.string.Refresh} kind="ghost" on:click={refreshInbox} />
        </div>
      </SectionEmpty>
    {:else if contentState === 'empty'}
      <SectionEmpty icon={inbox.icon.Inbox} label={emptyViewLabel(activeQueueView)} />
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
  </div>
{/if}

<style lang="scss">
  .queue-view-band {
    flex: 0 0 auto;
    border-bottom: 1px solid var(--theme-divider-color);
  }

  .queue-panel {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
  }

  .queue-views {
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    overflow-x: auto;
    scrollbar-width: thin;

    button {
      flex: 0 0 auto;
      min-height: 2rem;
      padding: 0.375rem 0.625rem;
      color: var(--theme-halfcontent-color);
      font: inherit;
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0;
      white-space: nowrap;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 4px;
      cursor: pointer;

      &:hover,
      &:focus-visible {
        color: var(--theme-content-color);
        background: var(--theme-button-hovered);
      }

      &.active {
        color: var(--theme-content-color);
        background: var(--theme-button-pressed);
        border-color: var(--theme-divider-color);
      }
    }
  }
</style>
