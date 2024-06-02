<template>
  <div>
    <LazyNCompAll message="lazy-named-comp-all" />
    <LazyNCompClient message="lazy-named-comp-client" />
    <LazyNCompServer message="lazy-named-comp-server" />
    <div style="height:3000px">
      This is a very tall div
    </div>
    <LazyVisibleDelayedHydration />
  </div>
</template>
