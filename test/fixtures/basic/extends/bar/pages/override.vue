<script setup>
definePageMeta({
  layout: 'override',
  middleware: 'override'
})
</script>

<template>
  <div>
    <div>Extended page from bar</div>
    <div>Middleware | override: {{ $route.meta.override }}</div>
    <ExtendsOverride />
    <NuxtPage />
  </div>
</template>
