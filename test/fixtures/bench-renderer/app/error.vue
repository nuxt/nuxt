<script setup lang="ts">
const props = defineProps<{ error: { status?: number, statusText?: string } }>()

useHead({ title: `${props.error.status}` })
</script>

<template>
  <NuxtLayout>
    <h1>{{ props.error.status }}</h1>
    <p>{{ props.error.statusText }}</p>
    <NuxtLink to="/">
      Home
    </NuxtLink>
  </NuxtLayout>
</template>
