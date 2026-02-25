<template>
  <div>
    hydrate-on-interaction-default:
    <LazyDelayedComponent
      data-testid="hydrate-on-interaction-default"
      hydrate-on-interaction
    />
    event-view-normal-component:
    <LazyEventView data-testid="event-view-normal-component" />
    hydrate-on-visible:
    <LazyDelayedComponent
      data-testid="hydrate-on-visible"
      hydrate-on-visible
    />
    hydrate-never:
    <LazyDelayedComponent
      data-testid="hydrate-never"
      hydrate-never
    />
    hydrate-on-interaction-click:
    <LazyDelayedComponent
      data-testid="hydrate-on-interaction-click"
      :hydrate-on-interaction="['click']"
    />
    hydrate-when-always:
    <LazyDelayedComponent
      data-testid="hydrate-when-always"
      :hydrate-when="true"
    />
    button-increase-state:
    <button
      data-testid="button-increase-state"
      @click="state++"
    >
      Increase state
    </button>
    hydrate-when-state:
    <LazyDelayedComponent
      data-testid="hydrate-when-state"
      :hydrate-when="state > 1"
    />
    hydrate-on-idle:
    <LazyDelayedComponent
      data-testid="hydrate-on-idle"
      :hydrate-on-idle="3"
    />
    <div style="height:3000px">
      This is a very tall div
    </div>
    hydrate-on-visible-bottom:
    <LazyDelayedComponent
      data-testid="hydrate-on-visible-bottom"
      hydrate-on-visible
    />
  </div>
</template>

<script setup lang="ts">
const state = useState('delayedHydrationCondition', () => 1)
</script>
