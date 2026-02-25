<template>
  <div>
    App Config:
    <!-- eslint-disable-next-line vue/no-v-html -->
    <pre v-html="JSON.stringify(appConfig)" />
  </div>
</template>

<script setup lang="ts">
const appConfig = useAppConfig()
</script>
