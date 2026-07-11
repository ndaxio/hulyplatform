<!--
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
-->
<script lang="ts">
  import activity, { type ActivityMessage } from '@hcengineering/activity'
  import chunter, { type ChatMessage } from '@hcengineering/chunter'
  import customerSuccess from '@hcengineering/customer-success'
  import { DateRangeMode, SortingOrder, type DocumentQuery, type Ref } from '@hcengineering/core'
  import type { IntlString } from '@hcengineering/platform'
  import inbox from '@hcengineering/inbox'
  import presentation, { MessageViewer, createQuery, getClient } from '@hcengineering/presentation'
  import tracker, { type Issue, type IssueStatus, type Project } from '@hcengineering/tracker'
  import {
    Breadcrumb,
    Button,
    Component,
    DatePresenter,
    Header,
    IconArrowLeft,
    IconRedo,
    Label,
    Loading,
    Scroller,
    SectionEmpty,
    deviceOptionsStore as deviceInfo
  } from '@hcengineering/ui'

  import {
    buildConversationHistoryQuery,
    buildConversationIssueQuery,
    buildConversationTranscriptQuery,
    LatestConversationRequest,
    sortConversationEntriesAscending,
    visibleConversationEntries,
    type ConversationEntryDoc,
    type ConversationEntryLane
  } from '../conversation-detail'

  export let issueIdentifier: string
  export let projectId: Ref<Project>
  export let onClose: () => void

  type DetailState = 'loading' | 'ready' | 'denied' | 'error'
  type SupportChatMessage = ChatMessage & ConversationEntryDoc
  interface VisibleMessage {
    message: SupportChatMessage
    lane: ConversationEntryLane
  }

  const client = getClient()
  const transcriptQuery = createQuery()
  const historyQuery = createQuery()
  const issueRequest = new LatestConversationRequest()

  let state: DetailState = 'loading'
  let issue: Issue | undefined
  let issueStatus: IssueStatus | undefined
  let visibleMessages: VisibleMessage[] = []
  let history: ActivityMessage[] = []
  let transcriptLoading = true
  let historyLoading = true
  let mobileLane: 'conversation' | 'activity' = 'conversation'
  let conversationTab: HTMLButtonElement
  let activityTab: HTMLButtonElement

  function stopLaneQueries (): void {
    transcriptQuery.unsubscribe()
    historyQuery.unsubscribe()
    visibleMessages = []
    history = []
  }

  async function loadIssue (identifier: string, supportProjectId: Ref<Project>): Promise<void> {
    const query = buildConversationIssueQuery(supportProjectId, identifier)
    stopLaneQueries()
    issue = undefined
    issueStatus = undefined

    if (query === undefined) {
      issueRequest.invalidate()
      state = 'denied'
      return
    }

    state = 'loading'
    try {
      const result = await issueRequest.run(async () => {
        const loaded = await client.findOne(tracker.class.Issue, query)
        if (loaded === undefined) return { state: 'denied' as const }
        let status: IssueStatus | undefined
        try {
          status = await client.findOne(tracker.class.IssueStatus, { _id: loaded.status })
        } catch {
          status = undefined
        }
        return { state: 'ready' as const, issue: loaded, status }
      })
      if (result === undefined) return
      state = result.state
      issue = result.state === 'ready' ? result.issue : undefined
      issueStatus = result.state === 'ready' ? result.status : undefined
    } catch {
      state = 'error'
    }
  }

  function watchTranscript (target: Issue): void {
    transcriptLoading = true
    const targetId = target._id
    transcriptQuery.query(
      chunter.class.ChatMessage,
      buildConversationTranscriptQuery(projectId, target._id) as DocumentQuery<ChatMessage>,
      (result) => {
        if (issue?._id !== targetId) return
        visibleMessages = visibleConversationEntries(result as SupportChatMessage[])
        transcriptLoading = false
      },
      { sort: { createdOn: SortingOrder.Ascending } }
    )
  }

  function watchHistory (target: Issue): void {
    historyLoading = true
    const targetId = target._id
    historyQuery.query(
      activity.class.ActivityMessage,
      buildConversationHistoryQuery(projectId, target._id) as DocumentQuery<ActivityMessage>,
      (result) => {
        if (issue?._id !== targetId) return
        history = sortConversationEntriesAscending(result as Array<ActivityMessage & ConversationEntryDoc>)
        historyLoading = false
      },
      { sort: { createdOn: SortingOrder.Ascending } }
    )
  }

  function laneLabel (lane: ConversationEntryLane): IntlString {
    switch (lane) {
      case 'customer':
        return customerSuccess.string.Customer
      case 'bot':
        return customerSuccess.string.Bot
      case 'agent':
        return customerSuccess.string.SupportAgent
      case 'system':
        return customerSuccess.string.System
    }
  }

  function selectMobileLane (lane: 'conversation' | 'activity', focus = false): void {
    mobileLane = lane
    if (focus) setTimeout(() => { (lane === 'conversation' ? conversationTab : activityTab)?.focus() })
  }

  function handleMobileLaneKeydown (event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    selectMobileLane(mobileLane === 'conversation' ? 'activity' : 'conversation', true)
  }

  $: void loadIssue(issueIdentifier, projectId)
  $: if (state === 'ready' && issue !== undefined) {
    watchTranscript(issue)
    watchHistory(issue)
  }
</script>

<div class="detail-shell">
  <Header adaptive="doubleRow" hideExtra>
    <svelte:fragment slot="beforeTitle">
      <Button
        icon={IconArrowLeft}
        size="small"
        kind="ghost"
        label={customerSuccess.string.BackToInbox}
        on:click={onClose}
      />
    </svelte:fragment>
    <Breadcrumb icon={inbox.icon.Inbox} title={issue?.title ?? issueIdentifier} size="large" isCurrent />
    {#if state !== 'loading'}
      <svelte:fragment slot="actions">
        <Button
          icon={IconRedo}
          size="small"
          kind="ghost"
          label={customerSuccess.string.Refresh}
          on:click={() => loadIssue(issueIdentifier, projectId)}
        />
      </svelte:fragment>
    {/if}
  </Header>

  {#if state === 'loading'}
    <Loading />
  {:else if state === 'denied'}
    <SectionEmpty icon={inbox.icon.Inbox} label={customerSuccess.string.TicketNotFound} />
  {:else if state === 'error'}
    <SectionEmpty icon={inbox.icon.Inbox} label={presentation.string.FailedToPreview} />
  {:else if issue !== undefined}
    <div class="ticket-summary">
      <div class="ticket-title">
        <span class="ticket-key">{issue.identifier}</span>
        <h1>{issue.title}</h1>
      </div>
      <div class="ticket-meta">
        {#if issueStatus !== undefined}<span class="status-label">{issueStatus.name}</span>{/if}
        <DatePresenter value={issue.modifiedOn} mode={DateRangeMode.DATETIME} kind="ghost" size="small" />
      </div>
    </div>

    {#if $deviceInfo.isMobile}
      <div class="mobile-tabs" role="tablist">
        <button
          bind:this={conversationTab}
          id="customer-success-conversation-tab"
          role="tab"
          type="button"
          aria-selected={mobileLane === 'conversation'}
          aria-controls="customer-success-conversation-panel"
          tabindex={mobileLane === 'conversation' ? 0 : -1}
          on:click={() => { selectMobileLane('conversation') }}
          on:keydown={handleMobileLaneKeydown}><Label label={customerSuccess.string.Conversation} /></button
        >
        <button
          bind:this={activityTab}
          id="customer-success-activity-tab"
          role="tab"
          type="button"
          aria-selected={mobileLane === 'activity'}
          aria-controls="customer-success-activity-panel"
          tabindex={mobileLane === 'activity' ? 0 : -1}
          on:click={() => { selectMobileLane('activity') }}
          on:keydown={handleMobileLaneKeydown}><Label label={customerSuccess.string.Activity} /></button
        >
      </div>
    {/if}

    <div class="detail-grid">
      <section
        class="conversation-lane"
        class:mobile-hidden={$deviceInfo.isMobile && mobileLane !== 'conversation'}
        id="customer-success-conversation-panel"
        role={$deviceInfo.isMobile ? 'tabpanel' : undefined}
        aria-labelledby={$deviceInfo.isMobile
          ? 'customer-success-conversation-tab'
          : 'customer-success-conversation-heading'}
      >
        <div class="lane-header">
          <h2 id="customer-success-conversation-heading"><Label label={customerSuccess.string.Conversation} /></h2>
        </div>
        <div class="lane-scroll">
          <Scroller padding="0 1rem 1rem">
            {#if transcriptLoading}
              <Loading />
            {:else if visibleMessages.length === 0}
              <div class="empty-lane"><Label label={customerSuccess.string.NoMessages} /></div>
            {:else}
              <div class="message-list">
                {#each visibleMessages as entry (entry.message._id)}
                  <article class="message-row" class:customer={entry.lane === 'customer'}>
                    <div class="message-meta">
                      <strong><Label label={laneLabel(entry.lane)} /></strong>
                      <DatePresenter
                        value={entry.message.createdOn ?? entry.message.modifiedOn}
                        mode={DateRangeMode.DATETIME}
                        kind="ghost"
                        size="small"
                      />
                    </div>
                    <div class="message-body"><MessageViewer message={entry.message.message} /></div>
                  </article>
                {/each}
              </div>
            {/if}
          </Scroller>
        </div>
      </section>

      <aside
        class="activity-lane"
        class:mobile-hidden={$deviceInfo.isMobile && mobileLane !== 'activity'}
        id="customer-success-activity-panel"
        role={$deviceInfo.isMobile ? 'tabpanel' : undefined}
        aria-labelledby={$deviceInfo.isMobile ? 'customer-success-activity-tab' : 'customer-success-activity-heading'}
      >
        <div class="lane-header">
          <h2 id="customer-success-activity-heading"><Label label={customerSuccess.string.Activity} /></h2>
        </div>
        <div class="lane-scroll">
          <Scroller padding="0 1rem 1rem">
            {#if historyLoading}
              <Loading />
            {:else if history.length === 0}
              <div class="empty-lane"><Label label={customerSuccess.string.NoActivity} /></div>
            {:else}
              <div class="activity-list">
                {#each history as item (item._id)}
                  <Component
                    is={activity.component.ActivityMessagePresenter}
                    props={{
                      value: item,
                      doc: issue,
                      hideLink: true,
                      readonly: true,
                      withActions: false,
                      withShowMore: true
                    }}
                  />
                {/each}
              </div>
            {/if}
          </Scroller>
        </div>
      </aside>
    </div>
  {/if}
</div>

<style lang="scss">
  .detail-shell {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .ticket-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 2rem;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--theme-divider-color);
  }

  .ticket-title {
    min-width: 0;

    h1 {
      margin: 0.2rem 0 0;
      overflow-wrap: anywhere;
      font-size: 1.125rem;
      line-height: 1.35;
      letter-spacing: 0;
    }
  }

  .ticket-key {
    color: var(--theme-halfcontent-color);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .ticket-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  .status-label {
    padding: 0.25rem 0.5rem;
    color: var(--theme-halfcontent-color);
    font-size: 0.75rem;
    border: 1px solid var(--theme-divider-color);
    border-radius: 4px;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(18rem, 30%);
    flex: 1 1 auto;
    min-height: 0;
  }

  .mobile-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    flex: 0 0 auto;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--theme-divider-color);

    button {
      min-height: 2.25rem;
      padding: 0.375rem 0.75rem;
      overflow: hidden;
      color: var(--theme-halfcontent-color);
      font: inherit;
      text-overflow: ellipsis;
      white-space: nowrap;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 4px;
      cursor: pointer;

      &[aria-selected='true'] {
        color: var(--theme-content-color);
        background: var(--theme-comp-header-color);
        border-color: var(--theme-divider-color);
      }

      &:focus-visible {
        outline: 2px solid var(--theme-content-color);
        outline-offset: 1px;
      }
    }
  }

  .mobile-hidden {
    display: none;
  }

  .conversation-lane,
  .activity-lane {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .activity-lane {
    border-left: 1px solid var(--theme-divider-color);
  }

  .lane-header {
    display: flex;
    flex: 0 0 auto;
    gap: 1rem;
    align-items: center;
    justify-content: space-between;
    min-height: 3rem;
    padding: 0 1rem;
    border-bottom: 1px solid var(--theme-divider-color);

    h2 {
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.25;
      letter-spacing: 0;
    }
  }

  .lane-scroll {
    flex: 1 1 auto;
    min-height: 0;
  }

  .message-list,
  .activity-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 1rem;
  }

  .message-row {
    padding: 0.875rem 1rem;
    background: var(--theme-comp-header-color);
    border: 1px solid var(--theme-divider-color);
    border-radius: 6px;

    &.customer {
      border-left: 3px solid var(--theme-content-color);
    }
  }

  .message-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.75rem;
  }

  .message-body {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .empty-lane {
    display: grid;
    min-height: 10rem;
    place-items: center;
    color: var(--theme-halfcontent-color);
    font-size: 0.875rem;
  }

  @media (max-width: 800px) {
    .detail-grid {
      display: flex;
      flex-direction: column;
    }

    .conversation-lane,
    .activity-lane {
      flex: 1 1 auto;
      min-height: 0;
    }

    .activity-lane {
      border-top: 1px solid var(--theme-divider-color);
      border-left: 0;
    }
  }
</style>
