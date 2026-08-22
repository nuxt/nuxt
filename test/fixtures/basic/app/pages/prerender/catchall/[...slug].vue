<script setup lang="ts">
const route = useRoute()

const { data, status } = await useAsyncData(route.path, () => Promise.resolve({ path: route.path }))

if (import.meta.client) {
  const states = ((window as unknown as { __asyncDataStates?: unknown[] }).__asyncDataStates ||= [])
  states.push({ path: route.path, status: status.value, hasData: data.value !== undefined })
}

if (!data.value) {
  throw createError({ status: 404, statusText: 'Page not found', fatal: true })
}
</script>

<template>
  <div id="catchall-async-data">
    {{ data!.path }}
  </div>
</template>
