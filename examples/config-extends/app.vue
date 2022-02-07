<script setup>
const themeConfig = useRuntimeConfig().theme
</script>

<template>
  <NuxtExampleLayout example="config-extends">
    theme runtimeConfig
    <pre>{{ JSON.stringify(themeConfig, null, 2) }}</pre>
    <BaseButton>Base Button</BaseButton>
    <FancyButton>Fancy Button</FancyButton>
  </NuxtExampleLayout>
</template>

<style scoped>
pre {
  text-align: left;
}
</style>
