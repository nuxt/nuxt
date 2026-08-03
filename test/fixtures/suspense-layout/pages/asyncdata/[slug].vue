<script setup lang="ts">
const route = useRoute()
const { data } = await useAsyncData(`asyncdata-${route.params.slug}`, async () => {
  await new Promise(resolve => setTimeout(resolve, 200))
  return { slug: route.params.slug }
}, { watch: [() => route.params.slug] })
</script>

<template>
  <div :data-testid="`asyncdata-${data?.slug}`">
    <p>Async slug: {{ data?.slug }}</p>
    <NuxtLink
      to="/asyncdata/p1"
      data-testid="link-async-p1"
    >
      p1
    </NuxtLink>
    <NuxtLink
      to="/asyncdata/p2"
      data-testid="link-async-p2"
    >
      p2
    </NuxtLink>
    <NuxtLink
      to="/asyncdata/p3"
      data-testid="link-async-p3"
    >
      p3
    </NuxtLink>
  </div>
</template>
