<!--
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
-->
<script lang="ts">
  import activity, { type ActivityMessage } from '@hcengineering/activity'
  import { getCurrentEmployee, type Employee, type Person } from '@hcengineering/contact'
  import { employeeByIdStore, employeeRefByAccountUuidStore } from '@hcengineering/contact-resources'
  import type { AssigneeCategory } from '@hcengineering/contact-resources/src/assignee'
  import customerSuccess, {
    type ConversationEvent,
    type ConversationProjectionSpace,
    type LiveSessionState,
    type SupportLifecycleReasonCode,
    type SupportActionRequest
  } from '@hcengineering/customer-success'
  import core, {
    DateRangeMode,
    SortingOrder,
    generateId,
    getCurrentAccount,
    type DocumentQuery,
    type AccountUuid,
    type Ref,
    type WithLookup
  } from '@hcengineering/core'
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
  import { onDestroy, tick } from 'svelte'

  import {
    buildConversationHistoryQuery,
    buildConversationHistoryFindOptions,
    buildConversationHistoryPageQuery,
    buildConversationIssueQuery,
    buildConversationEventFindOptions,
    buildConversationPageQuery,
    buildConversationTranscriptQuery,
    captureConversationScrollAnchor,
    carryForwardOverlappingConversationHead,
    cursorForConversationEvent,
    emptyConversationComposerDrafts,
    LatestConversationRequest,
    mergeConversationEventPages,
    mergeConversationHistoryPages,
    nextConversationDetailLane,
    resolveConversationScrollTop,
    sortConversationEntriesAscending,
    visibleConversationEntries,
    type ConversationEntryDoc,
    type ConversationEntryLane,
    type ConversationComposerAction,
    type ConversationComposerDrafts,
    type ConversationVisibilityLane
  } from '../conversation-detail'
  import {
    buildSupportActionRequestHydrationQuery,
    buildSupportActionRequestQuery,
    buildAssignLeadCandidateQuery,
    conversationComposerRequestSpace,
    conversationMessageDeliveryId,
    conversationMessageSupportActionRequestId,
    canonicalSupportAssignee,
    resolveConversationComposerControlState,
    selectHydratedSupportActionRequestId,
    resolveSupportActionRoleAssignments,
    shouldClearConversationComposerDraft,
    claimSelfSupportActionRequestId,
    isLiveSessionConfirmed,
    isRestrictedSupportActionRoleMember,
    shouldReleaseActiveSupportActionRequest,
    submitAssignAssigneeSupportActionRequest,
    submitClaimSelfSupportActionRequest,
    submitConversationMessageSupportActionRequest,
    submitReassignAssigneeSupportActionRequest,
    submitTerminalSupportActionRequest,
    submitTransitionStatusSupportActionRequest,
    type TerminalAction
  } from '../action-request'
  import { buildLiveSessionStateQuery, resolveTakeoverChromeState } from '../takeover-state'
  import ConversationComposer from './ConversationComposer.svelte'
  import TakeoverStateChrome from './TakeoverStateChrome.svelte'

  export let issueIdentifier: string
  export let projectId: Ref<Project>
  export let projectionSpaceIds: Record<ConversationVisibilityLane, Ref<ConversationProjectionSpace>>
  export let onClose: () => void
  export let initialComposerDrafts: ConversationComposerDrafts = emptyConversationComposerDrafts()
  export let onComposerDraftChange: (action: ConversationComposerAction, draft: string) => void = () => {}

  type DetailState = 'loading' | 'ready' | 'denied' | 'error'
  type SupportConversationEvent = ConversationEvent & ConversationEntryDoc
  const composerActions = ['post_public_reply', 'post_internal_note', 'post_restricted_note'] as const
  type ComposerAction = (typeof composerActions)[number]
  interface VisibleMessage {
    message: SupportConversationEvent
    lane: ConversationEntryLane
    visibility: ConversationVisibilityLane
  }

  const client = getClient()
  const transcriptQueries = {
    public: createQuery(),
    internal: createQuery(),
    restricted: createQuery()
  }
  const issueQuery = createQuery()
  const statusQuery = createQuery()
  const liveSessionQuery = createQuery()
  const internalProjectionSpaceQuery = createQuery()
  const restrictedProjectionSpaceQuery = createQuery()
  const supportActionRequestQuery = createQuery()
  const supportActionRequestHydrationQuery = createQuery()
  const composerRequestQueries = {
    post_public_reply: createQuery(),
    post_internal_note: createQuery(),
    post_restricted_note: createQuery()
  }
  const historyQuery = createQuery()
  const paginationRequest = new LatestConversationRequest()
  const historyPaginationRequest = new LatestConversationRequest()
  const currentAccount = getCurrentAccount()
  const currentEmployee = getCurrentEmployee()
  const hierarchy = client.getHierarchy()
  const supportActionRequestObservationTimeoutMs = 8000

  let state: DetailState = 'loading'
  let issue: Issue | undefined
  let issueStatus: IssueStatus | undefined
  let liveSessionState: LiveSessionState | undefined
  let internalProjectionSpace: WithLookup<ConversationProjectionSpace> | undefined
  let restrictedProjectionSpace: WithLookup<ConversationProjectionSpace> | undefined
  let supportActionRequest: SupportActionRequest | undefined
  let subscribedIssueId: Ref<Issue> | undefined
  let visibleMessages: VisibleMessage[] = []
  let headMessages: Record<ConversationVisibilityLane, SupportConversationEvent[]> = {
    public: [],
    internal: [],
    restricted: []
  }
  let historicalMessages: Record<ConversationVisibilityLane, SupportConversationEvent[]> = {
    public: [],
    internal: [],
    restricted: []
  }
  let transcriptLaneLoaded: Record<ConversationVisibilityLane, boolean> = {
    public: false,
    internal: false,
    restricted: false
  }
  let canLoadEarlier: Record<ConversationVisibilityLane, boolean> = {
    public: false,
    internal: false,
    restricted: false
  }
  let history: ActivityMessage[] = []
  let transcriptLoading = true
  let earlierLoading = false
  let earlierLoadFailed = false
  let historyLoading = true
  let historyCanLoadEarlier = false
  let historyEarlierLoading = false
  let historyEarlierLoadFailed = false
  let mobileLane: 'conversation' | 'activity' = 'conversation'
  let canManageSupportActions = false
  let canManageRestrictedActions = false
  let canAssignLead = false
  let assigneeInActiveRoster = false
  let trackedInternalProjectionSpaceId: Ref<ConversationProjectionSpace> | undefined
  let trackedRestrictedProjectionSpaceId: Ref<ConversationProjectionSpace> | undefined
  let trackedSupportActionRequestId: Ref<SupportActionRequest> | undefined
  let trackedSupportActionRequestHydrationKey: string | undefined
  let activeSupportActionRequestId: Ref<SupportActionRequest> | undefined
  let hydratedSupportActionRequestId: Ref<SupportActionRequest> | undefined
  let actionSubmitting = false
  let actionSubmissionFailed = false
  let lastSubmittedAction: SupportActionRequest['action'] | undefined
  let assignLeadCandidateQuery: DocumentQuery<Employee> | undefined
  let assignLeadCategories: AssigneeCategory[] = []
  let assignLeadSelection: Ref<Person> | null | undefined = undefined
  let canonicalIssueAssignee: Ref<Person> | null = null
  let supportActionRoles = {
    supportAgent: [] as AccountUuid[],
    supportLead: [] as AccountUuid[],
    compliance: [] as AccountUuid[]
  }
  let assignLeadLeadCandidates: Array<Ref<Person>> = []
  let assignLeadAgentCandidates: Array<Ref<Person>> = []
  let assignLeadCandidates: Array<Ref<Person>> = []
  let conversationTab: HTMLButtonElement
  let activityTab: HTMLButtonElement
  let conversationScroll: HTMLElement | undefined
  let activityScroll: HTMLElement | undefined
  let conversationScrollRestoreSequence = 0
  let supportActionRequestObservationTimeout: ReturnType<typeof setTimeout> | undefined
  let composerDrafts: Record<ComposerAction, string> = { ...initialComposerDrafts }
  let composerDeliveryIds: Record<ComposerAction, string | undefined> = {
    post_public_reply: undefined,
    post_internal_note: undefined,
    post_restricted_note: undefined
  }
  let composerRequestIds: Record<ComposerAction, Ref<SupportActionRequest> | undefined> = {
    post_public_reply: undefined,
    post_internal_note: undefined,
    post_restricted_note: undefined
  }
  let trackedComposerRequestIds: Record<ComposerAction, Ref<SupportActionRequest> | undefined> = {
    post_public_reply: undefined,
    post_internal_note: undefined,
    post_restricted_note: undefined
  }
  let composerRequests: Record<ComposerAction, SupportActionRequest | undefined> = {
    post_public_reply: undefined,
    post_internal_note: undefined,
    post_restricted_note: undefined
  }
  let composerSubmitting: Record<ComposerAction, boolean> = {
    post_public_reply: false,
    post_internal_note: false,
    post_restricted_note: false
  }
  let composerSubmissionFailed: Record<ComposerAction, boolean> = {
    post_public_reply: false,
    post_internal_note: false,
    post_restricted_note: false
  }
  let composerObservationTimeouts: Partial<Record<ComposerAction, ReturnType<typeof setTimeout>>> = {}
  let currentEmployeeActive = false
  let publicReplyComposerState = resolveConversationComposerControlState(
    'post_public_reply',
    {
      _id: 'issue:none' as Ref<Issue>,
      status: tracker.status.Backlog as Ref<IssueStatus>,
      assignee: null,
      modifiedOn: 0
    },
    resolveTakeoverChromeState({
      _id: 'issue:none' as Ref<Issue>,
      status: tracker.status.Backlog as Ref<IssueStatus>,
      assignee: null,
      modifiedOn: 0
    }),
    undefined,
    undefined,
    false,
    false,
    false,
    false
  )
  let internalNoteComposerState = resolveConversationComposerControlState(
    'post_internal_note',
    {
      _id: 'issue:none' as Ref<Issue>,
      status: tracker.status.Backlog as Ref<IssueStatus>,
      assignee: null,
      modifiedOn: 0
    },
    resolveTakeoverChromeState({
      _id: 'issue:none' as Ref<Issue>,
      status: tracker.status.Backlog as Ref<IssueStatus>,
      assignee: null,
      modifiedOn: 0
    }),
    undefined,
    undefined,
    false,
    false,
    false,
    false
  )
  let restrictedNoteComposerState = resolveConversationComposerControlState(
    'post_restricted_note',
    {
      _id: 'issue:none' as Ref<Issue>,
      status: tracker.status.Backlog as Ref<IssueStatus>,
      assignee: null,
      modifiedOn: 0
    },
    resolveTakeoverChromeState({
      _id: 'issue:none' as Ref<Issue>,
      status: tracker.status.Backlog as Ref<IssueStatus>,
      assignee: null,
      modifiedOn: 0
    }),
    undefined,
    undefined,
    false,
    false,
    false,
    false
  )

  function uniquePersons (
    accounts: AccountUuid[],
    employeeRefs: ReadonlyMap<AccountUuid, Ref<Employee>>
  ): Array<Ref<Person>> {
    return Array.from(
      new Set(
        accounts
          .map((account) => employeeRefs.get(account) as Ref<Person> | undefined)
          .filter((person): person is Ref<Person> => person !== undefined)
      )
    )
  }

  function composerVisibility (action: ComposerAction): ConversationVisibilityLane {
    if (action === 'post_public_reply') return 'public'
    if (action === 'post_restricted_note') return 'restricted'
    return 'internal'
  }

  function composerRequestSpace (action: ComposerAction): Ref<ConversationProjectionSpace> {
    return conversationComposerRequestSpace(action, projectionSpaceIds.internal, projectionSpaceIds.restricted)
  }

  function canManageComposerAction (action: ComposerAction): boolean {
    return action === 'post_restricted_note' ? canManageRestrictedActions : canManageSupportActions
  }

  function conversationEventObserved (visibility: ConversationVisibilityLane, eventId: string | undefined): boolean {
    if (eventId === undefined) return false
    return mergeConversationEventPages(headMessages[visibility], historicalMessages[visibility]).some(
      (event) => event.eventId === eventId
    )
  }

  function setComposerDraft (action: ComposerAction, value: string): void {
    const previous = composerDrafts[action]
    composerDrafts = { ...composerDrafts, [action]: value }
    onComposerDraftChange(action, value)
    if (value !== previous) {
      composerSubmissionFailed = { ...composerSubmissionFailed, [action]: false }
    }

    if (value.trim().length === 0) {
      if (!composerSubmitting[action]) {
        composerDeliveryIds = { ...composerDeliveryIds, [action]: undefined }
        composerRequests = { ...composerRequests, [action]: undefined }
        composerRequestIds = { ...composerRequestIds, [action]: undefined }
        trackedComposerRequestIds = { ...trackedComposerRequestIds, [action]: undefined }
        composerRequestQueries[action].unsubscribe()
      }
      return
    }

    if (composerDeliveryIds[action] === undefined && issue !== undefined) {
      composerDeliveryIds = {
        ...composerDeliveryIds,
        [action]: conversationMessageDeliveryId(issue._id, currentAccount.uuid, action, generateId())
      }
      composerRequests = { ...composerRequests, [action]: undefined }
      composerRequestIds = { ...composerRequestIds, [action]: undefined }
      trackedComposerRequestIds = { ...trackedComposerRequestIds, [action]: undefined }
      composerRequestQueries[action].unsubscribe()
    }
  }

  function ensureComposerDeliveryIds (target: Issue): void {
    let changed = false
    const next = { ...composerDeliveryIds }
    for (const action of composerActions) {
      if (composerDrafts[action].trim().length === 0 || next[action] !== undefined) continue
      next[action] = conversationMessageDeliveryId(target._id, currentAccount.uuid, action, generateId())
      changed = true
    }
    if (changed) composerDeliveryIds = next
  }

  function stopLaneQueries (): void {
    paginationRequest.invalidate()
    historyPaginationRequest.invalidate()
    conversationScrollRestoreSequence += 1
    for (const query of Object.values(transcriptQueries)) query.unsubscribe()
    for (const query of Object.values(composerRequestQueries)) query.unsubscribe()
    historyQuery.unsubscribe()
    visibleMessages = []
    headMessages = { public: [], internal: [], restricted: [] }
    historicalMessages = { public: [], internal: [], restricted: [] }
    transcriptLaneLoaded = { public: false, internal: false, restricted: false }
    canLoadEarlier = { public: false, internal: false, restricted: false }
    earlierLoading = false
    earlierLoadFailed = false
    history = []
    historyCanLoadEarlier = false
    historyEarlierLoading = false
    historyEarlierLoadFailed = false
    subscribedIssueId = undefined
    trackedSupportActionRequestId = undefined
    trackedSupportActionRequestHydrationKey = undefined
    activeSupportActionRequestId = undefined
    hydratedSupportActionRequestId = undefined
    actionSubmitting = false
    actionSubmissionFailed = false
    lastSubmittedAction = undefined
    assignLeadSelection = undefined
    supportActionRequest = undefined
    supportActionRequestQuery.unsubscribe()
    supportActionRequestHydrationQuery.unsubscribe()
    clearSupportActionRequestObservationTimeout()
    for (const action of composerActions) {
      clearComposerObservationTimeout(action)
    }
    composerDeliveryIds = {
      post_public_reply: undefined,
      post_internal_note: undefined,
      post_restricted_note: undefined
    }
    composerRequestIds = {
      post_public_reply: undefined,
      post_internal_note: undefined,
      post_restricted_note: undefined
    }
    trackedComposerRequestIds = {
      post_public_reply: undefined,
      post_internal_note: undefined,
      post_restricted_note: undefined
    }
    composerRequests = {
      post_public_reply: undefined,
      post_internal_note: undefined,
      post_restricted_note: undefined
    }
    composerSubmitting = {
      post_public_reply: false,
      post_internal_note: false,
      post_restricted_note: false
    }
    composerSubmissionFailed = {
      post_public_reply: false,
      post_internal_note: false,
      post_restricted_note: false
    }
  }

  function stopAllQueries (): void {
    stopLaneQueries()
    issueQuery.unsubscribe()
    statusQuery.unsubscribe()
    liveSessionQuery.unsubscribe()
    internalProjectionSpaceQuery.unsubscribe()
    restrictedProjectionSpaceQuery.unsubscribe()
  }

  function clearSupportActionRequestObservationTimeout (): void {
    if (supportActionRequestObservationTimeout !== undefined) {
      clearTimeout(supportActionRequestObservationTimeout)
      supportActionRequestObservationTimeout = undefined
    }
  }

  function armSupportActionRequestObservationTimeout (requestId: Ref<SupportActionRequest>): void {
    clearSupportActionRequestObservationTimeout()
    supportActionRequestObservationTimeout = setTimeout(() => {
      if (
        activeSupportActionRequestId !== requestId ||
        trackedSupportActionRequestId !== requestId ||
        !actionSubmitting
      ) {
        return
      }
      actionSubmitting = false
      actionSubmissionFailed = true
    }, supportActionRequestObservationTimeoutMs)
  }

  function clearComposerObservationTimeout (action: ComposerAction): void {
    const timeout = composerObservationTimeouts[action]
    if (timeout !== undefined) {
      clearTimeout(timeout)
      composerObservationTimeouts = { ...composerObservationTimeouts, [action]: undefined }
    }
  }

  function armComposerObservationTimeout (action: ComposerAction, requestId: Ref<SupportActionRequest>): void {
    clearComposerObservationTimeout(action)
    composerObservationTimeouts[action] = setTimeout(() => {
      if (composerRequestIds[action] !== requestId || trackedComposerRequestIds[action] !== requestId) return
      if (!composerSubmitting[action]) return
      composerSubmitting = { ...composerSubmitting, [action]: false }
      composerSubmissionFailed = { ...composerSubmissionFailed, [action]: true }
    }, supportActionRequestObservationTimeoutMs)
  }

  function watchIssue (identifier: string, supportProjectId: Ref<Project>): void {
    const query = buildConversationIssueQuery(supportProjectId, identifier)
    stopLaneQueries()
    issue = undefined
    issueStatus = undefined
    liveSessionState = undefined
    supportActionRequest = undefined

    if (query === undefined) {
      issueQuery.unsubscribe()
      state = 'denied'
      return
    }

    state = 'loading'
    issueQuery.query(
      tracker.class.Issue,
      query,
      (result) => {
        const loaded = result[0]
        if (loaded === undefined) {
          issue = undefined
          issueStatus = undefined
          liveSessionState = undefined
          state = 'denied'
          return
        }
        issue = loaded
        state = 'ready'
      },
      { limit: 1 }
    )
  }

  function watchIssueStatus (target: Issue): void {
    const targetId = target._id
    const targetStatus = target.status
    if (issueStatus?._id !== targetStatus) issueStatus = undefined
    statusQuery.query(
      tracker.class.IssueStatus,
      { _id: targetStatus },
      (result) => {
        if (issue?._id !== targetId || issue.status !== targetStatus) return
        issueStatus = result[0]
      },
      { limit: 1 }
    )
  }

  function watchLiveSessionState (target: Issue): void {
    const targetId = target._id
    liveSessionQuery.query(
      customerSuccess.class.LiveSessionState,
      buildLiveSessionStateQuery(projectionSpaceIds.internal, targetId),
      (result) => {
        if (issue?._id !== targetId) return
        liveSessionState = result[0]
      },
      { limit: 1, sort: { observedAt: SortingOrder.Descending } }
    )
  }

  function watchInternalProjectionSpace (spaceId: Ref<ConversationProjectionSpace>): void {
    internalProjectionSpaceQuery.query(
      customerSuccess.class.ConversationProjectionSpace,
      { _id: spaceId },
      (result) => {
        internalProjectionSpace = result[0] as WithLookup<ConversationProjectionSpace> | undefined
      },
      {
        limit: 1,
        lookup: {
          type: [core.class.SpaceType, { _id: { roles: core.class.Role } }]
        }
      }
    )
  }

  function watchRestrictedProjectionSpace (spaceId: Ref<ConversationProjectionSpace>): void {
    restrictedProjectionSpaceQuery.query(
      customerSuccess.class.ConversationProjectionSpace,
      { _id: spaceId },
      (result) => {
        restrictedProjectionSpace = result[0] as WithLookup<ConversationProjectionSpace> | undefined
      },
      {
        limit: 1,
        lookup: {
          type: [core.class.SpaceType, { _id: { roles: core.class.Role } }]
        }
      }
    )
  }

  function watchSupportActionRequest (target: Issue, requestId: Ref<SupportActionRequest>): void {
    trackedSupportActionRequestId = requestId
    supportActionRequestQuery.query(
      customerSuccess.class.SupportActionRequest,
      buildSupportActionRequestQuery(projectionSpaceIds.internal, requestId, target._id),
      (result) => {
        if (issue?._id !== target._id || trackedSupportActionRequestId !== requestId) return
        const observed = result[0]
        if (observed === undefined) {
          if (activeSupportActionRequestId === requestId && actionSubmitting) return
          supportActionRequest = undefined
          return
        }
        supportActionRequest = observed
        clearSupportActionRequestObservationTimeout()
        actionSubmitting = false
        actionSubmissionFailed = false
      },
      { limit: 1 }
    )
  }

  function watchSupportActionRequestHydration (target: Issue, canonicalAssignee: Ref<Person> | null): void {
    const hydrationKey = `${projectionSpaceIds.internal}:${target._id}:${currentAccount.uuid}:${target.modifiedOn}:${canonicalAssignee ?? 'none'}`
    trackedSupportActionRequestHydrationKey = hydrationKey
    supportActionRequestHydrationQuery.query(
      customerSuccess.class.SupportActionRequest,
      buildSupportActionRequestHydrationQuery(projectionSpaceIds.internal, target._id, currentAccount.uuid),
      (result) => {
        if (
          issue?._id !== target._id ||
          issue.modifiedOn !== target.modifiedOn ||
          trackedSupportActionRequestHydrationKey !== hydrationKey
        ) {
          return
        }

        hydratedSupportActionRequestId = selectHydratedSupportActionRequestId(result as SupportActionRequest[], {
          ...target,
          assignee: canonicalAssignee
        })
      },
      {
        limit: 20,
        sort: {
          modifiedOn: SortingOrder.Descending,
          _id: SortingOrder.Ascending
        }
      }
    )
  }

  function watchComposerRequest (action: ComposerAction, target: Issue, requestId: Ref<SupportActionRequest>): void {
    trackedComposerRequestIds = { ...trackedComposerRequestIds, [action]: requestId }
    composerRequestQueries[action].query(
      customerSuccess.class.SupportActionRequest,
      buildSupportActionRequestQuery(composerRequestSpace(action), requestId, target._id),
      (result) => {
        if (issue?._id !== target._id || trackedComposerRequestIds[action] !== requestId) return
        const observed = result[0]
        if (observed === undefined) {
          if (composerRequestIds[action] === requestId && composerSubmitting[action]) return
          composerRequests = { ...composerRequests, [action]: undefined }
          return
        }
        composerRequests = { ...composerRequests, [action]: observed }
        clearComposerObservationTimeout(action)
        composerSubmitting = { ...composerSubmitting, [action]: false }
        composerSubmissionFailed = { ...composerSubmissionFailed, [action]: false }
      },
      { limit: 1 }
    )
  }

  function watchTranscript (target: Issue): void {
    transcriptLoading = true
    const targetId = target._id
    for (const visibility of ['public', 'internal', 'restricted'] as const) {
      transcriptQueries[visibility].query(
        customerSuccess.class.ConversationEvent,
        buildConversationTranscriptQuery(
          projectionSpaceIds[visibility],
          target._id,
          visibility
        ) as DocumentQuery<ConversationEvent>,
        (result) => {
          if (issue?._id !== targetId) return
          const nextHead = result as SupportConversationEvent[]
          historicalMessages = {
            ...historicalMessages,
            [visibility]: carryForwardOverlappingConversationHead(
              historicalMessages[visibility],
              headMessages[visibility],
              nextHead
            )
          }
          headMessages = { ...headMessages, [visibility]: nextHead }
          transcriptLaneLoaded = { ...transcriptLaneLoaded, [visibility]: true }
          canLoadEarlier = {
            ...canLoadEarlier,
            [visibility]: result.length === buildConversationEventFindOptions().limit
          }
          refreshVisibleMessages()
          transcriptLoading = !Object.values(transcriptLaneLoaded).every(Boolean)
        },
        buildConversationEventFindOptions()
      )
    }
  }

  function refreshVisibleMessages (update: 'live' | 'prepend' = 'live'): void {
    const anchor =
      conversationScroll === undefined
        ? undefined
        : captureConversationScrollAnchor({
            scrollTop: conversationScroll.scrollTop,
            scrollHeight: conversationScroll.scrollHeight,
            clientHeight: conversationScroll.clientHeight
          })
    visibleMessages = visibleConversationEntries(
      mergeConversationEventPages(...Object.values(headMessages), ...Object.values(historicalMessages))
    )
    if (anchor === undefined) return
    const sequence = ++conversationScrollRestoreSequence
    void tick().then(() => {
      if (sequence !== conversationScrollRestoreSequence || conversationScroll === undefined) return
      conversationScroll.scrollTop = resolveConversationScrollTop(anchor, conversationScroll.scrollHeight, update)
    })
  }

  async function loadEarlierMessages (): Promise<void> {
    if (issue === undefined || earlierLoading) return
    const targetId = issue._id
    earlierLoading = true
    earlierLoadFailed = false
    try {
      const result = await paginationRequest.run(async () => {
        let nextHistorical = { ...historicalMessages }
        let nextCanLoadEarlier = { ...canLoadEarlier }
        for (const visibility of ['public', 'internal', 'restricted'] as const) {
          if (!nextCanLoadEarlier[visibility]) continue
          const current = mergeConversationEventPages(headMessages[visibility], nextHistorical[visibility])
          const oldest = current[0]
          if (oldest === undefined) continue
          const context = {
            issueId: targetId,
            spaceId: projectionSpaceIds[visibility],
            visibility
          }
          const cursor = cursorForConversationEvent(context, oldest)
          const query = buildConversationPageQuery(context, cursor, 'before')
          if (query === undefined) continue
          const page = (await client.findAll(
            customerSuccess.class.ConversationEvent,
            query as DocumentQuery<ConversationEvent>,
            buildConversationEventFindOptions()
          )) as SupportConversationEvent[]
          nextHistorical = {
            ...nextHistorical,
            [visibility]: mergeConversationEventPages(nextHistorical[visibility], page)
          }
          nextCanLoadEarlier = {
            ...nextCanLoadEarlier,
            [visibility]: page.length === buildConversationEventFindOptions().limit
          }
        }
        return { historicalMessages: nextHistorical, canLoadEarlier: nextCanLoadEarlier }
      })
      if (result === undefined || issue?._id !== targetId) return
      historicalMessages = result.historicalMessages
      canLoadEarlier = result.canLoadEarlier
      refreshVisibleMessages('prepend')
    } catch {
      if (issue?._id === targetId) earlierLoadFailed = true
    } finally {
      if (issue?._id === targetId) earlierLoading = false
    }
  }

  function watchHistory (target: Issue): void {
    historyLoading = true
    const targetId = target._id
    historyQuery.query(
      activity.class.ActivityMessage,
      buildConversationHistoryQuery(projectId, target._id) as DocumentQuery<ActivityMessage>,
      (result) => {
        if (issue?._id !== targetId) return
        history = sortConversationEntriesAscending(result as unknown as ActivityMessage[])
        historyCanLoadEarlier = result.length === buildConversationHistoryFindOptions().limit
        historyLoading = false
      },
      buildConversationHistoryFindOptions()
    )
  }

  async function loadEarlierHistory (): Promise<void> {
    if (issue === undefined || historyEarlierLoading || !historyCanLoadEarlier) return
    const targetId = issue._id
    const oldest = history[0]
    if (oldest === undefined) return
    const query = buildConversationHistoryPageQuery(projectId, targetId, oldest)
    if (query === undefined) {
      historyCanLoadEarlier = false
      return
    }

    historyEarlierLoading = true
    historyEarlierLoadFailed = false
    try {
      const page = await historyPaginationRequest.run(
        async () =>
          (await client.findAll(
            activity.class.ActivityMessage,
            query as DocumentQuery<ActivityMessage>,
            buildConversationHistoryFindOptions()
          )) as unknown as ActivityMessage[]
      )
      if (page === undefined || issue?._id !== targetId) return
      history = mergeConversationHistoryPages(history, page)
      historyCanLoadEarlier = page.length === buildConversationHistoryFindOptions().limit
    } catch {
      if (issue?._id === targetId) historyEarlierLoadFailed = true
    } finally {
      if (issue?._id === targetId) historyEarlierLoading = false
    }
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

  function visibilityLabel (visibility: ConversationVisibilityLane): IntlString {
    switch (visibility) {
      case 'public':
        return customerSuccess.string.PublicVisibility
      case 'internal':
        return customerSuccess.string.InternalVisibility
      case 'restricted':
        return customerSuccess.string.RestrictedVisibility
    }
  }

  function selectMobileLane (lane: 'conversation' | 'activity', focus = false): void {
    mobileLane = lane
    if (focus) {
      setTimeout(() => {
        ;(lane === 'conversation' ? conversationTab : activityTab)?.focus()
      })
    }
  }

  function handleMobileLaneKeydown (event: KeyboardEvent): void {
    const nextLane = nextConversationDetailLane(mobileLane, event.key)
    if (nextLane === undefined) return
    event.preventDefault()
    selectMobileLane(nextLane, true)
  }

  function configureTimelineRegion (element: HTMLElement | undefined, labelledBy: string): void {
    if (element === undefined) return
    element.tabIndex = 0
    element.setAttribute('role', 'region')
    element.setAttribute('aria-labelledby', labelledBy)
  }

  $: configureTimelineRegion(conversationScroll, 'customer-success-conversation-heading')
  $: configureTimelineRegion(activityScroll, 'customer-success-activity-heading')

  function refreshDetail (): void {
    paginationRequest.invalidate()
    historyPaginationRequest.invalidate()
    issueQuery.refreshClient()
    statusQuery.refreshClient()
    liveSessionQuery.refreshClient()
    internalProjectionSpaceQuery.refreshClient()
    restrictedProjectionSpaceQuery.refreshClient()
    supportActionRequestQuery.refreshClient()
    supportActionRequestHydrationQuery.refreshClient()
    historyQuery.refreshClient()
    for (const query of Object.values(transcriptQueries)) query.refreshClient()
    for (const query of Object.values(composerRequestQueries)) query.refreshClient()
  }

  function releaseStaleSupportActionRequest (): void {
    activeSupportActionRequestId = undefined
    hydratedSupportActionRequestId = undefined
    trackedSupportActionRequestId = undefined
  }

  async function requestClaimSelf (): Promise<void> {
    if (issue === undefined || currentEmployee === undefined || !canManageSupportActions || actionSubmitting) return

    lastSubmittedAction = 'claim_self'
    actionSubmitting = true
    actionSubmissionFailed = false
    try {
      const { requestId, committed } = await submitClaimSelfSupportActionRequest(
        client,
        projectionSpaceIds.internal,
        { ...issue, assignee: canonicalIssueAssignee },
        currentAccount.uuid,
        currentEmployee
      )
      activeSupportActionRequestId = requestId
      trackedSupportActionRequestId = undefined
      if (!committed.result) {
        clearSupportActionRequestObservationTimeout()
        actionSubmitting = false
        supportActionRequestQuery.refreshClient()
      } else {
        armSupportActionRequestObservationTimeout(requestId)
      }
    } catch {
      clearSupportActionRequestObservationTimeout()
      actionSubmitting = false
      actionSubmissionFailed = true
    }
  }

  async function requestAssignLead (requestedAssignee: Ref<Person> | null | undefined): Promise<void> {
    if (
      issue === undefined ||
      requestedAssignee == null ||
      issue.assignee !== null ||
      !canAssignLead ||
      actionSubmitting
    ) {
      return
    }

    lastSubmittedAction = 'assign_assignee'
    assignLeadSelection = requestedAssignee
    actionSubmitting = true
    actionSubmissionFailed = false
    try {
      const { requestId, committed } = await submitAssignAssigneeSupportActionRequest(
        client,
        projectionSpaceIds.internal,
        issue,
        currentAccount.uuid,
        requestedAssignee
      )
      activeSupportActionRequestId = requestId
      trackedSupportActionRequestId = undefined
      if (!committed.result) {
        clearSupportActionRequestObservationTimeout()
        actionSubmitting = false
        supportActionRequestQuery.refreshClient()
      } else {
        armSupportActionRequestObservationTimeout(requestId)
      }
    } catch {
      clearSupportActionRequestObservationTimeout()
      actionSubmitting = false
      actionSubmissionFailed = true
    }
  }

  async function requestReassignLead (requestedAssignee: Ref<Person> | null | undefined): Promise<void> {
    if (
      issue === undefined ||
      requestedAssignee == null ||
      canonicalIssueAssignee === null ||
      requestedAssignee === canonicalIssueAssignee ||
      !canAssignLead ||
      actionSubmitting
    ) {
      return
    }

    lastSubmittedAction = 'reassign_assignee'
    assignLeadSelection = requestedAssignee
    actionSubmitting = true
    actionSubmissionFailed = false
    try {
      const { requestId, committed } = await submitReassignAssigneeSupportActionRequest(
        client,
        projectionSpaceIds.internal,
        { ...issue, assignee: canonicalIssueAssignee },
        currentAccount.uuid,
        requestedAssignee
      )
      activeSupportActionRequestId = requestId
      trackedSupportActionRequestId = undefined
      if (!committed.result) {
        clearSupportActionRequestObservationTimeout()
        actionSubmitting = false
        supportActionRequestQuery.refreshClient()
      } else {
        armSupportActionRequestObservationTimeout(requestId)
      }
    } catch {
      clearSupportActionRequestObservationTimeout()
      actionSubmitting = false
      actionSubmissionFailed = true
    }
  }

  async function requestTransitionStatus (requestedStatus: Ref<IssueStatus>): Promise<void> {
    if (
      issue === undefined ||
      currentEmployee === undefined ||
      canonicalIssueAssignee !== currentEmployee ||
      !canManageSupportActions ||
      actionSubmitting
    ) {
      return
    }

    lastSubmittedAction = 'transition_status'
    actionSubmitting = true
    actionSubmissionFailed = false
    try {
      const { requestId, committed } = await submitTransitionStatusSupportActionRequest(
        client,
        projectionSpaceIds.internal,
        { ...issue, assignee: canonicalIssueAssignee },
        currentAccount.uuid,
        currentEmployee,
        requestedStatus
      )
      activeSupportActionRequestId = requestId
      trackedSupportActionRequestId = undefined
      if (!committed.result) {
        clearSupportActionRequestObservationTimeout()
        actionSubmitting = false
        supportActionRequestQuery.refreshClient()
      } else {
        armSupportActionRequestObservationTimeout(requestId)
      }
    } catch {
      clearSupportActionRequestObservationTimeout()
      actionSubmitting = false
      actionSubmissionFailed = true
    }
  }

  async function requestTerminalAction (
    snapshot: Pick<Issue, '_id' | 'status' | 'assignee' | 'modifiedOn'>,
    action: TerminalAction,
    targetStatus: Ref<IssueStatus>,
    reasonCode: SupportLifecycleReasonCode,
    reasonDetail: string
  ): Promise<boolean> {
    lastSubmittedAction = action
    if (
      issue === undefined ||
      issue._id !== snapshot._id ||
      issue.status !== snapshot.status ||
      canonicalIssueAssignee !== snapshot.assignee ||
      issue.modifiedOn !== snapshot.modifiedOn ||
      actionSubmitting
    ) {
      actionSubmissionFailed = true
      return false
    }

    actionSubmitting = true
    actionSubmissionFailed = false
    try {
      const actionIssue = { ...snapshot, assignee: canonicalIssueAssignee }
      const currentTakeover = resolveTakeoverChromeState(actionIssue, liveSessionState)
      const { requestId, committed } = await submitTerminalSupportActionRequest(
        client,
        projectionSpaceIds.internal,
        actionIssue,
        currentAccount.uuid,
        currentEmployee,
        action,
        targetStatus,
        reasonCode,
        reasonDetail,
        {
          canManageSupportActions,
          canReopenCase: canAssignLead,
          assigneeInActiveRoster,
          liveSessionConfirmed: isLiveSessionConfirmed(currentTakeover, liveSessionState),
          hasCurrentProjectionProof: currentTakeover.projectionCurrent,
          projectionOwnerMatchesAssignee: currentTakeover.claimOwner === actionIssue.assignee
        }
      )
      activeSupportActionRequestId = requestId
      trackedSupportActionRequestId = undefined
      if (!committed.result) {
        clearSupportActionRequestObservationTimeout()
        actionSubmitting = false
        actionSubmissionFailed = true
        supportActionRequestQuery.refreshClient()
        return false
      }
      armSupportActionRequestObservationTimeout(requestId)
      return true
    } catch {
      clearSupportActionRequestObservationTimeout()
      actionSubmitting = false
      actionSubmissionFailed = true
      return false
    }
  }

  async function submitComposer (action: ComposerAction): Promise<void> {
    if (issue === undefined || currentEmployee === undefined || composerSubmitting[action]) return

    let deliveryId = composerDeliveryIds[action]
    const draft = composerDrafts[action]
    if (deliveryId === undefined || draft.trim().length === 0) return
    if (
      composerSubmissionFailed[action] ||
      composerRequests[action]?.state === 'failed' ||
      composerRequests[action]?.state === 'superseded'
    ) {
      clearComposerObservationTimeout(action)
      composerRequestQueries[action].unsubscribe()
      deliveryId = conversationMessageDeliveryId(issue._id, currentAccount.uuid, action, generateId())
      composerDeliveryIds = { ...composerDeliveryIds, [action]: deliveryId }
      composerRequestIds = { ...composerRequestIds, [action]: undefined }
      trackedComposerRequestIds = { ...trackedComposerRequestIds, [action]: undefined }
      composerRequests = { ...composerRequests, [action]: undefined }
    }
    const expectedRequestId = conversationMessageSupportActionRequestId(
      issue._id,
      currentAccount.uuid,
      action,
      deliveryId,
      issue.modifiedOn
    )

    const control = resolveConversationComposerControlState(
      action,
      { ...issue, assignee: canonicalIssueAssignee },
      resolveTakeoverChromeState({ ...issue, assignee: canonicalIssueAssignee }, liveSessionState),
      composerRequests[action],
      currentEmployee,
      currentEmployeeActive,
      canManageComposerAction(action),
      composerSubmitting[action],
      composerSubmissionFailed[action]
    )
    if (!control.canSubmit) return

    composerSubmitting = { ...composerSubmitting, [action]: true }
    composerSubmissionFailed = { ...composerSubmissionFailed, [action]: false }
    try {
      const { requestId, committed } = await submitConversationMessageSupportActionRequest(
        client,
        composerRequestSpace(action),
        { ...issue, assignee: canonicalIssueAssignee },
        currentAccount.uuid,
        action,
        deliveryId,
        draft
      )
      if (requestId !== expectedRequestId) throw new Error('conversation_composer_request_id_mismatch')
      composerRequestIds = { ...composerRequestIds, [action]: requestId }
      if (!committed.result) {
        clearComposerObservationTimeout(action)
        composerSubmitting = { ...composerSubmitting, [action]: false }
        composerSubmissionFailed = { ...composerSubmissionFailed, [action]: true }
        return
      }
      watchComposerRequest(action, issue, requestId)
      armComposerObservationTimeout(action, requestId)
    } catch {
      clearComposerObservationTimeout(action)
      composerSubmitting = { ...composerSubmitting, [action]: false }
      composerSubmissionFailed = { ...composerSubmissionFailed, [action]: true }
    }
  }

  $: watchIssue(issueIdentifier, projectId)
  $: supportActionRoles = resolveSupportActionRoleAssignments(internalProjectionSpace, hierarchy)
  $: canManageSupportActions =
    supportActionRoles.supportAgent.includes(currentAccount.uuid) ||
    supportActionRoles.supportLead.includes(currentAccount.uuid)
  $: canManageRestrictedActions = isRestrictedSupportActionRoleMember(
    restrictedProjectionSpace,
    hierarchy,
    currentAccount.uuid
  )
  $: canAssignLead = supportActionRoles.supportLead.includes(currentAccount.uuid)
  $: currentEmployeeActive = currentEmployee !== undefined && $employeeByIdStore.get(currentEmployee)?.active === true
  $: publicReplyComposerState = resolveConversationComposerControlState(
    'post_public_reply',
    {
      _id: issue?._id ?? ('issue:none' as Ref<Issue>),
      status: issue?.status ?? (tracker.status.Backlog as Ref<IssueStatus>),
      assignee: canonicalIssueAssignee,
      modifiedOn: issue?.modifiedOn ?? 0
    },
    resolveTakeoverChromeState(
      {
        _id: issue?._id ?? ('issue:none' as Ref<Issue>),
        status: issue?.status ?? (tracker.status.Backlog as Ref<IssueStatus>),
        assignee: canonicalIssueAssignee,
        modifiedOn: issue?.modifiedOn ?? 0
      },
      liveSessionState
    ),
    composerRequests.post_public_reply,
    currentEmployee,
    currentEmployeeActive,
    canManageSupportActions,
    composerSubmitting.post_public_reply,
    composerSubmissionFailed.post_public_reply
  )
  $: internalNoteComposerState = resolveConversationComposerControlState(
    'post_internal_note',
    {
      _id: issue?._id ?? ('issue:none' as Ref<Issue>),
      status: issue?.status ?? (tracker.status.Backlog as Ref<IssueStatus>),
      assignee: canonicalIssueAssignee,
      modifiedOn: issue?.modifiedOn ?? 0
    },
    resolveTakeoverChromeState(
      {
        _id: issue?._id ?? ('issue:none' as Ref<Issue>),
        status: issue?.status ?? (tracker.status.Backlog as Ref<IssueStatus>),
        assignee: canonicalIssueAssignee,
        modifiedOn: issue?.modifiedOn ?? 0
      },
      liveSessionState
    ),
    composerRequests.post_internal_note,
    currentEmployee,
    currentEmployeeActive,
    canManageSupportActions,
    composerSubmitting.post_internal_note,
    composerSubmissionFailed.post_internal_note
  )
  $: restrictedNoteComposerState = resolveConversationComposerControlState(
    'post_restricted_note',
    {
      _id: issue?._id ?? ('issue:none' as Ref<Issue>),
      status: issue?.status ?? (tracker.status.Backlog as Ref<IssueStatus>),
      assignee: canonicalIssueAssignee,
      modifiedOn: issue?.modifiedOn ?? 0
    },
    resolveTakeoverChromeState(
      {
        _id: issue?._id ?? ('issue:none' as Ref<Issue>),
        status: issue?.status ?? (tracker.status.Backlog as Ref<IssueStatus>),
        assignee: canonicalIssueAssignee,
        modifiedOn: issue?.modifiedOn ?? 0
      },
      liveSessionState
    ),
    composerRequests.post_restricted_note,
    currentEmployee,
    currentEmployeeActive,
    canManageRestrictedActions,
    composerSubmitting.post_restricted_note,
    composerSubmissionFailed.post_restricted_note
  )
  $: assignLeadLeadCandidates = uniquePersons(supportActionRoles.supportLead, $employeeRefByAccountUuidStore)
  $: assignLeadAgentCandidates = uniquePersons(supportActionRoles.supportAgent, $employeeRefByAccountUuidStore)
  $: assignLeadCategories = [
    {
      label: customerSuccess.string.SupportLead,
      func: async () => assignLeadLeadCandidates
    },
    {
      label: customerSuccess.string.SupportAgent,
      func: async () => assignLeadAgentCandidates
    }
  ].filter(
    (category) =>
      (category.label === customerSuccess.string.SupportLead ? assignLeadLeadCandidates : assignLeadAgentCandidates)
        .length > 0
  )
  $: assignLeadCandidates = Array.from(new Set([...assignLeadLeadCandidates, ...assignLeadAgentCandidates]))
  $: assigneeInActiveRoster =
    canonicalIssueAssignee !== null &&
    assignLeadCandidates.includes(canonicalIssueAssignee) &&
    $employeeByIdStore.get(canonicalIssueAssignee as Ref<Employee>)?.active === true
  $: assignLeadCandidateQuery = buildAssignLeadCandidateQuery(assignLeadCandidates)
  $: if (issue === undefined) {
    canonicalIssueAssignee = null
  } else {
    const cachedAssignee = canonicalSupportAssignee(issue.assignee, $employeeRefByAccountUuidStore)
    const canonicalState = resolveTakeoverChromeState({ ...issue, assignee: cachedAssignee }, liveSessionState)
    canonicalIssueAssignee = canonicalState.projectionCurrent ? canonicalState.claimOwner : cachedAssignee
  }
  $: if (issue !== undefined) ensureComposerDeliveryIds(issue)
  $: if (issue !== undefined && shouldReleaseActiveSupportActionRequest(supportActionRequest, issue.modifiedOn)) {
    releaseStaleSupportActionRequest()
  }
  $: if (supportActionRequest?.action === 'assign_assignee' || supportActionRequest?.action === 'reassign_assignee') {
    assignLeadSelection = supportActionRequest.requestedAssignee
  } else if (!actionSubmitting) {
    assignLeadSelection = canonicalIssueAssignee
  }
  $: if (trackedInternalProjectionSpaceId !== projectionSpaceIds.internal) {
    trackedInternalProjectionSpaceId = projectionSpaceIds.internal
    watchInternalProjectionSpace(projectionSpaceIds.internal)
  }
  $: if (trackedRestrictedProjectionSpaceId !== projectionSpaceIds.restricted) {
    trackedRestrictedProjectionSpaceId = projectionSpaceIds.restricted
    watchRestrictedProjectionSpace(projectionSpaceIds.restricted)
  }
  $: if (
    shouldClearConversationComposerDraft(
      composerRequests.post_public_reply,
      conversationEventObserved(
        composerVisibility('post_public_reply'),
        composerRequests.post_public_reply?.resultEventId
      )
    )
  ) {
    if (composerDrafts.post_public_reply !== '') setComposerDraft('post_public_reply', '')
    composerDeliveryIds = { ...composerDeliveryIds, post_public_reply: undefined }
  }
  $: if (
    shouldClearConversationComposerDraft(
      composerRequests.post_internal_note,
      conversationEventObserved(
        composerVisibility('post_internal_note'),
        composerRequests.post_internal_note?.resultEventId
      )
    )
  ) {
    if (composerDrafts.post_internal_note !== '') setComposerDraft('post_internal_note', '')
    composerDeliveryIds = { ...composerDeliveryIds, post_internal_note: undefined }
  }
  $: if (
    shouldClearConversationComposerDraft(
      composerRequests.post_restricted_note,
      conversationEventObserved(
        composerVisibility('post_restricted_note'),
        composerRequests.post_restricted_note?.resultEventId
      )
    )
  ) {
    if (composerDrafts.post_restricted_note !== '') setComposerDraft('post_restricted_note', '')
    composerDeliveryIds = { ...composerDeliveryIds, post_restricted_note: undefined }
  }
  $: if (state === 'ready' && issue !== undefined) {
    const nextTrackedRequestId =
      activeSupportActionRequestId ??
      hydratedSupportActionRequestId ??
      claimSelfSupportActionRequestId(issue._id, currentAccount.uuid, issue.modifiedOn)

    watchIssueStatus(issue)
    watchLiveSessionState(issue)
    if (
      canManageSupportActions &&
      nextTrackedRequestId !== undefined &&
      trackedSupportActionRequestId !== nextTrackedRequestId
    ) {
      watchSupportActionRequest(issue, nextTrackedRequestId)
    } else if (!canManageSupportActions || nextTrackedRequestId === undefined) {
      trackedSupportActionRequestId = undefined
      supportActionRequest = undefined
      actionSubmitting = false
      supportActionRequestQuery.unsubscribe()
    }
    if (subscribedIssueId !== issue._id) {
      subscribedIssueId = issue._id
      watchTranscript(issue)
      watchHistory(issue)
    }
  }
  $: if (
    state === 'ready' &&
    issue !== undefined &&
    canManageSupportActions &&
    activeSupportActionRequestId === undefined
  ) {
    const hydrationKey = `${projectionSpaceIds.internal}:${issue._id}:${currentAccount.uuid}:${issue.modifiedOn}:${canonicalIssueAssignee ?? 'none'}`
    if (trackedSupportActionRequestHydrationKey !== hydrationKey) {
      hydratedSupportActionRequestId = undefined
      watchSupportActionRequestHydration(issue, canonicalIssueAssignee)
    }
  } else if (trackedSupportActionRequestHydrationKey !== undefined) {
    trackedSupportActionRequestHydrationKey = undefined
    hydratedSupportActionRequestId = undefined
    supportActionRequestHydrationQuery.unsubscribe()
  }

  onDestroy(stopAllQueries)
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
      <Button
        slot="actions"
        icon={IconRedo}
        size="small"
        kind="ghost"
        label={customerSuccess.string.Refresh}
        on:click={refreshDetail}
      />
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

    <TakeoverStateChrome
      {issue}
      assignee={canonicalIssueAssignee}
      projection={liveSessionState}
      actionRequest={supportActionRequest}
      {currentEmployee}
      {canManageSupportActions}
      {canAssignLead}
      {assigneeInActiveRoster}
      submitting={actionSubmitting}
      submissionFailed={actionSubmissionFailed}
      {lastSubmittedAction}
      {assignLeadCandidateQuery}
      {assignLeadCategories}
      {assignLeadSelection}
      {requestClaimSelf}
      {requestAssignLead}
      {requestReassignLead}
      {requestTransitionStatus}
      {requestTerminalAction}
    />

    {#if $deviceInfo.isMobile}
      <span id="customer-success-detail-views" class="sr-only">
        <Label label={customerSuccess.string.ConversationViews} />
      </span>
      <div class="mobile-tabs" role="tablist" aria-labelledby="customer-success-detail-views">
        <button
          bind:this={conversationTab}
          id="customer-success-conversation-tab"
          role="tab"
          type="button"
          aria-selected={mobileLane === 'conversation'}
          aria-controls="customer-success-conversation-panel"
          tabindex={mobileLane === 'conversation' ? 0 : -1}
          on:click={() => {
            selectMobileLane('conversation')
          }}
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
          on:click={() => {
            selectMobileLane('activity')
          }}
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
          <div class="lane-actions">
            {#if earlierLoadFailed}
              <span class="load-earlier-failed" role="status" aria-live="polite">
                <Label label={presentation.string.FailedToPreview} />
              </span>
            {/if}
            {#if Object.values(canLoadEarlier).some(Boolean)}
              <Button
                size="small"
                kind="ghost"
                label={customerSuccess.string.LoadEarlier}
                disabled={earlierLoading}
                on:click={loadEarlierMessages}
              />
            {/if}
          </div>
        </div>
        <div class="lane-scroll">
          <Scroller
            padding="0 1rem 1rem"
            bind:divScroll={conversationScroll}
          >
            {#if transcriptLoading}
              <Loading />
            {:else if visibleMessages.length === 0}
              <div class="empty-lane"><Label label={customerSuccess.string.NoMessages} /></div>
            {:else}
              <div class="message-list">
                {#each visibleMessages as entry (entry.message._id)}
                  <article
                    class="message-row"
                    class:customer={entry.lane === 'customer'}
                    class:internal={entry.visibility === 'internal'}
                    class:restricted={entry.visibility === 'restricted'}
                  >
                    <div class="message-meta">
                      <strong><Label label={laneLabel(entry.lane)} /></strong>
                      <span class="visibility-label"><Label label={visibilityLabel(entry.visibility)} /></span>
                      <DatePresenter
                        value={entry.message.occurredAt}
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
        <div class="composer-stack">
          {#if publicReplyComposerState.visible}
            <ConversationComposer
              action="post_public_reply"
              title={customerSuccess.string.PublicReply}
              placeholder={customerSuccess.string.PublicReplyPlaceholder}
              submitLabel={customerSuccess.string.PostPublicReply}
              draft={composerDrafts.post_public_reply}
              disabled={!publicReplyComposerState.canSubmit}
              busy={publicReplyComposerState.busy}
              status={publicReplyComposerState.status}
              on:draft={(event) => {
                setComposerDraft('post_public_reply', event.detail)
              }}
              on:submit={() => {
                void submitComposer('post_public_reply')
              }}
            />
          {/if}
          {#if internalNoteComposerState.visible}
            <ConversationComposer
              action="post_internal_note"
              title={customerSuccess.string.InternalNote}
              placeholder={customerSuccess.string.InternalNotePlaceholder}
              submitLabel={customerSuccess.string.PostInternalNote}
              draft={composerDrafts.post_internal_note}
              disabled={!internalNoteComposerState.canSubmit}
              busy={internalNoteComposerState.busy}
              status={internalNoteComposerState.status}
              on:draft={(event) => {
                setComposerDraft('post_internal_note', event.detail)
              }}
              on:submit={() => {
                void submitComposer('post_internal_note')
              }}
            />
          {/if}
          {#if restrictedNoteComposerState.visible}
            <ConversationComposer
              action="post_restricted_note"
              title={customerSuccess.string.RestrictedNote}
              placeholder={customerSuccess.string.RestrictedNotePlaceholder}
              submitLabel={customerSuccess.string.PostRestrictedNote}
              draft={composerDrafts.post_restricted_note}
              disabled={!restrictedNoteComposerState.canSubmit}
              busy={restrictedNoteComposerState.busy}
              status={restrictedNoteComposerState.status}
              on:draft={(event) => {
                setComposerDraft('post_restricted_note', event.detail)
              }}
              on:submit={() => {
                void submitComposer('post_restricted_note')
              }}
            />
          {/if}
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
          <div class="lane-actions">
            {#if historyEarlierLoadFailed}
              <span class="load-earlier-failed" role="status" aria-live="polite">
                <Label label={presentation.string.FailedToPreview} />
              </span>
            {/if}
            {#if historyCanLoadEarlier}
              <Button
                size="small"
                kind="ghost"
                label={customerSuccess.string.LoadEarlier}
                disabled={historyEarlierLoading}
                on:click={loadEarlierHistory}
              />
            {/if}
          </div>
        </div>
        <div class="lane-scroll">
          <Scroller padding="0 1rem 1rem" bind:divScroll={activityScroll}>
            {#if historyLoading}
              <Loading />
            {:else if history.length === 0}
              <div class="empty-lane"><Label label={customerSuccess.string.NoActivity} /></div>
            {:else}
              <div class="activity-list">
                {#each history as item (item._id)}
                  <div class="activity-row">
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
                  </div>
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

  .composer-stack {
    display: grid;
    gap: 0.75rem;
    padding: 0.75rem 1rem 1rem;
    border-top: 1px solid var(--theme-divider-color);
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

  .lane-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .load-earlier-failed {
    color: var(--theme-halfcontent-color);
    font-size: 0.75rem;
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

    &.internal {
      border-style: dashed;
    }

    &.restricted {
      border-width: 2px;
    }
  }

  .message-row,
  .activity-row {
    content-visibility: auto;
    contain: layout paint style;
    contain-intrinsic-size: auto 6rem;
  }

  .visibility-label {
    padding: 0.125rem 0.375rem;
    color: var(--theme-halfcontent-color);
    border: 1px solid var(--theme-divider-color);
    border-radius: 4px;
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
