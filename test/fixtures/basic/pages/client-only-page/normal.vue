<script setup lang="ts">
const renderedOnServer = useState(() => import.meta.server)
definePageMeta({
  // Disable page transition for this page to avoid having multiple time the same page during transition
  pageTransition: false,
  layoutTransition: false,
})
</script>

<template>
  <div>
    <NuxtLink to="/client-only-page">
      to client only page
    </NuxtLink>

    <p id="server-rendered">
      {{ renderedOnServer }}
    </p>
  </div>
</template>
