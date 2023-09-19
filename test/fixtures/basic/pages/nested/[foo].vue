<script setup lang="ts">
const route = useRoute('nested-foo')
</script>

<template>
  <div>
    <div>nested/[foo]/index.vue</div>
    <div>foo: {{ route.params.foo }}</div>

    <div class="big-block" />
    <div class="big-block" />
    <NuxtPage />
  </div>
</template>

<style scoped>
.big-block {
  height: 90vh;
  width: 100vw;
}
</style>
