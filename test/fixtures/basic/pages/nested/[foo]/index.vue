<script setup lang="ts">
const route = useRoute('nested-foo')
</script>

<template>
  <div>
    <div>nested/[foo]/index.vue</div>
    <div>foo: {{ route.params.foo }}</div>
  </div>
</template>
