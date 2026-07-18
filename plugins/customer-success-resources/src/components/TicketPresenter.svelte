<!--
// Copyright © 2026 NDAX
//
// Licensed under the Eclipse Public License, Version 2.0.
-->
<script lang="ts">
  import { concatLink } from '@hcengineering/core'
  import { getMetadata } from '@hcengineering/platform'
  import presentation, { NavLink } from '@hcengineering/presentation'
  import type { Issue } from '@hcengineering/tracker'
  import { getCurrentResolvedLocation, locationToUrl } from '@hcengineering/ui'

  import { openConversationQuery } from '../conversation-detail'

  export let object: Issue
  export let field: 'identifier' | 'title' = 'identifier'
  export let interactive = true
  export let grow = false
  export let minWidth = '1rem'

  function conversationHref (): string {
    const loc = getCurrentResolvedLocation()
    loc.query = openConversationQuery(loc.query, object.identifier)
    loc.fragment = ''
    const frontUrl = getMetadata(presentation.metadata.FrontUrl) ?? window.location.origin
    return concatLink(frontUrl, locationToUrl(loc))
  }

  $: label = field === 'title' ? object.title : object.identifier
  $: href = interactive ? conversationHref() : undefined
</script>

<span class="ticket-link" class:grow style:min-width={minWidth} title={object.title}>
  {#if interactive}
    <NavLink {href} inline colorInherit noSelect={false}>
      <span class="sr-only">{object.identifier}: </span>{label}
    </NavLink>
  {:else}
    {label}
  {/if}
</span>

<style lang="scss">
  .ticket-link {
    min-height: 1.75rem;
    max-width: 100%;
    display: inline-flex;
    align-items: center;
    overflow: hidden;
    color: inherit;
    text-overflow: ellipsis;
    white-space: nowrap;

    &.grow {
      flex: 1 1 auto;
    }
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
</style>
