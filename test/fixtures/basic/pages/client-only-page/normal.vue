<script setup lang="ts">
const renderedOnServer = useState(() => import.meta.server)
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
