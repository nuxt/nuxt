<script setup lang="ts">
definePageMeta({
  // Disable page transition for this page to avoid having multiple time the same page during transition
  pageTransition: false,
  layoutTransition: false,
})

const { data } = await useAsyncData(() => new Promise(resolve => setTimeout(() => resolve('async data'), 40)))

const state = useState('test', () => {
  let hasAccessToWindow = null as null | boolean

  try {
    hasAccessToWindow = !!Object.keys(window).at(0)
  } catch {
    hasAccessToWindow = null
  }

  return {
    hasAccessToWindow,
    isServer: import.meta.server,
  }
})

const serverRendered = useState(() => import.meta.server)
</script>

<template>
  <div>
    <NuxtLink to="/client-only-page/normal">
      normal
    </NuxtLink>

    client only page
    <p >
      <span v-if="data" id="async-data"> {{ data }}</span>

      <span  v-else id="async-data-placeholder">placeholder</span>
     </p>

    <p id="state">
      {{ state }}
    </p>

    <p id="server-rendered">
      {{ serverRendered }}
    </p>
  </div>
</template>
