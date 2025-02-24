<template>
  <div>
    <LazyNCompAll message="lazy-named-comp-all" />
    <LazyNCompClient message="lazy-named-comp-client" />
    <LazyNCompServer message="lazy-named-comp-server" />
    <LazyDelayedEvent
      data-testid="lazyevent"
      hydrate-on-interaction
    />
    <LazyEventView />
    <LazyDelayedVisible hydrate-on-visible />
    <LazyDelayedNever hydrate-never />
    <LazyDelayedEvent
      data-testid="hydrate-on-click"
      :hydrate-on-interaction="['click']"
    />
    <LazyDelayedCondition :hydrate-when="true" />
    <button
      data-testid="conditionbutton"
      @click="state++"
    />
    <LazyDelayedCondition :hydrate-when="state > 1" />
    <LazyDelayedNetwork :hydrate-on-idle="3" />
    <div style="height:3000px">
      This is a very tall div
    </div>
    <LazyDelayedVisible hydrate-on-visible />
  </div>
</template>

<script setup lang="ts">
const state = useState('delayedHydrationCondition', () => 1)
</script>
