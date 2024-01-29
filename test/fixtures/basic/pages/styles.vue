<template>
  <div>
    <ClientOnlyScript />
    <FunctionalComponent />
    <ServerOnlyComponent />
    <SharedComponent />
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
