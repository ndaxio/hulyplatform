<!--
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
-->
<script lang="ts">
  import customerSuccess, {
    type SupportLifecycleReasonCode,
    type SupportReopenReasonCode,
    type SupportResolveReasonCode,
    type SupportActionRequestState
  } from '@hcengineering/customer-success'
  import type { IntlString } from '@hcengineering/platform'
  import { Button, Label } from '@hcengineering/ui'
  import { onDestroy, onMount } from 'svelte'

  import {
    reopenCaseReasonCodes,
    resolveCaseReasonCodes,
    isTerminalReasonAllowed,
    terminalReasonDetailMaxLength,
    type TerminalAction
  } from '../action-request'

  export let action: TerminalAction
  export let reasonCode: SupportLifecycleReasonCode | undefined
  export let reasonDetail = ''
  export let stale = false
  export let conflict = false
  export let requestState: SupportActionRequestState | undefined
  export let submitting = false
  export let submissionFailed = false
  export let onConfirm: (reasonCode: SupportLifecycleReasonCode, reasonDetail: string) => Promise<void>
  export let onClose: () => void

  let dialog: HTMLDialogElement
  let firstReason: HTMLInputElement
  let statusRegion: HTMLParagraphElement
  let previousFocus: HTMLElement | null = null

  $: reasons = action === 'resolve_case' ? resolveCaseReasonCodes : reopenCaseReasonCodes
  $: reasonAllowed = isTerminalReasonAllowed(action, reasonCode)
  $: statusMessage =
    stale
      ? customerSuccess.string.TerminalActionStale
      : conflict
        ? customerSuccess.string.TerminalActionConflict
        : submissionFailed
          ? customerSuccess.string.TerminalRequestFailed
          : requestState === 'failed'
            ? customerSuccess.string.TerminalRequestFailed
            : requestState === 'superseded'
              ? customerSuccess.string.TerminalRequestSuperseded
              : undefined
  $: statusIds = [
    'customer-success-terminal-dialog-description',
    'customer-success-terminal-detail-limit',
    statusMessage !== undefined ? 'customer-success-terminal-dialog-status' : undefined
  ]
    .filter((value): value is string => value !== undefined)
    .join(' ')

  onMount(() => {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    firstReason?.focus()
  })

  onDestroy(() => {
    if (dialog?.open) dialog.close()
    previousFocus?.focus()
  })

  function reasonLabel (reason: SupportResolveReasonCode | SupportReopenReasonCode): IntlString {
    switch (reason) {
      case 'customer_confirmed':
        return customerSuccess.string.CustomerConfirmedReason
      case 'request_completed':
        return customerSuccess.string.RequestCompletedReason
      case 'information_provided':
        return customerSuccess.string.InformationProvidedReason
      case 'duplicate_request':
        return customerSuccess.string.DuplicateRequestReason
      case 'customer_follow_up':
        return customerSuccess.string.CustomerFollowUpReason
      case 'incomplete_resolution':
        return customerSuccess.string.IncompleteResolutionReason
      case 'new_information':
        return customerSuccess.string.NewInformationReason
      case 'quality_review':
        return customerSuccess.string.QualityReviewReason
    }
  }

  function close (): void {
    if (submitting) return
    dialog.close()
    previousFocus?.focus()
    onClose()
  }

  function confirm (): void {
    if (!reasonAllowed || reasonCode === undefined || submitting || stale || conflict) return
    void onConfirm(reasonCode, reasonDetail)
  }

  function handleBackdropClick (event: MouseEvent): void {
    if (event.target === dialog) close()
  }
</script>

<dialog
  bind:this={dialog}
  class="terminal-dialog"
  role="dialog"
  aria-modal="true"
  aria-busy={submitting}
  aria-labelledby="customer-success-terminal-dialog-title"
  aria-describedby={statusIds}
  on:cancel|preventDefault={close}
  on:click={handleBackdropClick}
>
  <form on:submit|preventDefault={confirm} on:reset|preventDefault={close}>
    <header>
      <h2 id="customer-success-terminal-dialog-title">
        <Label
          label={action === 'resolve_case'
            ? customerSuccess.string.ResolveCaseTitle
            : customerSuccess.string.ReopenCaseTitle}
        />
      </h2>
      <p id="customer-success-terminal-dialog-description">
        <Label label={customerSuccess.string.TerminalActionReason} />
      </p>
    </header>

    <fieldset disabled={submitting} aria-busy={submitting}>
      <legend><Label label={customerSuccess.string.TerminalActionReasonPlaceholder} /></legend>
      {#each reasons as reason, index}
        <label>
          {#if index === 0}
            <input
              bind:this={firstReason}
              type="radio"
              name="terminal-reason"
              value={reason}
              bind:group={reasonCode}
              required
            />
          {:else}
            <input type="radio" name="terminal-reason" value={reason} bind:group={reasonCode} required />
          {/if}
          <span><Label label={reasonLabel(reason)} /></span>
        </label>
      {/each}
    </fieldset>

    <label class="detail-label" for="customer-success-terminal-reason-detail">
      <span><Label label={customerSuccess.string.TerminalActionDetail} /></span>
      <textarea
        id="customer-success-terminal-reason-detail"
        bind:value={reasonDetail}
        maxlength={terminalReasonDetailMaxLength}
        rows="5"
        disabled={submitting}
        aria-describedby={statusMessage !== undefined
          ? 'customer-success-terminal-detail-limit customer-success-terminal-dialog-status'
          : 'customer-success-terminal-detail-limit'}
        aria-invalid={stale || conflict || submissionFailed}
      ></textarea>
    </label>
    <p id="customer-success-terminal-detail-limit" class="detail-limit">
      <Label label={customerSuccess.string.TerminalActionDetailLimit} />
    </p>

    {#if statusMessage !== undefined}
      <p
        bind:this={statusRegion}
        id="customer-success-terminal-dialog-status"
        class:detail-limit={!stale && !conflict && !submissionFailed && requestState === undefined}
        class:error={stale || conflict || submissionFailed || requestState === 'failed' || requestState === 'superseded'}
        role={stale || conflict || submissionFailed || requestState === 'failed' || requestState === 'superseded'
          ? 'alert'
          : 'status'}
        aria-live={stale || conflict || submissionFailed || requestState === 'failed' || requestState === 'superseded'
          ? 'assertive'
          : 'polite'}
        aria-atomic="true"
      >
        <Label label={statusMessage} />
      </p>
    {/if}

    <footer>
      <Button
        size="large"
        kind="regular"
        label={customerSuccess.string.CancelTerminalAction}
        disabled={submitting}
        on:click={close}
      />
      <Button
        size="large"
        kind={action === 'resolve_case' ? 'negative' : 'primary'}
        label={action === 'resolve_case'
          ? customerSuccess.string.ConfirmResolveCase
          : customerSuccess.string.ConfirmReopenCase}
        disabled={!reasonAllowed || submitting || stale || conflict}
        loading={submitting}
        on:click={confirm}
      />
    </footer>
  </form>
</dialog>

<style lang="scss">
  dialog {
    width: min(36rem, calc(100vw - 1rem));
    max-height: calc(100dvh - 1rem);
    padding: 0;
    border: 1px solid var(--theme-divider-color);
    border-radius: 0.5rem;
    color: var(--theme-content-color);
    background: var(--theme-panel-color);
    box-shadow: var(--theme-popup-shadow);

    &::backdrop {
      background: rgb(0 0 0 / 45%);
    }
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
    overflow: auto;
  }

  header h2,
  header p,
  .detail-limit,
  .error {
    margin: 0;
  }

  header h2 {
    font-size: 1.125rem;
    letter-spacing: 0;
  }

  header p,
  .detail-limit {
    margin-top: 0.375rem;
    color: var(--theme-halfcontent-color);
    font-size: 0.75rem;
  }

  fieldset {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    border: 0;

    legend {
      margin-bottom: 0.5rem;
      font-weight: 600;
    }

    label {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      min-height: 2rem;
    }
  }

  .detail-label {
    display: grid;
    gap: 0.5rem;
    font-weight: 600;
  }

  textarea {
    width: 100%;
    min-height: 7rem;
    box-sizing: border-box;
    resize: vertical;
    padding: 0.625rem;
    border: 1px solid var(--theme-divider-color);
    border-radius: 0.25rem;
    color: var(--theme-content-color);
    background: var(--theme-bg-color);
    font: inherit;
  }

  .error {
    color: var(--theme-error-color);
  }

  footer {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  @media (max-width: 640px) {
    dialog {
      width: calc(100vw - 0.5rem);
      max-height: calc(100dvh - 0.5rem);
    }

    form {
      padding-bottom: max(1.25rem, env(safe-area-inset-bottom));
    }

    footer {
      justify-content: stretch;

      :global(button) {
        flex: 1 1 12rem;
      }
    }
  }
</style>
