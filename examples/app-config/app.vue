<script setup>
const config = useAppConfig()
</script>

<template>
  <NuxtExampleLayout example="app-config">
    <h1>{{ config.title }}</h1>
    <p>{{ config.description }}</p>
    <button v-if="config.showButton">
      I am a button
    </button>
  </NuxtExampleLayout>
</template>
