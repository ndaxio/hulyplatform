<!--
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
-->
<script lang="ts">
  import contact from '@hcengineering/contact'
  import { AssigneeBox } from '@hcengineering/contact-resources'
  import type { AssigneeCategory } from '@hcengineering/contact-resources/src/assignee'
  import customerSuccess, {
    type LiveSessionState,
    type LiveSessionStage,
    type SupportActionRequest
  } from '@hcengineering/customer-success'
  import { DateRangeMode } from '@hcengineering/core'
  import type { DocumentQuery, Ref } from '@hcengineering/core'
  import type { IntlString } from '@hcengineering/platform'
  import { Button, Component, DatePresenter, Label, StateTag, StateType } from '@hcengineering/ui'
  import type { Employee, Person } from '@hcengineering/contact'
  import type { Issue } from '@hcengineering/tracker'

  import { resolveTakeoverChromeState } from '../takeover-state'
  import {
    resolveAssignLeadControlState,
    resolveClaimSelfControlState,
    shouldShowSupportActionRequestState
  } from '../action-request'

  export let issue: Issue
  export let assignee: Ref<Person> | null
  export let projection: LiveSessionState | undefined
  export let actionRequest: SupportActionRequest | undefined
  export let currentEmployee: Person['_id'] | undefined
  export let canManageSupportActions = false
  export let canAssignLead = false
  export let submitting = false
  export let submissionFailed = false
  export let lastSubmittedAction: SupportActionRequest['action'] | undefined = undefined
  export let assignLeadCandidateQuery: DocumentQuery<Employee> | undefined = undefined
  export let assignLeadCategories: AssigneeCategory[] = []
  export let assignLeadSelection: Ref<Person> | null | undefined = undefined
  export let requestClaimSelf: () => Promise<void>
  export let requestAssignLead: (assignee: Ref<Person> | null | undefined) => Promise<void>

  $: actionIssue = { ...issue, assignee }
  $: chrome = resolveTakeoverChromeState(actionIssue, projection)
  $: claimActionIssue = {
    ...actionIssue,
    assignee: chrome.projectionCurrent ? chrome.claimOwner : actionIssue.assignee
  }
  $: recovery = recoveryLabel(chrome.recoveryState)
  $: claimSelf = resolveClaimSelfControlState(
    claimActionIssue,
    chrome,
    actionRequest,
    currentEmployee,
    canManageSupportActions,
    submitting
  )
  $: assignLead = resolveAssignLeadControlState(actionIssue, actionRequest, canAssignLead, submitting)

  function stageLabel (stage: LiveSessionStage): IntlString {
    switch (stage) {
      case 'bot_active':
        return customerSuccess.string.BotActiveQueue
      case 'shadowing':
        return customerSuccess.string.ShadowingState
      case 'takeover_requested':
        return customerSuccess.string.TakeoverRequestedQueue
      case 'human_active':
        return customerSuccess.string.HumanActiveQueue
      case 'other':
        return customerSuccess.string.TakeoverState
    }
  }

  function stageType (stage: LiveSessionStage): StateType {
    switch (stage) {
      case 'human_active':
        return StateType.Positive
      case 'takeover_requested':
        return StateType.Primary
      case 'shadowing':
        return StateType.Ghost
      default:
        return StateType.Regular
    }
  }

  function recoveryLabel (state: LiveSessionState['recoveryState']): IntlString | undefined {
    switch (state) {
      case 'unassigned':
        return customerSuccess.string.NeedsAssignment
      case 'unauthorized_assignee':
        return customerSuccess.string.UnauthorizedAssignee
      case 'lock_expired':
        return customerSuccess.string.LockExpired
      case 'none':
        return undefined
    }
  }

  function requestAction (): SupportActionRequest['action'] | undefined {
    return actionRequest?.action ?? lastSubmittedAction
  }

  function requestLabel (): IntlString | undefined {
    if (requestAction() === 'assign_assignee') {
      if (submissionFailed) return customerSuccess.string.AssignLeadRequestFailed
      if (assignLead.reconciled) return customerSuccess.string.AssignLeadConfirmed
      if (assignLead.awaitingReconciliation) return customerSuccess.string.AssignLeadRequestAwaitingReconciliation

      switch (assignLead.requestState) {
        case 'pending':
          return customerSuccess.string.AssignLeadRequestPending
        case 'processing':
          return customerSuccess.string.AssignLeadRequestProcessing
        case 'failed':
          return customerSuccess.string.AssignLeadRequestFailed
        case 'superseded':
          return customerSuccess.string.AssignLeadRequestSuperseded
        case 'succeeded':
          return customerSuccess.string.AssignLeadRequestAwaitingReconciliation
        default:
          return undefined
      }
    }

    if (submissionFailed) return customerSuccess.string.ClaimRequestFailed
    if (claimSelf.awaitingReconciliation) return customerSuccess.string.ClaimRequestAwaitingReconciliation

    switch (claimSelf.requestState) {
      case 'pending':
        return customerSuccess.string.ClaimRequestPending
      case 'processing':
        return customerSuccess.string.ClaimRequestProcessing
      case 'failed':
        return customerSuccess.string.ClaimRequestFailed
      case 'superseded':
        return customerSuccess.string.ClaimRequestSuperseded
      case 'succeeded':
        return customerSuccess.string.ClaimRequestAwaitingReconciliation
      default:
        return undefined
    }
  }

  function requestLabelType (): StateType {
    if (requestAction() === 'assign_assignee') {
      if (assignLead.reconciled) return StateType.Positive
      if (assignLead.awaitingReconciliation) return StateType.Ghost

      switch (assignLead.requestState) {
        case 'pending':
        case 'processing':
          return StateType.Primary
        case 'failed':
          return StateType.Negative
        case 'superseded':
          return StateType.Regular
        case 'succeeded':
          return StateType.Ghost
        default:
          return StateType.Regular
      }
    }

    if (claimSelf.awaitingReconciliation) return StateType.Ghost

    switch (claimSelf.requestState) {
      case 'pending':
      case 'processing':
        return StateType.Primary
      case 'failed':
        return StateType.Negative
      case 'superseded':
        return StateType.Regular
      case 'succeeded':
        return StateType.Ghost
      default:
        return StateType.Regular
    }
  }

  function requestTitleLabel (): IntlString {
    return requestAction() === 'assign_assignee'
      ? customerSuccess.string.AssignLeadRequest
      : customerSuccess.string.ClaimRequest
  }

  function shouldShowRequestLabel (): boolean {
    return shouldShowSupportActionRequestState(
      requestAction(),
      requestLabel() !== undefined,
      canManageSupportActions,
      canAssignLead
    )
  }

  function requestLabelOrFallback (): IntlString {
    return requestLabel() ?? customerSuccess.string.ReconciliationPending
  }

  function handleAssignLeadChange (event: CustomEvent<Ref<Person> | null | undefined>): void {
    if (!assignLead.canSubmit || event.detail == null) return
    void requestAssignLead(event.detail)
  }
</script>

{#if chrome.stage !== 'other' || claimSelf.visible || assignLead.visible || shouldShowRequestLabel()}
  <section class="takeover-state" aria-labelledby="customer-success-takeover-state-heading">
    <div class="takeover-heading">
      <div class="heading-summary">
        <h2 id="customer-success-takeover-state-heading"><Label label={customerSuccess.string.TakeoverState} /></h2>
        <span class="state-tag">
          <StateTag
            label={chrome.reconciliationPending
              ? customerSuccess.string.ReconciliationPending
              : stageLabel(chrome.stage)}
            type={stageType(chrome.stage)}
          />
        </span>
      </div>
      <div class="takeover-actions">
        {#if claimSelf.visible}
          <Button
            size="small"
            kind="primary"
            label={customerSuccess.string.ClaimSelf}
            disabled={!claimSelf.canSubmit}
            loading={claimSelf.busy}
            on:click={() => {
              void requestClaimSelf()
            }}
          />
        {/if}
        {#if assignLead.visible && assignLeadCandidateQuery !== undefined}
          <div
            class="assign-lead"
            role="group"
            aria-labelledby="customer-success-assign-lead-label"
            aria-describedby={requestAction() === 'assign_assignee' && requestLabel() !== undefined
              ? 'customer-success-assign-lead-status'
              : undefined}
            aria-disabled={!assignLead.canSubmit}
            aria-busy={assignLead.busy}
          >
            <span id="customer-success-assign-lead-label" class="sr-only">
              <Label label={customerSuccess.string.AssignLead} />
            </span>
            <AssigneeBox
              id="customer-success-assign-lead-picker"
              docQuery={assignLeadCandidateQuery}
              categories={assignLeadCategories}
              label={customerSuccess.string.AssignLead}
              placeholder={customerSuccess.string.AssignLeadPlaceholder}
              value={assignLeadSelection}
              allowDeselect={false}
              size="small"
              kind="regular"
              width="15rem"
              readonly={!assignLead.canSubmit}
              showNavigate={false}
              justify="left"
              on:change={handleAssignLeadChange}
            />
          </div>
        {/if}
      </div>
    </div>

    <dl>
      {#if chrome.claimOwner !== null}
        <div>
          <dt>
            <Label
              label={chrome.stage === 'takeover_requested'
                ? customerSuccess.string.ClaimOwner
                : customerSuccess.string.Assignee}
            />
          </dt>
          <dd>
            <Component
              is={contact.component.EmployeePresenter}
              props={{
                value: chrome.claimOwner,
                disabled: true,
                avatarSize: 'card',
                shouldShowName: true,
                shouldShowPlaceholder: false
              }}
            />
          </dd>
        </div>
      {/if}

      {#if chrome.pendingAcknowledgement}
        <div>
          <dt><Label label={customerSuccess.string.PendingAcknowledgement} /></dt>
          <dd class="state-tag">
            <StateTag label={customerSuccess.string.PendingAcknowledgement} type={StateType.Primary} />
          </dd>
        </div>
      {:else if chrome.confirmed}
        <div>
          <dt><Label label={customerSuccess.string.TakeoverConfirmed} /></dt>
          <dd class="state-tag">
            <StateTag label={customerSuccess.string.TakeoverConfirmed} type={StateType.Positive} />
          </dd>
        </div>
      {/if}

      {#if chrome.expiresAt !== undefined}
        <div>
          <dt><Label label={customerSuccess.string.AcknowledgementExpiry} /></dt>
          <dd><DatePresenter value={chrome.expiresAt} mode={DateRangeMode.DATETIME} kind="ghost" size="small" /></dd>
        </div>
      {/if}

      {#if chrome.expired}
        <div>
          <dt><Label label={customerSuccess.string.RecoveryState} /></dt>
          <dd class="state-tag"><StateTag label={customerSuccess.string.LockExpired} type={StateType.Negative} /></dd>
        </div>
      {:else if recovery !== undefined}
        <div>
          <dt><Label label={customerSuccess.string.RecoveryState} /></dt>
          <dd class="state-tag"><StateTag label={recovery} type={StateType.Negative} /></dd>
        </div>
      {/if}

      {#if shouldShowRequestLabel()}
        <div>
          <dt><Label label={requestTitleLabel()} /></dt>
          <dd
            class="state-tag"
            id={requestAction() === 'assign_assignee' ? 'customer-success-assign-lead-status' : undefined}
          >
            <StateTag label={requestLabelOrFallback()} type={requestLabelType()} />
          </dd>
        </div>
      {/if}
    </dl>
  </section>
{/if}

<style lang="scss">
  .takeover-state {
    flex: 0 0 auto;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--theme-divider-color);
    background: var(--theme-comp-header-color);
  }

  .takeover-heading,
  dl,
  dl > div {
    display: flex;
    align-items: center;
  }

  .heading-summary {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
    flex-wrap: wrap;
  }

  .takeover-heading {
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;

    h2 {
      margin: 0;
      font-size: 0.875rem;
      font-weight: 600;
      letter-spacing: 0;
    }
  }

  .takeover-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.75rem;
    align-items: center;
  }

  .assign-lead {
    min-width: min(15rem, 100%);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  dl {
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    margin: 0.5rem 0 0;

    > div {
      min-width: 0;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    dt {
      color: var(--theme-halfcontent-color);
      font-size: 0.75rem;
    }

    dd {
      min-width: 0;
      margin: 0;
    }
  }

  .state-tag {
    min-width: 0;
    max-width: 100%;

    :global(.root) {
      width: auto;
      max-width: 100%;
      white-space: normal;
      overflow-wrap: anywhere;
    }
  }
</style>
