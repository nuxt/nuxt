<script setup lang="ts">
const route = useRoute('nested-foo-bar')
</script>

<template>
  <div>
    <div>nested/[foo]/[bar].vue</div>
    <div>foo: {{ route.params.foo }}</div>
    <div>bar: {{ route.params.bar }}</div>
    <NuxtLink
      id="user-test"
      to="/nested/foo/user-test"
    >
      to /nested/foo/user-test
    </NuxtLink>
    <NuxtLink
      id="test"
      to="/nested/foo/test"
    >
      to /nested/foo/test
    </NuxtLink>
  </div>
</template>
