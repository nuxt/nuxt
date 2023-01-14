<template>
  <div>
    <div>[...slug].vue</div>
    <div>404 at {{ $route.params.slug[0] }}</div>
    <div>Middleware ran: {{ !!($route.meta.override as any)?.includes('extended middleware') }}</div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['override'],
  validate: to => to.path !== '/forbidden'
})
</script>
