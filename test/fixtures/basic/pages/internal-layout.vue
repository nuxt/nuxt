<script setup lang="ts">
definePageMeta({
  layout: false
})

const route = useRoute()
</script>

<template>
  <div>
    <NuxtLayout :name="route.meta._layout as string || 'default'">
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
