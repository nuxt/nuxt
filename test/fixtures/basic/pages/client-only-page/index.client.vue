<script setup lang="ts">
definePageMeta({
  // Disable page transition for this page to avoid having multiple time the same page during transition
  pageTransition: false,
  layoutTransition: false,
})

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

    <p id="state">
      {{ state }}
    </p>

    <p id="server-rendered">
      {{ serverRendered }}
    </p>
  </div>
</template>
