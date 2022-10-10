<template>
  <div>
    <div>[...slug].vue</div>
    <div>404 at {{ $route.params.slug[0] }}</div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  validate: to => to.path !== '/forbidden'
})
</script>
