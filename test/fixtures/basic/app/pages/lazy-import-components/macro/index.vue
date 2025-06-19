<template>
  <div>
    hydrate-on-visible:
    <LazyVisibleDelayedComponentMacro data-testid="hydrate-on-visible" />
    hydrate-on-idle:
    <LazyIdleDelayedComponentMacro data-testid="hydrate-on-idle" />
    hydrate-on-interaction-default:
    <LazyInteractionDelayedComponentMacro data-testid="hydrate-on-interaction-default" />
    hydrate-on-interaction-click:
    <LazyInteractionDelayedComponentMacro
      data-testid="hydrate-on-interaction-click"
      :hydrate-on-interaction="['click']"
    />
    hydrate-on-media-query:
    <LazyMediaQueryDelayedComponentMacro
      data-testid="hydrate-on-media-query"
      hydrate-on-media-query="(max-width: 768px)"
    />
    hydrate-when-always:
    <LazyIfDelayedComponentMacro
      data-testid="hydrate-when-always"
      :hydrate-when="true"
    />
    hydrate-when-state:
    <button
      data-testid="button-increase-state"
      @click="state++"
    >
      Increase state
    </button>
    <LazyIfDelayedComponentMacro
      data-testid="hydrate-when-state"
      :hydrate-when="state > 0"
    />
    hydrate-never:
    <LazyNeverDelayedComponentMacro data-testid="hydrate-never" />
    <div style="height:3000px">
      This is a very tall div
    </div>
    hydrate-on-visible-bottom:
    <LazyVisibleDelayedComponentMacro data-testid="hydrate-on-visible-bottom" />
  </div>
</template>

<script setup lang="ts">
const LazyVisibleDelayedComponentMacro = defineLazyHydrationComponent('visible', () => import('~/components/DelayedComponent.vue'))
const LazyIdleDelayedComponentMacro = defineLazyHydrationComponent('idle', () => import('~/components/DelayedComponent.vue'))
const LazyInteractionDelayedComponentMacro = defineLazyHydrationComponent('interaction', () => import('~/components/DelayedComponent.vue'))
const LazyMediaQueryDelayedComponentMacro = defineLazyHydrationComponent('mediaQuery', () => import('~/components/DelayedComponent.vue'))
const LazyIfDelayedComponentMacro = defineLazyHydrationComponent('if', () => import('~/components/DelayedComponent.vue'))
const LazyNeverDelayedComponentMacro = defineLazyHydrationComponent('never', () => import('~/components/DelayedComponent.vue'))

const state = ref(0)
</script>
