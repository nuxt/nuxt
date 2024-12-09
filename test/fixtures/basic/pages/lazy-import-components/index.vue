<template>
  <div>
    <LazyNCompAll message="lazy-named-comp-all" />
    <LazyNCompClient message="lazy-named-comp-client" />
    <LazyNCompServer message="lazy-named-comp-server" />
    <LazyDelayedEvent
      id="lazyevent"
      hydrate:event
    />
    <LazyEventView />
    <LazyDelayedVisible hydrate:visible />
    <LazyDelayedNever hydrate:never />
    <LazyDelayedEvent
      id="lazyevent2"
      :hydrate:event="['click']"
    />
    <LazyDelayedCondition
      id="lazycondition"
      hydrate:if
    />
    <button
      id="conditionbutton"
      @click="state++"
    />
    <LazyDelayedCondition
      id="lazycondition2"
      :hydrate:if="state > 1"
    />
    <LazyDelayedNetwork hydrate:idle />
    <div style="height:3000px">
      This is a very tall div
    </div>
    <LazyDelayedVisible hydrate:visible />
  </div>
</template>

<script setup lang="ts">
const state = useState('delayedHydrationCondition', () => 1)
</script>
