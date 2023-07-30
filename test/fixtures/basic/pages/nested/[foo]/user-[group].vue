<script setup lang="ts">
const route = useRoute('nested-foo-user-group')
</script>

<template>
  <div>
    <div>nested/[foo]/user-[group].vue</div>
    <div>foo: {{ route.params.foo }}</div>
    <div>group: {{ route.params.group }}</div>
    
    <NuxtLink to="/nested/foo/user-test" id="user-test">to /nested/foo/user-test</NuxtLink>
    <NuxtLink to="/nested/foo/test" id="test">to /nested/foo/test</NuxtLink>
  </div>
</template>
