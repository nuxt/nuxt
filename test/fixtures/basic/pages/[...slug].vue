<template>
  <div>
    <h1>[...slug].vue</h1>
    <div>catchall at {{ $route.params.slug[0] }}</div>
    <div>Middleware ran: {{ !!($route.meta.override as any)?.includes('extended middleware') }}</div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['override'],
  validate: to => to.path !== '/forbidden'
})
</script>
