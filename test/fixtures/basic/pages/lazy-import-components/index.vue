<template>
  <div>
    <LazyNCompAll message="lazy-named-comp-all" />
    <LazyNCompClient message="lazy-named-comp-client" />
    <LazyNCompServer message="lazy-named-comp-server" />
    <LazyEventDelayedEvent data-testid="lazyevent" />
    <LazyEventView />
    <LazyVisibleDelayedVisible />
    <LazyNeverDelayedNever />
    <LazyEventDelayedEvent
      data-testid="hydrate-on-click"
      :hydrate="['click']"
    />
    <LazyIfDelayedCondition />
    <button
      data-testid="conditionbutton"
      @click="state++"
    />
    <LazyIfDelayedCondition
      :hydrate="state > 1"
    />
    <LazyIdleDelayedNetwork />
    <div style="height:3000px">
      This is a very tall div
    </div>
    <LazyVisibleDelayedVisible />
  </div>
</template>

<script setup lang="ts">
const state = useState('delayedHydrationCondition', () => 1)
</script>
