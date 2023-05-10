<script setup lang="ts">
const route = useRoute('nested-foo-user-group')
</script>

<template>
  <div>
    <div>nested/[foo]/user-[group].vue</div>
    <div>foo: {{ route.params.foo }}</div>
    <div>group: {{ route.params.group }}</div>
  </div>
</template>
