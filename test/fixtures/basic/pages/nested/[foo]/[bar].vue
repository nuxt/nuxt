<script setup lang="ts">
const route = useRoute('nested-foo-bar')
</script>

<template>
  <div>
    <div>nested/[foo]/[bar].vue</div>
    <div>foo: {{ route.params.foo }}</div>
    <div>bar: {{ route.params.bar }}</div>
  </div>
</template>
