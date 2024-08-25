<template>
  <div>
    <LazyNCompAll message="lazy-named-comp-all" />
    <LazyNCompClient message="lazy-named-comp-client" />
    <LazyNCompServer message="lazy-named-comp-server" />
    <LazyEventDelayedEvent id="lazyevent" />
    <LazyEventView />
    <LazyNeverDelayedNever />
    <LazyEventDelayedEvent
      id="lazyevent2"
      :hydrate="createEventLoader(['click'])"
    />
    <LazyIfDelayedCondition id="lazycondition" />
    <button
      id="conditionbutton"
      @click="state++"
    />
    <LazyIfDelayedCondition
      id="lazycondition2"
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
