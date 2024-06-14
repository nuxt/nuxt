<template>
  <div>
    <LazyNCompAll message="lazy-named-comp-all" />
    <LazyNCompClient message="lazy-named-comp-client" />
    <LazyNCompServer message="lazy-named-comp-server" />
    <LazyEventDelayedEvent id="lazyevent"/>
    <LazyIdleDelayedNetwork />
    <div style="height:3000px">
      This is a very tall div
    </div>
    <LazyVisibleDelayedVisible />
  </div>
</template>
