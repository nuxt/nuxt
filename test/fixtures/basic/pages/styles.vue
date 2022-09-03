<template>
  <div>
    <ClientOnlyScript />
    <FunctionalComponent />
  </div>
</template>

<script setup>
import '~/assets/assets.css'
</script>

<style lang="postcss">
  :root {
    --postcss: 'postcss';
  }
</style>

<style scoped>
  div {
    --scoped: 'scoped';
  }
</style>
