<script setup lang="ts">
const event = import.meta.server ? useRequestEvent()! : undefined
if (event) {
  event.context.user = 'daniel'
  event.context.nuxt = { noSSR: true }
}
const requestFetch = useRequestFetch()
const { data } = await useAsyncData('fetched-context', async () => {
  const html = await requestFetch<string>('/context')
  const context = event?.context as { inner?: string, nuxt?: { noSSR?: boolean } } | undefined
  return {
    html,
    isolated: context !== undefined && context.inner === undefined && context.nuxt?.noSSR === true,
  }
})
</script>

<template>
  <p id="fetched-context">
    {{ data?.html.includes('<p id="context">daniel</p>') && data.isolated ? 'seeded with daniel and isolated' : 'missing' }}
  </p>
</template>
