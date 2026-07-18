<!--
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
-->
<script lang="ts">
  import customerSuccess from '@hcengineering/customer-success'
  import type { IntlString } from '@hcengineering/platform'
  import { translateCB } from '@hcengineering/platform'
  import { createEventDispatcher } from 'svelte'
  import { Label, themeStore } from '@hcengineering/ui'

  import { conversationComposerMessageMaxLength, type ConversationComposerUiState } from '../action-request'

  type ComposerAction = 'post_public_reply' | 'post_internal_note' | 'post_restricted_note'

  export let action: ComposerAction
  export let title: IntlString
  export let placeholder: IntlString
  export let submitLabel: IntlString
  export let draft = ''
  export let disabled = false
  export let busy = false
  export let status: ConversationComposerUiState = 'idle'

  const dispatch = createEventDispatcher<{
    draft: string
    submit: null
  }>()

  const titleId = `customer-success-composer-title-${action}`
  const inputId = `customer-success-composer-input-${action}`
  const statusId = `customer-success-composer-status-${action}`

  let textareaElement: HTMLTextAreaElement | undefined
  let previousStatus: ConversationComposerUiState = status
  let previousFocus: HTMLElement | null = null
  let currentStatusLabel: IntlString | undefined
  let translatedPlaceholder = ''

  function handleDraftInput (event: Event): void {
    dispatch('draft', (event.currentTarget as HTMLTextAreaElement).value)
  }

  function handleSubmit (): void {
    previousFocus = document.activeElement as HTMLElement | null
    dispatch('submit')
  }

  function statusLabel (): IntlString | undefined {
    switch (status) {
      case 'sending':
        return customerSuccess.string.ConversationComposerSending
      case 'delivered':
        return customerSuccess.string.ConversationComposerDelivered
      case 'suppressed':
        return customerSuccess.string.ConversationComposerSuppressed
      case 'failed':
        return customerSuccess.string.ConversationComposerFailed
      default:
        return undefined
    }
  }

  $: currentStatusLabel = statusLabel()
  $: translateCB(placeholder, {}, $themeStore.language, (value) => (translatedPlaceholder = value))
  $: if (status !== previousStatus) {
    if (status === 'failed') {
      textareaElement?.focus()
    } else if (status === 'delivered' || status === 'suppressed') {
      previousFocus?.focus()
    }
    previousStatus = status
  }
</script>

<form
  class="composer"
  class:restricted={action === 'post_restricted_note'}
  data-visibility={action === 'post_restricted_note'
    ? 'restricted'
    : action === 'post_internal_note'
      ? 'internal'
      : 'public'}
  aria-labelledby={titleId}
  aria-describedby={statusId}
  aria-busy={busy}
  on:submit|preventDefault={handleSubmit}
>
  <div class="composer-header">
    <h3 id={titleId}><Label label={title} /></h3>
    <div id={statusId} class="composer-status" aria-live="polite">
      {#if currentStatusLabel !== undefined}
        <Label label={currentStatusLabel} />
      {/if}
    </div>
  </div>

  <textarea
    bind:this={textareaElement}
    id={inputId}
    aria-labelledby={titleId}
    value={draft}
    rows={4}
    spellcheck="true"
    disabled={disabled || busy}
    placeholder={translatedPlaceholder}
    maxlength={conversationComposerMessageMaxLength}
    on:input={handleDraftInput}
  />

  <div class="composer-actions">
    <button type="submit" disabled={disabled || busy || draft.trim().length === 0}>
      <Label label={submitLabel} />
    </button>
  </div>
</form>

<style lang="scss">
  .composer {
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem;
    border: 1px solid var(--theme-divider-color);
    border-radius: 6px;
    background: var(--theme-panel-color, transparent);

    &.restricted {
      border-left: 3px solid var(--theme-warning-color, var(--theme-content-color));
    }
  }

  .composer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;

    h3 {
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.25rem;
      letter-spacing: 0;
    }
  }

  .composer-status {
    min-height: 1.25rem;
    color: var(--theme-halfcontent-color);
    font-size: 0.8125rem;
    text-align: right;
  }

  textarea {
    width: 100%;
    min-height: 7rem;
    padding: 0.75rem;
    resize: vertical;
    color: inherit;
    font: inherit;
    border: 1px solid var(--theme-divider-color);
    border-radius: 4px;
    background: var(--theme-bg-color);

    &:focus-visible {
      outline: 2px solid var(--theme-content-color);
      outline-offset: 1px;
    }
  }

  .composer-actions {
    display: flex;
    justify-content: flex-end;

    button {
      min-height: 2.25rem;
      padding: 0.5rem 0.875rem;
      color: var(--theme-button-text-color, var(--theme-bg-color));
      font: inherit;
      border: 1px solid transparent;
      border-radius: 4px;
      background: var(--theme-button-primary-color, var(--theme-content-color));
      cursor: pointer;

      &:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }
    }
  }
</style>
