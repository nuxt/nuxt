<template>
  <div class="index-page">
    <LazyHydrateNeverComponent hydrate-never />
    <LazyHydrateOnVisibleComponent hydrate-on-visible />
    <LazyBaseA hydrate-on-visible />
    <BaseB />
  </div>
</template>

<style scoped>
.index-page {
  padding: 40px;
}
</style>
