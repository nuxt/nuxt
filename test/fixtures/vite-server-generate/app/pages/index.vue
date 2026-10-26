<script setup lang="ts">
const { data } = await useAsyncData('greeting', () => Promise.resolve({ rendered: 'from useAsyncData' }))

prerenderRoutes('/hinted/from-hint')
</script>

<template>
  <div>
    <p id="async-data">
      {{ data?.rendered }}
    </p>
    <NuxtLink
      id="crawled-link"
      to="/blog/crawled"
    >
      crawled
    </NuxtLink>
    <NuxtLink
      id="about-link"
      to="/about"
    >
      about
    </NuxtLink>
    <NuxtLink
      v-slot="{ navigate }"
      custom
      to="/hinted/from-link"
    >
      <button
        id="custom-link"
        type="button"
        @click="navigate"
      >
        custom
      </button>
    </NuxtLink>
    <NuxtLink
      id="external-link"
      to="https://example.com"
    >
      external
    </NuxtLink>
  </div>
</template>
